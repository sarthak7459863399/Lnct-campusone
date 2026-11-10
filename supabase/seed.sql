-- =====================================================================
-- CampusOne starter data
-- 1. First create three users in Supabase: Authentication -> Users -> Add user
--    -> "Create new user" (tick "Auto Confirm User"). One each for student, faculty, admin.
-- 2. Put their emails in the three lines below.
-- 3. Run this in SQL Editor. It sets their roles and adds a sample timetable,
--    notices, assignments and a month of attendance history.
-- Safe to run again: roles are re-applied, sample data is only added the first time.
-- =====================================================================
do $$
declare
  v_student_email text := 'student@example.com';   -- <-- change
  v_faculty_email text := 'faculty@example.com';   -- <-- change
  v_admin_email   text := 'admin@example.com';     -- <-- change

  v_student uuid; v_faculty uuid; v_admin uuid;
  c_ma bigint; c_ee bigint; c_ch bigint; c_eg bigint;
  d int;
begin
  select id into v_student from auth.users where lower(email) = lower(v_student_email);
  select id into v_faculty from auth.users where lower(email) = lower(v_faculty_email);
  select id into v_admin   from auth.users where lower(email) = lower(v_admin_email);
  if v_student is null then raise exception 'No user with email %. Create it first in Authentication -> Users.', v_student_email; end if;
  if v_faculty is null then raise exception 'No user with email %. Create it first in Authentication -> Users.', v_faculty_email; end if;
  if v_admin   is null then raise exception 'No user with email %. Create it first in Authentication -> Users.', v_admin_email; end if;

  -- Roles and profile details
  update profiles set role = 'student', status = 'active', full_name = 'Sarthak Gupta', member_id = '0103CS241001',
         department = 'Computer Science', program = 'B.Tech CSE · Semester 1', section = 'CSE-A' where id = v_student;
  update profiles set role = 'faculty', status = 'active', full_name = 'Prof. Neha Verma', member_id = 'FAC1024',
         department = 'Mathematics', title = 'Assistant Professor' where id = v_faculty;
  update profiles set role = 'admin', status = 'active', full_name = 'Campus Admin', member_id = 'ADM001',
         department = 'Administration' where id = v_admin;

  -- Courses
  insert into courses (code, title, department) values
    ('MA', 'Engineering Mathematics', 'Mathematics'),
    ('EE', 'Basic Electrical Engineering', 'Electrical'),
    ('CH', 'Engineering Chemistry', 'Chemistry'),
    ('EG', 'Engineering Graphics', 'Mechanical')
  on conflict (code) do nothing;
  select id into c_ma from courses where code = 'MA';
  select id into c_ee from courses where code = 'EE';
  select id into c_ch from courses where code = 'CH';
  select id into c_eg from courses where code = 'EG';

  if exists (select 1 from timetable_slots) then
    raise notice 'Timetable already exists, so sample data was not added again. Roles were updated.';
    return;
  end if;

  -- Timetable, Monday (1) to Saturday (6). The faculty user teaches Maths to CSE-A and CSE-B.
  for d in 1..6 loop
    insert into timetable_slots (section, day_of_week, start_time, end_time, kind, course_id, faculty_id, room, label) values
      ('CSE-A', d, '09:00', '10:00', 'class', c_ma, v_faculty, 'Room 204 · Block A', null),
      ('CSE-A', d, '10:00', '11:00', 'class', c_ee, null,      'Room 108 · Block B', null),
      ('CSE-A', d, '11:00', '12:00', 'free',  null, null,      null, 'Free period'),
      ('CSE-A', d, '12:00', '13:00', 'class', c_ch, null,      'Lab 2 · Block C', null),
      ('CSE-A', d, '14:00', '16:00', 'class', c_eg, null,      'Drawing Hall · Block D', null),
      ('CSE-B', d, '09:00', '10:00', 'class', c_ee, null,      'Room 110 · Block B', null),
      ('CSE-B', d, '10:00', '11:00', 'class', c_ch, null,      'Lab 1 · Block C', null),
      ('CSE-B', d, '11:00', '12:00', 'class', c_ma, v_faculty, 'Room 210 · Block A', null),
      ('CSE-B', d, '14:00', '16:00', 'class', c_eg, null,      'Drawing Hall · Block D', null);
  end loop;

  -- 30 days of attendance history for the student (roughly 85-90%, a bit lower in Graphics)
  insert into attendance (course_id, section, class_date, student_id, present, marked_by)
  select s.course_id, 'CSE-A', g::date, v_student,
         abs(hashtext(g::date::text || s.course_id::text)) % 100 >= case c.code when 'EG' then 24 else 9 end,
         s.faculty_id
  from generate_series(current_date - 30, current_date - 1, interval '1 day') g
  join timetable_slots s on s.section = 'CSE-A' and s.kind = 'class' and s.day_of_week = extract(dow from g)::int
  join courses c on c.id = s.course_id
  on conflict do nothing;

  -- Notices
  insert into notices (title, body, category, audience, section, author_id, created_at) values
    ('Mid-semester exam schedule', 'Check the department notice board for the updated exam plan.', 'Academic', 'students', null, v_admin, now() - interval '2 hours'),
    ('Student club registrations', 'Explore technical and cultural clubs for this semester.', 'Campus life', 'everyone', null, v_admin, now() - interval '2 days'),
    ('Bring graph sheets tomorrow', 'We will practise curve tracing in the Maths tutorial.', 'Class', 'section', 'CSE-A', v_faculty, now() - interval '1 day'),
    ('Faculty meeting on Friday', 'Department heads and faculty meet at 15:00 in the conference room.', 'Staff', 'faculty', null, v_admin, now() - interval '3 hours');

  -- Assignments
  insert into assignments (course_id, section, title, description, due_at, created_by) values
    (c_ma, 'CSE-A', 'Unit 1 problem set', 'Solve questions 1–20 from the Unit 1 sheet.', now() + interval '2 days', v_faculty),
    (c_ma, 'CSE-B', 'Matrices worksheet', 'Complete the matrices worksheet shared in class.', now() + interval '4 days', v_faculty),
    (c_ee, 'CSE-A', 'BEEE Unit 1 questions', 'Submit before the next practical session.', now() + interval '1 day', null);

  raise notice 'CampusOne sample data added.';
end $$;
