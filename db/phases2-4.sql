-- Unicycle Phases 2–4: profiles & settings, listing management, transactions & history,
-- queue visibility, more notifications, unread messages, Looking For replies, vouches,
-- verification, admin tools.
-- Run AFTER phase1.sql. Supabase Dashboard -> SQL Editor -> paste -> Run (once).
-- If anything fails, nothing is applied: send the error and run again after the fix.
-- Optional afterwards: db/reminders.sql (meetup reminders, needs the pg_cron extension).

-- =====================================================================
-- Profiles: photo, privacy, notification settings, verification, admin
-- =====================================================================
alter table profiles
  add column avatar_url text,
  add column show_full_name boolean not null default true,
  add column show_course_year boolean not null default true,
  add column notify_prefs jsonb not null default '{}'::jsonb,
  add column verified boolean not null default false,
  add column is_admin boolean not null default false,
  add column suspended boolean not null default false;

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = '' stable as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;
create or replace function public.is_suspended()
returns boolean language sql security definer set search_path = '' stable as $$
  select coalesce((select suspended from public.profiles where id = auth.uid()), false);
$$;
grant execute on function public.is_admin, public.is_suspended to authenticated;

-- Students read their own row in full; everyone else goes through public_profiles (privacy applied)
drop policy "students see profiles" on profiles;
create policy "see your own profile" on profiles for select to authenticated using (auth.uid() = id);
create policy "admins see all profiles" on profiles for select to authenticated using (public.is_admin());

-- Students may edit only these columns (not verified / is_admin / suspended)
revoke insert, update on profiles from authenticated;
grant update (full_name, school, course, year_level, avatar_url, show_full_name, show_course_year, notify_prefs) on profiles to authenticated;

-- Vouches (defined here so the public profile can count them)
create table vouches (
  voucher_id uuid not null default auth.uid() references profiles on delete cascade,
  vouchee_id uuid not null references profiles on delete cascade,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  primary key (voucher_id, vouchee_id),
  check (voucher_id <> vouchee_id)
);

create view public.public_profiles as
  select p.id,
    case when p.show_full_name or position(' ' in trim(p.full_name)) = 0 then trim(p.full_name)
         else split_part(trim(p.full_name), ' ', 1) || ' ' || left(reverse(split_part(reverse(trim(p.full_name)), ' ', 1)), 1) || '.'
    end as display_name,
    p.avatar_url, p.school,
    case when p.show_course_year then p.course end as course,
    case when p.show_course_year then p.year_level end as year_level,
    p.verified, p.created_at,
    (select count(*) from public.vouches v where v.vouchee_id = p.id)::int as vouch_count
  from public.profiles p
  where not p.suspended;
grant select on public.public_profiles to authenticated;

-- Profile photos: public bucket, each person writes only inside their own folder
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy "upload own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "replace own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Suspended accounts can't post, message or offer (restrictive policies add to the existing ones)
create policy "not suspended" on listings as restrictive for insert to authenticated with check (not public.is_suspended());
create policy "not suspended" on messages as restrictive for insert to authenticated with check (not public.is_suspended());
create policy "not suspended" on conversations as restrictive for insert to authenticated with check (not public.is_suspended());
create policy "not suspended" on wanted_posts as restrictive for insert to authenticated with check (not public.is_suspended());
create policy "not suspended" on offers as restrictive for insert to authenticated with check (not public.is_suspended());

-- Verification requests (an admin approves them)
create table verification_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references profiles on delete cascade,
  school_email text,
  note text check (char_length(note) <= 300),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);
alter table verification_requests enable row level security;
create policy "request verification" on verification_requests for insert to authenticated with check (auth.uid() = user_id);
create policy "see own requests" on verification_requests for select to authenticated using (auth.uid() = user_id or public.is_admin());
grant select, insert on verification_requests to authenticated;

-- =====================================================================
-- Listing management: views, renew, removed status, seller sees the queue
-- =====================================================================
alter type listing_status add value if not exists 'removed';
alter table listings
  add column views int not null default 0,
  add column bumped_at timestamptz not null default now();
update listings set bumped_at = created_at;
create index on listings (bumped_at desc);

-- Sellers can't edit a listing the team removed
drop policy "sellers edit own listings" on listings;
create policy "sellers edit own listings" on listings for update to authenticated
  using (auth.uid() = seller_id and status::text <> 'removed');

create or replace function public.bump_view(p_listing bigint)
returns void language sql security definer set search_path = '' as $$
  update public.listings set views = views + 1 where id = p_listing and seller_id is distinct from auth.uid();
$$;
grant execute on function public.bump_view to anon, authenticated;

create or replace function public.renew_listing(p_listing bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.listings set bumped_at = now()
  where id = p_listing and seller_id = auth.uid() and status in ('active', 'reserved');
  if not found then raise exception 'Only the seller can renew an active listing'; end if;
end $$;
grant execute on function public.renew_listing to authenticated;

create policy "seller sees the queue" on queue_entries for select to authenticated
  using (exists (select 1 from listings l where l.id = listing_id and l.seller_id = auth.uid()));

-- =====================================================================
-- Transactions: Reserved -> Meetup -> Completed (or Cancelled)
-- =====================================================================
create table transactions (
  id bigint generated always as identity primary key,
  listing_id bigint not null references listings on delete cascade,
  buyer_id uuid not null references profiles on delete cascade,
  seller_id uuid not null references profiles on delete cascade,
  kind listing_kind not null,
  price_php int,
  swap_listing_id bigint references listings on delete set null,
  status text not null default 'reserved' check (status in ('reserved', 'meetup', 'completed', 'cancelled')),
  cancelled_by uuid references profiles on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index transactions_one_open on transactions (listing_id) where status in ('reserved', 'meetup');
alter table transactions enable row level security;
create policy "participants see transactions" on transactions for select to authenticated
  using (auth.uid() in (buyer_id, seller_id) or public.is_admin());
grant select on transactions to authenticated;

create or replace function public.open_tx(p_listing bigint, p_buyer uuid, p_swap bigint default null)
returns void language plpgsql security definer set search_path = '' as $$
declare l public.listings;
begin
  select * into l from public.listings where id = p_listing;
  insert into public.transactions (listing_id, buyer_id, seller_id, kind, price_php, swap_listing_id)
  values (p_listing, p_buyer, l.seller_id, l.kind, case when l.kind = 'sell' then l.price_php end, p_swap)
  on conflict (listing_id) where status in ('reserved', 'meetup') do nothing;
end $$;
create or replace function public.set_tx(p_listing bigint, p_status text, p_by uuid default null)
returns void language sql security definer set search_path = '' as $$
  update public.transactions
  set status = p_status, updated_at = now(), cancelled_by = case when p_status = 'cancelled' then p_by end
  where listing_id = p_listing and status in ('reserved', 'meetup');
$$;
revoke execute on function public.open_tx, public.set_tx from public, anon, authenticated;

-- Reserve if free to take, otherwise join the queue
create or replace function public.claim_listing(p_listing bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare l public.listings; me uuid := auth.uid(); pos int;
begin
  if me is null then raise exception 'Log in first'; end if;
  if public.is_suspended() then raise exception 'Your account is suspended'; end if;
  select * into l from public.listings where id = p_listing for update;
  if not found then raise exception 'Listing not found'; end if;
  if l.seller_id = me then raise exception 'This is your own listing'; end if;
  if public.is_blocked(me, l.seller_id) then raise exception 'You can''t reserve from this seller'; end if;
  if l.status not in ('active', 'reserved') then raise exception 'This item is no longer available'; end if;
  if l.reserved_by = me then return jsonb_build_object('state', 'reserved'); end if;
  if l.status = 'active' then
    update public.listings set status = 'reserved', reserved_by = me where id = p_listing;
    perform public.open_tx(p_listing, me);
    insert into public.notifications (user_id, body, listing_id)
    values (l.seller_id, 'Someone reserved "' || l.title || '"', l.id);
    return jsonb_build_object('state', 'reserved');
  end if;
  insert into public.queue_entries (listing_id, user_id) values (p_listing, me) on conflict do nothing;
  select count(*) into pos from public.queue_entries q
  where q.listing_id = p_listing
    and q.created_at <= (select created_at from public.queue_entries where listing_id = p_listing and user_id = me);
  return jsonb_build_object('state', 'queued', 'position', pos);
end $$;

-- Buyer backs out (or seller releases a no-show): offer it to the next person automatically
create or replace function public.release_reservation(p_listing bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare l public.listings; nxt uuid; me uuid := auth.uid();
begin
  select * into l from public.listings where id = p_listing for update;
  if not found then raise exception 'Listing not found'; end if;
  if me is distinct from l.reserved_by and me is distinct from l.seller_id then raise exception 'Not allowed'; end if;
  update public.meetups set status = 'cancelled' where listing_id = p_listing and status in ('proposed', 'accepted');
  perform public.set_tx(p_listing, 'cancelled', me);
  select user_id into nxt from public.queue_entries where listing_id = p_listing order by created_at limit 1;
  if nxt is null then
    update public.listings set status = 'active', reserved_by = null where id = p_listing;
  else
    delete from public.queue_entries where listing_id = p_listing and user_id = nxt;
    update public.listings set reserved_by = nxt where id = p_listing;
    perform public.open_tx(p_listing, nxt);
    insert into public.notifications (user_id, body, listing_id)
    values (nxt, 'Your turn: "' || l.title || '" is now reserved for you', p_listing);
  end if;
  if me = l.reserved_by then
    insert into public.notifications (user_id, body, listing_id)
    values (l.seller_id, 'The buyer backed out of "' || l.title || '"', p_listing);
  elsif l.reserved_by is not null then
    insert into public.notifications (user_id, body, listing_id)
    values (l.reserved_by, 'The seller released your reservation for "' || l.title || '"', p_listing);
  end if;
end $$;

create or replace function public.accept_meetup(p_meetup bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.meetups;
begin
  select * into m from public.meetups where id = p_meetup;
  if auth.uid() not in (m.buyer_id, m.seller_id) or auth.uid() = m.proposed_by then raise exception 'Not allowed'; end if;
  if m.status <> 'proposed' then raise exception 'This meetup is no longer open'; end if;
  update public.meetups set status = 'accepted' where id = p_meetup;
  update public.transactions set status = 'meetup', updated_at = now()
  where listing_id = m.listing_id and status = 'reserved';
  perform public.post_meetup_message(m.listing_id, m.buyer_id, auth.uid(), m.id,
    'Meetup accepted: ' || m.spot || ', ' || to_char(m.meet_at at time zone 'Asia/Manila', 'Mon DD, HH12:MI AM'));
end $$;

-- Either side cancels the current meetup (the reservation stays)
create or replace function public.cancel_meetup(p_meetup bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.meetups;
begin
  select * into m from public.meetups where id = p_meetup;
  if auth.uid() not in (m.buyer_id, m.seller_id) then raise exception 'Not allowed'; end if;
  if m.status not in ('proposed', 'accepted') then raise exception 'This meetup is already closed'; end if;
  update public.meetups set status = 'cancelled' where id = p_meetup;
  update public.transactions set status = 'reserved', updated_at = now()
  where listing_id = m.listing_id and status = 'meetup';
  perform public.post_meetup_message(m.listing_id, m.buyer_id, auth.uid(), m.id, 'Meetup cancelled. Suggest a new time when you''re ready.');
end $$;
grant execute on function public.cancel_meetup to authenticated;

-- Seller types the buyer's code at the handover: transaction completed, item sold
create or replace function public.confirm_handover(p_meetup bigint, p_code text)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.meetups; t text;
begin
  select * into m from public.meetups where id = p_meetup;
  if auth.uid() is distinct from m.seller_id then raise exception 'Only the seller confirms the handover'; end if;
  if m.status <> 'accepted' then raise exception 'Accept the meetup first'; end if;
  if not exists (select 1 from public.meetup_codes where meetup_id = p_meetup and code = trim(p_code)) then
    raise exception 'That code does not match. Ask the buyer to read it again.';
  end if;
  select title into t from public.listings where id = m.listing_id;
  perform set_config('unicycle.bulk', 'on', true);
  update public.meetups set status = 'done' where id = p_meetup;
  update public.listings set status = 'sold' where id = m.listing_id;
  perform public.set_tx(m.listing_id, 'completed');
  insert into public.notifications (user_id, body, listing_id)
  select user_id, 'Sold: "' || t || '" went to someone ahead of you', m.listing_id from public.queue_entries where listing_id = m.listing_id;
  delete from public.queue_entries where listing_id = m.listing_id;
  perform public.post_meetup_message(m.listing_id, m.buyer_id, m.seller_id, m.id, 'Handover confirmed. Item marked as sold.');
end $$;

-- Seller accepts a swap offer: reserve for that buyer and open a transaction
create or replace function public.accept_offer(p_offer bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.offers; l public.listings;
begin
  select * into o from public.offers where id = p_offer;
  select * into l from public.listings where id = o.listing_id for update;
  if l.seller_id is distinct from auth.uid() then raise exception 'Only the seller can accept offers'; end if;
  if l.status <> 'active' then raise exception 'This item is already reserved'; end if;
  update public.offers set status = 'accepted' where id = p_offer;
  update public.offers set status = 'declined' where listing_id = o.listing_id and id <> p_offer and status = 'pending';
  update public.listings set status = 'reserved', reserved_by = o.buyer_id where id = o.listing_id;
  perform public.open_tx(o.listing_id, o.buyer_id, o.offered_listing_id);
  insert into public.notifications (user_id, body, listing_id)
  values (o.buyer_id, 'Your offer for "' || l.title || '" was accepted. Arrange a meetup.', l.id);
end $$;
grant execute on function public.accept_offer to authenticated;

-- Seller marks a listing Available / Reserved / Sold
create or replace function public.set_listing_status(p_listing bigint, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare l public.listings; me uuid := auth.uid();
begin
  select * into l from public.listings where id = p_listing for update;
  if l.seller_id is distinct from me then raise exception 'Only the seller can change this listing'; end if;
  if l.status = 'removed' then raise exception 'This listing was removed by the Unicycle team'; end if;
  if p_status = 'sold' then
    perform set_config('unicycle.bulk', 'on', true);
    update public.meetups set status = 'cancelled' where listing_id = p_listing and status in ('proposed', 'accepted');
    perform public.set_tx(p_listing, 'completed');
    insert into public.notifications (user_id, body, listing_id)
    select user_id, 'Sold: "' || l.title || '" is no longer available', p_listing from public.queue_entries where listing_id = p_listing;
    delete from public.queue_entries where listing_id = p_listing;
    update public.listings set status = 'sold' where id = p_listing;
  elsif p_status = 'active' then
    if l.reserved_by is not null then
      perform public.release_reservation(p_listing);
    else
      update public.listings set status = 'active' where id = p_listing;
    end if;
  elsif p_status = 'reserved' then
    update public.listings set status = 'reserved' where id = p_listing;
  else
    raise exception 'Unknown status';
  end if;
end $$;
grant execute on function public.set_listing_status to authenticated;

-- =====================================================================
-- Notifications: who's interested, queue moves, saved-item changes, settings
-- =====================================================================
alter table notifications add column kind text not null default 'listings';
alter table meetups add column reminded_at timestamptz;

-- Classify every notification and drop it if the person turned that kind off
create or replace function public.notification_prefs()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.kind := case
    when new.body like 'New message%' then 'messages'
    when new.body like 'Meetup%' or new.body like 'Your meetup%' or new.body like 'Handover%' or new.body like 'Reminder:%' then 'meetups'
    when new.body like 'You moved up%' or new.body like 'Your turn%' then 'queue'
    when new.body like 'Back available%' or new.body like 'Price %' or new.body like 'Sold:%' then 'saved'
    when new.body like '%Looking For%' then 'wanted'
    else 'listings' end;
  if coalesce((select notify_prefs ->> new.kind from public.profiles where id = new.user_id), 'true') = 'false' then
    return null;
  end if;
  return new;
end $$;
create trigger notification_prefs before insert on public.notifications
  for each row execute function public.notification_prefs();

-- Someone starts a chat about your item
create or replace function public.notify_interest()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, body, listing_id)
  select new.seller_id, 'Someone is interested in "' || l.title || '"', l.id from public.listings l where l.id = new.listing_id;
  return new;
end $$;
create trigger notify_interest after insert on public.conversations
  for each row execute function public.notify_interest();

-- Someone joins the line for your item
create or replace function public.notify_queue_join()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, body, listing_id)
  select l.seller_id, 'Someone joined the line for "' || l.title || '"', l.id from public.listings l where l.id = new.listing_id;
  return new;
end $$;
create trigger notify_queue_join after insert on public.queue_entries
  for each row execute function public.notify_queue_join();

-- Someone ahead of you leaves the line: everyone behind moves up
create or replace function public.queue_moved()
returns trigger language plpgsql security definer set search_path = '' as $$
declare t text; r record;
begin
  if coalesce(current_setting('unicycle.bulk', true), '') = 'on' then return old; end if;
  select title into t from public.listings where id = old.listing_id;
  for r in
    select q.user_id,
      (select count(*) from public.queue_entries q2 where q2.listing_id = q.listing_id and q2.created_at <= q.created_at) as pos
    from public.queue_entries q where q.listing_id = old.listing_id and q.created_at > old.created_at
  loop
    insert into public.notifications (user_id, body, listing_id)
    values (r.user_id, 'You moved up to #' || r.pos || ' in line for "' || t || '"', old.listing_id);
  end loop;
  return old;
end $$;
create trigger queue_moved after delete on public.queue_entries
  for each row execute function public.queue_moved();

-- Saved items: back available, sold, price changes
create or replace function public.notify_savers()
returns trigger language plpgsql security definer set search_path = '' as $$
declare msg text;
begin
  if new.status = 'active' and old.status = 'reserved' then msg := 'Back available: "' || new.title || '"';
  elsif new.status = 'sold' and old.status <> 'sold' then msg := 'Sold: "' || new.title || '" is gone';
  elsif new.kind = 'sell' and new.price_php < old.price_php then msg := 'Price drop: "' || new.title || '" is now ₱' || new.price_php;
  elsif new.kind = 'sell' and new.price_php <> old.price_php then msg := 'Price changed: "' || new.title || '" is now ₱' || new.price_php;
  end if;
  if msg is null then return new; end if;
  insert into public.notifications (user_id, body, listing_id)
  select s.user_id, msg, new.id from public.saves s
  where s.listing_id = new.id and s.user_id <> new.seller_id and s.user_id is distinct from new.reserved_by;
  return new;
end $$;
create trigger notify_savers after update of status, price_php on public.listings
  for each row execute function public.notify_savers();

-- =====================================================================
-- Unread messages
-- =====================================================================
create table conversation_reads (
  user_id uuid not null default auth.uid() references profiles on delete cascade,
  conversation_id bigint not null references conversations on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, conversation_id)
);
alter table conversation_reads enable row level security;
create policy "own read markers" on conversation_reads for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update on conversation_reads to authenticated;

create or replace function public.unread_counts()
returns table (conversation_id bigint, unread int) language sql security definer set search_path = '' stable as $$
  select m.conversation_id, count(*)::int
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  left join public.conversation_reads r on r.conversation_id = m.conversation_id and r.user_id = auth.uid()
  where auth.uid() in (c.buyer_id, c.seller_id)
    and m.sender_id <> auth.uid()
    and m.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz)
  group by m.conversation_id;
$$;
grant execute on function public.unread_counts to authenticated;

-- =====================================================================
-- Looking For replies: "I have this" links one of your listings
-- =====================================================================
create table wanted_replies (
  id bigint generated always as identity primary key,
  wanted_id bigint not null references wanted_posts on delete cascade,
  user_id uuid not null default auth.uid() references profiles on delete cascade,
  listing_id bigint not null references listings on delete cascade,
  created_at timestamptz not null default now(),
  unique (wanted_id, listing_id)
);
alter table wanted_replies enable row level security;
create policy "reply with your own listing" on wanted_replies for insert to authenticated with check (
  auth.uid() = user_id and exists (select 1 from listings l where l.id = listing_id and l.seller_id = auth.uid())
);
create policy "poster and replier see replies" on wanted_replies for select to authenticated using (
  auth.uid() = user_id or exists (select 1 from wanted_posts w where w.id = wanted_id and w.user_id = auth.uid())
);
grant select, insert on wanted_replies to authenticated;

create or replace function public.notify_wanted_reply()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, body, listing_id)
  select w.user_id, 'Someone has a match for your Looking For post "' || w.title || '": ' || l.title, l.id
  from public.wanted_posts w, public.listings l
  where w.id = new.wanted_id and l.id = new.listing_id and w.user_id <> new.user_id;
  return new;
end $$;
create trigger notify_wanted_reply after insert on public.wanted_replies
  for each row execute function public.notify_wanted_reply();

-- =====================================================================
-- Vouches: only after a completed handover together
-- =====================================================================
alter table vouches enable row level security;
create policy "anyone signed in sees vouches" on vouches for select to authenticated using (true);
create policy "vouch after a completed handover" on vouches for insert to authenticated with check (
  auth.uid() = voucher_id and exists (
    select 1 from transactions t where t.status = 'completed'
      and ((t.buyer_id = auth.uid() and t.seller_id = vouchee_id) or (t.seller_id = auth.uid() and t.buyer_id = vouchee_id)))
);
create policy "take back your vouch" on vouches for delete to authenticated using (auth.uid() = voucher_id);
grant select, insert, delete on vouches to authenticated;

create or replace function public.notify_vouch()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, body) values (new.vouchee_id, 'Someone vouched for you');
  return new;
end $$;
create trigger notify_vouch after insert on public.vouches
  for each row execute function public.notify_vouch();

-- =====================================================================
-- Admin tools (set yourself as admin: see the bottom of this file)
-- =====================================================================
create policy "admins see reports" on reports for select to authenticated using (public.is_admin());

create or replace function public.admin_stats()
returns jsonb language plpgsql security definer set search_path = '' stable as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'verified', (select count(*) from public.profiles where verified),
    'active_listings', (select count(*) from public.listings where status = 'active'),
    'reserved_listings', (select count(*) from public.listings where status = 'reserved'),
    'sold_listings', (select count(*) from public.listings where status = 'sold'),
    'completed_transactions', (select count(*) from public.transactions where status = 'completed'),
    'cancelled_transactions', (select count(*) from public.transactions where status = 'cancelled'),
    'open_reports', (select count(*) from public.reports where status in ('open', 'reviewing')),
    'pending_verifications', (select count(*) from public.verification_requests where status = 'pending'),
    'messages', (select count(*) from public.messages)
  );
end $$;

create or replace function public.admin_set_user(p_user uuid, p_verified boolean default null, p_suspended boolean default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update public.profiles set verified = coalesce(p_verified, verified), suspended = coalesce(p_suspended, suspended) where id = p_user;
  if p_verified then
    update public.verification_requests set status = 'approved' where user_id = p_user and status = 'pending';
    insert into public.notifications (user_id, body) values (p_user, 'You''re now a verified student on Unicycle');
  end if;
  if p_suspended then
    insert into public.notifications (user_id, body) values (p_user, 'Your account was suspended by the Unicycle team');
  end if;
end $$;

create or replace function public.admin_reject_verification(p_request bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update public.verification_requests set status = 'rejected' where id = p_request;
end $$;

create or replace function public.admin_remove_listing(p_listing bigint, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare l public.listings;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select * into l from public.listings where id = p_listing;
  perform set_config('unicycle.bulk', 'on', true);
  update public.meetups set status = 'cancelled' where listing_id = p_listing and status in ('proposed', 'accepted');
  perform public.set_tx(p_listing, 'cancelled');
  delete from public.queue_entries where listing_id = p_listing;
  update public.listings set status = 'removed', reserved_by = null where id = p_listing;
  update public.reports set status = 'resolved' where listing_id = p_listing and status in ('open', 'reviewing');
  insert into public.notifications (user_id, body, listing_id)
  values (l.seller_id, 'Your listing "' || l.title || '" was removed by the Unicycle team: ' || coalesce(p_reason, 'against the rules'), p_listing);
end $$;

create or replace function public.admin_set_report(p_report bigint, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update public.reports set status = p_status where id = p_report;
end $$;

revoke execute on function public.admin_stats, public.admin_set_user, public.admin_reject_verification,
  public.admin_remove_listing, public.admin_set_report from public, anon;
grant execute on function public.admin_stats, public.admin_set_user, public.admin_reject_verification,
  public.admin_remove_listing, public.admin_set_report to authenticated;

-- Live updates for the admin dashboard aren't needed; notifications/messages are already published.

-- =====================================================================
-- Make yourself an admin (run separately, with YOUR account email):
--   update public.profiles set is_admin = true
--   where id = (select id from auth.users where email = 'you@example.com');
-- =====================================================================
