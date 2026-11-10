-- =====================================================================
-- CampusOne database schema for Supabase
-- Run this ONCE in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to read top to bottom: tables, helper functions, triggers,
-- row-level security (who can see/change what), and RPC functions.
-- =====================================================================

-- ---------- Types ----------
create type public.user_role   as enum ('student', 'faculty', 'admin');
create type public.user_status as enum ('pending', 'active');

-- ---------- Tables ----------

-- One row per signed-up user (auth.users). Created automatically by a trigger.
-- New accounts are always 'student' + 'pending' until an admin approves/changes them.
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        public.user_role   not null default 'student',
  status      public.user_status not null default 'pending',
  full_name   text not null default '',
  member_id   text unique,          -- enrollment number (students) / employee ID (faculty)
  department  text,                 -- e.g. Computer Science
  program     text,                 -- students, e.g. B.Tech CSE · Semester 1
  section     text,                 -- students, e.g. CSE-A
  title       text,                 -- faculty, e.g. Assistant Professor
  created_at  timestamptz not null default now()
);

create table public.courses (
  id          bigint generated always as identity primary key,
  code        text not null unique,          -- e.g. MA
  title       text not null,                 -- e.g. Engineering Mathematics
  department  text
);

-- Weekly timetable. day_of_week uses JavaScript numbering: 0 = Sunday ... 6 = Saturday.
create table public.timetable_slots (
  id           bigint generated always as identity primary key,
  section      text not null,
  day_of_week  smallint not null check (day_of_week between 0 and 6),
  start_time   time not null,
  end_time     time not null check (end_time > start_time),
  kind         text not null default 'class' check (kind in ('class', 'free')),
  course_id    bigint references public.courses(id) on delete cascade,
  faculty_id   uuid references public.profiles(id) on delete set null,
  room         text,
  label        text,                          -- title for free periods
  check (kind = 'free' or course_id is not null)
);
create index on public.timetable_slots (section, day_of_week);
create index on public.timetable_slots (faculty_id);

create table public.attendance (
  id          bigint generated always as identity primary key,
  course_id   bigint not null references public.courses(id) on delete cascade,
  section     text not null,
  class_date  date not null,
  student_id  uuid not null references public.profiles(id) on delete cascade,
  present     boolean not null,
  marked_by   uuid references public.profiles(id) on delete set null,
  marked_at   timestamptz not null default now(),
  unique (course_id, class_date, student_id)
);
create index on public.attendance (student_id);
create index on public.attendance (course_id, section, class_date);

create table public.notices (
  id           bigint generated always as identity primary key,
  title        text not null check (char_length(title) between 1 and 160),
  body         text not null default '' check (char_length(body) <= 2000),
  category     text not null default 'Academic' check (char_length(category) <= 40),
  audience     text not null default 'everyone' check (audience in ('everyone', 'students', 'faculty', 'section')),
  section      text,
  author_id    uuid references public.profiles(id) on delete set null default auth.uid(),
  author_name  text,                          -- filled automatically
  created_at   timestamptz not null default now(),
  check (audience <> 'section' or section is not null)
);
create index on public.notices (created_at desc);

create table public.assignments (
  id           bigint generated always as identity primary key,
  course_id    bigint not null references public.courses(id) on delete cascade,
  section      text not null,
  title        text not null check (char_length(title) between 1 and 160),
  description  text not null default '',
  due_at       timestamptz not null,
  created_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);

create table public.submissions (
  id             bigint generated always as identity primary key,
  assignment_id  bigint not null references public.assignments(id) on delete cascade,
  student_id     uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  submitted_at   timestamptz not null default now(),
  reviewed       boolean not null default false,
  unique (assignment_id, student_id)
);

create table public.activity_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  created_at  timestamptz not null default now()
);

-- ---------- Helper functions (used by the security rules) ----------
-- SECURITY DEFINER lets these read profiles without tripping profiles' own rules.
-- They return NULL / false for pending (unapproved) users, which locks them out of all data.

create function public.my_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and status = 'active'
$$;

create function public.my_section() returns text
language sql stable security definer set search_path = public as $$
  select section from profiles where id = auth.uid() and status = 'active'
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

-- Does the signed-in faculty member teach this course to this section?
create function public.teaches(p_course_id bigint, p_section text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() = 'faculty' and exists (
    select 1 from timetable_slots
    where faculty_id = auth.uid() and course_id = p_course_id and section = p_section)
$$;

-- Does the signed-in faculty member teach anything to this section?
create function public.teaches_section(p_section text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() = 'faculty' and exists (
    select 1 from timetable_slots where faculty_id = auth.uid() and section = p_section)
$$;

create function public.log_activity(p_action text) returns void
language sql security definer set search_path = public as $$
  insert into activity_log (actor_id, action) values (auth.uid(), p_action)
$$;

-- ---------- Triggers ----------

-- Create a profile for every new auth user. Role/status are NOT taken from sign-up
-- metadata, so nobody can make themselves faculty or admin.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Stamp the author's name on notices (so students can see who posted without reading profiles).
create function public.notices_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- From the website the author is always the signed-in user; in the SQL Editor
  -- (no signed-in user) the given author_id is kept, which the seed script uses.
  new.author_id := coalesce(auth.uid(), new.author_id);
  select full_name into new.author_name from profiles where id = new.author_id;
  return new;
end $$;
create trigger notices_before_insert before insert on public.notices
  for each row execute function public.notices_before_insert();

create function public.notices_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.log_activity(format('published a notice to %s: %s',
    case new.audience when 'section' then new.section else new.audience end, new.title));
  return null;
end $$;
create trigger notices_after_insert after insert on public.notices
  for each row execute function public.notices_after_insert();

create function public.profiles_after_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status = 'active' then
    perform public.log_activity(format('approved %s (%s)', new.full_name, new.role));
  elsif new.role is distinct from old.role then
    perform public.log_activity(format('changed %s''s role to %s', new.full_name, new.role));
  end if;
  return null;
end $$;
create trigger profiles_after_update after update on public.profiles
  for each row execute function public.profiles_after_update();

-- ---------- Row-level security ----------
alter table public.profiles        enable row level security;
alter table public.courses         enable row level security;
alter table public.timetable_slots enable row level security;
alter table public.attendance      enable row level security;
alter table public.notices         enable row level security;
alter table public.assignments     enable row level security;
alter table public.submissions     enable row level security;
alter table public.activity_log    enable row level security;

-- profiles: you see yourself; faculty and admins see everyone; only admins edit.
create policy "profiles: read own"        on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles: staff read all"  on public.profiles for select to authenticated using (public.my_role() in ('faculty', 'admin'));
create policy "profiles: admin update"    on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- courses: any approved user reads; admins manage.
create policy "courses: read"          on public.courses for select to authenticated using (public.my_role() is not null);
create policy "courses: admin manage"  on public.courses for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- timetable: students see their section, faculty see their own slots, admins see all.
create policy "timetable: read" on public.timetable_slots for select to authenticated using (
  public.is_admin()
  or faculty_id = auth.uid() and public.my_role() = 'faculty'
  or public.my_role() = 'student' and section = public.my_section());
create policy "timetable: admin manage" on public.timetable_slots for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- attendance: students see their own, faculty see classes they teach, admins see all.
-- Writing happens only through save_attendance() below.
create policy "attendance: read" on public.attendance for select to authenticated using (
  student_id = auth.uid() and public.my_role() = 'student'
  or public.teaches(course_id, section)
  or public.is_admin());

-- notices
create policy "notices: read" on public.notices for select to authenticated using (
  public.is_admin()
  or author_id = auth.uid()
  or public.my_role() is not null and audience = 'everyone'
  or audience = 'students' and public.my_role() = 'student'
  or audience = 'faculty'  and public.my_role() = 'faculty'
  or audience = 'section'  and (section = public.my_section() and public.my_role() = 'student' or public.teaches_section(section)));
create policy "notices: admin post" on public.notices for insert to authenticated with check (public.is_admin());
create policy "notices: faculty post to own sections" on public.notices for insert to authenticated
  with check (audience = 'section' and public.teaches_section(section));
create policy "notices: author or admin delete" on public.notices for delete to authenticated
  using (public.is_admin() or author_id = auth.uid() and public.my_role() is not null);

-- assignments
create policy "assignments: read" on public.assignments for select to authenticated using (
  public.is_admin()
  or public.teaches(course_id, section)
  or public.my_role() = 'student' and section = public.my_section());
create policy "assignments: faculty create" on public.assignments for insert to authenticated
  with check (public.teaches(course_id, section) and created_by = auth.uid());
create policy "assignments: admin manage" on public.assignments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "assignments: owner delete" on public.assignments for delete to authenticated
  using (created_by = auth.uid() and public.teaches(course_id, section));

-- submissions: students submit their own; the teacher reviews.
create policy "submissions: read" on public.submissions for select to authenticated using (
  student_id = auth.uid()
  or public.is_admin()
  or exists (select 1 from public.assignments a where a.id = assignment_id and public.teaches(a.course_id, a.section)));
create policy "submissions: student submit" on public.submissions for insert to authenticated with check (
  student_id = auth.uid() and reviewed = false and public.my_role() = 'student'
  and exists (select 1 from public.assignments a where a.id = assignment_id and a.section = public.my_section()));
create policy "submissions: teacher review" on public.submissions for update to authenticated
  using (public.is_admin() or exists (select 1 from public.assignments a where a.id = assignment_id and public.teaches(a.course_id, a.section)))
  with check (public.is_admin() or exists (select 1 from public.assignments a where a.id = assignment_id and public.teaches(a.course_id, a.section)));

-- activity log: admins read; written only by the functions above.
create policy "activity: admin read" on public.activity_log for select to authenticated using (public.is_admin());

-- ---------- RPC functions called from the website ----------

-- Faculty (for classes they teach) or admins save a class's attendance in one go.
-- p_records: [{"student_id": "...", "present": true}, ...]
create function public.save_attendance(p_course_id bigint, p_section text, p_date date, p_records jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not (public.is_admin() or public.teaches(p_course_id, p_section)) then
    raise exception 'You do not teach this class' using errcode = '42501';
  end if;
  if p_date > current_date then
    raise exception 'Cannot mark attendance for a future date';
  end if;
  insert into attendance (course_id, section, class_date, student_id, present, marked_by)
  select p_course_id, p_section, p_date, p.id, (r ->> 'present')::boolean, auth.uid()
  from jsonb_array_elements(p_records) r
  join profiles p on p.id = (r ->> 'student_id')::uuid and p.role = 'student' and p.section = p_section
  on conflict (course_id, class_date, student_id)
    do update set present = excluded.present, marked_by = excluded.marked_by, marked_at = now();
  get diagnostics n = row_count;
  perform public.log_activity(format('marked attendance for %s · %s (%s students)',
    p_section, (select code from courses where id = p_course_id), n));
  return n;
end $$;

-- A student's attendance per course.
create function public.my_attendance()
returns table (course_code text, course_title text, attended integer, total integer)
language sql stable security invoker set search_path = public as $$
  select c.code, c.title, count(*) filter (where a.present)::int, count(*)::int
  from attendance a join courses c on c.id = a.course_id
  where a.student_id = auth.uid()
  group by c.code, c.title
  order by c.title
$$;

-- Numbers for the admin console.
create function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  return jsonb_build_object(
    'students',       (select count(*) from profiles where role = 'student' and status = 'active'),
    'faculty',        (select count(*) from profiles where role = 'faculty' and status = 'active'),
    'pending',        (select count(*) from profiles where status = 'pending'),
    'departments',    (select count(distinct department) from profiles where department is not null),
    'total_users',    (select count(*) from profiles),
    'notices_week',   (select count(*) from notices where created_at > now() - interval '7 days'),
    'attendance_pct', (select round(100.0 * count(*) filter (where present) / nullif(count(*), 0)) from attendance
                       where class_date > current_date - 30),
    'marked_today',   (select count(distinct (course_id, section)) from attendance where class_date = current_date),
    'by_department',  coalesce((
        select jsonb_agg(d order by d.pct desc) from (
          select p.department as name,
                 round(100.0 * count(*) filter (where a.present) / count(*))::int as pct
          from attendance a join profiles p on p.id = a.student_id
          where a.class_date > current_date - 30 and p.department is not null
          group by p.department) d), '[]'::jsonb)
  );
end $$;

-- Only signed-in users may call the RPCs (the functions do their own checks too).
revoke execute on function public.save_attendance(bigint, text, date, jsonb) from public, anon;
revoke execute on function public.my_attendance() from public, anon;
revoke execute on function public.admin_overview() from public, anon;
revoke execute on function public.log_activity(text) from public, anon, authenticated;
grant execute on function public.save_attendance(bigint, text, date, jsonb) to authenticated;
grant execute on function public.my_attendance() to authenticated;
grant execute on function public.admin_overview() to authenticated;
