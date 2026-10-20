-- PasaU: fixes from the 2026-10-20 security check. Four small pieces; run each on its own
-- (Supabase Dashboard -> SQL Editor -> Run). Pieces 2 and 3 are safe to run again; 1 and 4 run once.

-- Piece 1: listings the PasaU team removed (or the owner hid) stop showing up for strangers through the API.
-- The seller, an admin, and buyers who already chatted, reserved or traded on it still see it, so chats and history keep their titles.
alter policy "anyone browses listings" on public.listings
  using (status <> 'removed' or seller_id = auth.uid());
create policy "admins and buyers see removed listings" on public.listings for select to authenticated
  using (
    public.is_admin()
    or reserved_by = auth.uid()
    or exists (select 1 from public.conversations c where c.listing_id = listings.id and c.buyer_id = auth.uid())
    or exists (select 1 from public.transactions t where t.listing_id = listings.id and t.buyer_id = auth.uid())
  );

-- Piece 2: students can only fill in the fields the forms show. Before this, a hand-made request could
-- post a listing already "sold", with fake views, pinned to the top forever (bumped_at in 2099),
-- file an offer as "accepted", a report as "resolved", or backdate messages and PasaMatch posts.
revoke insert on public.listings from authenticated;
grant insert (seller_id, title, category, price_php, retail_php, size, condition, pickup_spot, description,
  kind, swap_for, school, college, program, course_code, year_level) on public.listings to authenticated;
revoke insert, update on public.offers from authenticated;
grant insert (listing_id, buyer_id, amount_php, offered_listing_id) on public.offers to authenticated;
revoke insert on public.reports from authenticated;
grant insert (reporter_id, listing_id, reported_user_id, reason, details) on public.reports to authenticated;
revoke insert on public.verification_requests from authenticated;
grant insert (user_id, school_email, note) on public.verification_requests to authenticated;
revoke insert on public.wanted_posts from authenticated;
grant insert (user_id, title, category, school, max_price_php) on public.wanted_posts to authenticated;
revoke insert on public.messages from authenticated;
grant insert (conversation_id, sender_id, body, photo_path) on public.messages to authenticated;
revoke update on public.notifications from authenticated;
grant update (read) on public.notifications to authenticated;

-- Piece 3: logged-out visitors can no longer call the signed-in-only functions (Security Advisor warning).
-- The three a visitor needs (view counter, queue size, parent invite check) stay open.
-- Trigger functions in the advisor list can't be called as /rpc at all, so they are left alone.
revoke execute on function
  public.accept_offer(bigint), public.cancel_meetup(bigint), public.renew_listing(bigint),
  public.set_listing_status(bigint, text), public.unread_counts(), public.is_admin(),
  public.is_blocked(uuid, uuid), public.is_guardian(), public.is_suspended(), public.mfa_ok()
from public, anon;

-- Piece 4: admin powers need the two-step code once an admin turns two-step login on,
-- and profile photos must come from PasaU's own avatars folder (no outside tracking images).
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false) and public.mfa_ok();
$$;
alter table public.profiles add constraint avatar_from_pasau check (
  avatar_url is null or avatar_url like 'https://rwxuygrbulskexgejbhm.supabase.co/storage/v1/object/public/avatars/%'
);
