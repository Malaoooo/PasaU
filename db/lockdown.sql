-- End of the pre-pilot test (2026-10-23): no new listings, Looking For posts or accounts.
-- Existing listings, edits, chats, reserves, swaps and meetups keep working; logins keep working.
-- Front end: lockdown.js shows the top bar and hides the buttons. This file is the server-side lock.
--
-- To reopen everything, run only this line (no need to remove the triggers):
--   create or replace function public.pasau_locked() returns boolean language sql stable as $$ select false $$;
-- and set LOCKED = false in lockdown.js.

-- The switch
create or replace function public.pasau_locked() returns boolean language sql stable as $$ select true $$;

-- New listings and Looking For posts
create or replace function public.pasau_block_new_posts()
returns trigger language plpgsql set search_path = '' as $$
begin
  if public.pasau_locked() then
    raise exception 'The pre-pilot test is over, so new listings and Looking For posts are paused.' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create or replace trigger pasau_lock_new_listings
  before insert on public.listings
  for each row execute function public.pasau_block_new_posts();

create or replace trigger pasau_lock_new_wanted
  before insert on public.wanted_posts
  for each row execute function public.pasau_block_new_posts();

-- New accounts (students and parents). Existing accounts can still log in and confirm their email.
create or replace function public.pasau_block_new_accounts()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.pasau_locked() then
    raise exception 'New PasaU accounts are paused for now.' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create or replace trigger pasau_lock_new_accounts
  before insert on auth.users
  for each row execute function public.pasau_block_new_accounts();
