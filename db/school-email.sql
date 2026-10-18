-- PasaU: only school emails can make an account (e.g. juan@slu.edu.ph).
-- The sign-up form checks this too, but this is the real lock: Supabase refuses to create
-- (or switch an account to) an email whose domain isn't listed below.
-- Accounts that already exist keep working; only new sign-ups and email changes are checked.
-- Run AFTER db/year-course.sql. Paste into Supabase Dashboard -> SQL Editor -> Run (once).

-- Student email domains per school. Subdomains count too (e.ubaguio.edu matches ubaguio.edu).
-- Keep in sync with "domains" in universities.js. To add one later:
--   insert into public.school_email_domains values ('example.edu.ph', 'Full school name (CODE)');
create table if not exists public.school_email_domains (
  domain text primary key check (domain = lower(domain)),
  school text not null
);
alter table public.school_email_domains enable row level security; -- nobody reads it directly

insert into public.school_email_domains (domain, school) values
  ('uc-bcf.edu.ph', 'University of the Cordilleras (UC)'),
  ('ubaguio.edu',   'University of Baguio (UB)'),
  ('slu.edu.ph',    'Saint Louis University (SLU)'),
  ('up.edu.ph',     'University of the Philippines Baguio (UP Baguio)'),
  ('upb.edu.ph',    'University of the Philippines Baguio (UP Baguio)'),
  ('bcu.edu.ph',    'Baguio Central University (BCU)'),
  ('bsu.edu.ph',    'Benguet State University (BSU)'),
  ('pcc.edu.ph',    'Pines City Colleges (PCC)'),
  ('bct.edu.ph',    'Baguio College of Technology (BCT)')
on conflict (domain) do update set school = excluded.school;

-- The school an email belongs to, or null if it isn't a school email
create or replace function public.school_of_email(p_email text)
returns text language sql stable security definer set search_path = '' as $$
  select d.school from public.school_email_domains d
  where lower(split_part(p_email, '@', 2)) = d.domain
     or lower(split_part(p_email, '@', 2)) like '%.' || d.domain
  order by length(d.domain) desc
  limit 1;
$$;
revoke all on function public.school_of_email(text) from public, anon, authenticated;

create or replace function public.require_school_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.email is not distinct from old.email then return new; end if;
  if new.email is not null and public.school_of_email(new.email) is null then
    raise exception 'PasaU accounts need a school email (like you@slu.edu.ph)' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists require_school_email on auth.users;
create trigger require_school_email
  before insert or update of email on auth.users
  for each row execute function public.require_school_email();

-- Same as year-course.sql, but the school now comes from the email, not from the form
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, school, year_level, course)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(public.school_of_email(new.email), new.raw_user_meta_data->>'school', ''),
    nullif(new.raw_user_meta_data->>'year_level', ''),
    nullif(new.raw_user_meta_data->>'course', '')
  );
  return new;
end $$;
