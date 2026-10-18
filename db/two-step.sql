-- PasaU: two-step login (authenticator app). The site asks for the 6-digit code after the password;
-- this is the real lock: an account that turned two-step login on can't read or change anything
-- with a password-only session (aal1). Accounts without it work exactly as before.
-- Run AFTER db/school-email.sql. Paste into Supabase Dashboard -> SQL Editor -> Run (safe to run again,
-- and again after adding a new table, to cover that table too).

-- True when this session passed two-step login, or the account doesn't use it
create or replace function public.mfa_ok()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
$$;
grant execute on function public.mfa_ok() to authenticated;

-- A restrictive policy is ANDed with every other policy on the table, so this adds the check everywhere
do $$
declare t text;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'two-step login') then
      execute format('create policy "two-step login" on public.%I as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()))', t);
    end if;
  end loop;
end $$;
