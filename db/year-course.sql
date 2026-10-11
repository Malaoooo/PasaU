-- Unicycle: add year level and course to profiles.
-- Run AFTER db/accounts.sql. Paste into Supabase Dashboard -> SQL Editor -> Run (once).

alter table public.profiles
  add column year_level text check (year_level in ('1st year', '2nd year', '3rd year', '4th year', '5th year', 'Graduate')),
  add column course text;

-- Same trigger as accounts.sql, now also saving year level and course from the sign-up form
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, school, year_level, course)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'school', ''),
    nullif(new.raw_user_meta_data->>'year_level', ''),
    nullif(new.raw_user_meta_data->>'course', '')
  );
  return new;
end $$;
