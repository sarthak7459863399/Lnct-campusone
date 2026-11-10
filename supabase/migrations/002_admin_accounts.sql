-- =====================================================================
-- CampusOne update 002: admin account management
-- Run ONCE in SQL Editor if you already ran schema.sql before this update.
-- (New installs don't need it: schema.sql already includes these changes.)
-- =====================================================================

-- Show each person's email in the admin console.
alter table public.profiles add column if not exists email text;
update public.profiles p set email = u.email
from auth.users u where u.id = p.id and p.email is distinct from u.email;

-- New accounts get their email copied into their profile.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, email)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)), new.email);
  return new;
end $$;

-- Keep the profile email in step if an email is changed in Supabase.
create or replace function public.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update profiles set email = new.email where id = new.id;
  return new;
end $$;
drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- Only log approvals/role changes made by a signed-in admin. Changes made by the
-- server (the admin-users function, or the SQL Editor) write their own log entry.
create or replace function public.profiles_after_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return null; end if;
  if new.status is distinct from old.status and new.status = 'active' then
    perform public.log_activity(format('approved %s (%s)', new.full_name, new.role));
  elsif new.role is distinct from old.role then
    perform public.log_activity(format('changed %s''s role to %s', new.full_name, new.role));
  end if;
  return null;
end $$;
