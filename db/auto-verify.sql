-- PasaU: students who confirm a school email get the verified badge automatically.
-- Confirming the emailed code already proves they're at that school, so no manual approval is needed.
-- Admins can still Unverify someone; the badge only comes back if they confirm a school email again.
-- Run AFTER db/school-email.sql and db/guardians.sql. Paste into Supabase Dashboard -> SQL Editor -> Run (once).

create or replace function public.verify_school_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is null or public.school_of_email(new.email) is null then return new; end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null and new.email is not distinct from old.email then return new; end if;
  update public.profiles set verified = true where id = new.id and role = 'student' and not verified;
  if found then
    update public.verification_requests set status = 'approved' where user_id = new.id and status = 'pending';
    insert into public.notifications (user_id, body) values (new.id, 'Your school email is confirmed, so you now have the verified student badge');
  end if;
  return new;
end $$;
revoke all on function public.verify_school_email() from public, anon, authenticated;

-- Named to run after on_auth_user_created, so the profile already exists
create or replace trigger pasau_verify_school_email
  after insert or update of email_confirmed_at, email on auth.users
  for each row execute function public.verify_school_email();

-- Students who already confirmed a school email get the badge now (no notification)
update public.profiles p set verified = true
from auth.users u
where u.id = p.id and p.role = 'student' and not p.verified
  and u.email_confirmed_at is not null and public.school_of_email(u.email) is not null;

-- Old name in admin notifications
create or replace function public.admin_set_user(p_user uuid, p_verified boolean default null, p_suspended boolean default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update public.profiles set verified = coalesce(p_verified, verified), suspended = coalesce(p_suspended, suspended) where id = p_user;
  if p_verified then
    update public.verification_requests set status = 'approved' where user_id = p_user and status = 'pending';
    insert into public.notifications (user_id, body) values (p_user, 'You''re now a verified student on PasaU');
  end if;
  if p_suspended then
    insert into public.notifications (user_id, body) values (p_user, 'Your account was suspended by the PasaU team');
  end if;
end $$;
