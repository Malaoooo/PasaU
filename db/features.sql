-- Unicycle features F1–F10 (no boosting).
-- Run AFTER schema.sql, accounts.sql and year-course.sql.
-- Supabase Dashboard -> SQL Editor -> paste -> Run (once).
-- Before running: Storage -> New bucket "chat-photos" (PRIVATE, 5 MB, image types).

-- ============ F1 / F5: categories, conditions, course tags ============
alter type category add value if not exists 'lab_art';
alter type category add value if not exists 'electronics';
alter type category add value if not exists 'dorm';
alter type category add value if not exists 'others';

create type listing_kind as enum ('sell', 'free', 'swap');

alter table listings
  add column kind listing_kind not null default 'sell',
  add column swap_for text,
  add column school text,
  add column college text,
  add column program text,
  add column course_code text,
  add column year_level text,
  add column reserved_by uuid references profiles on delete set null;

update listings set condition = 'Used' where condition not in ('New', 'Like new', 'Used', 'Worn');
alter table listings add constraint listings_condition_check check (condition in ('New', 'Like new', 'Used', 'Worn'));

-- F2: free items cost ₱0
alter table listings drop constraint listings_price_php_check;
alter table listings add constraint listings_price_check check (price_php >= 0 and (kind <> 'free' or price_php = 0));

-- F6: every listing carries its seller's school
update listings l set school = p.school from profiles p where p.id = l.seller_id and l.school is null;

create or replace function public.listing_defaults()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.school is null then
    select school into new.school from public.profiles where id = new.seller_id;
  end if;
  if new.kind = 'free' then new.price_php := 0; end if;
  return new;
end $$;
create trigger listing_defaults before insert on public.listings
  for each row execute function public.listing_defaults();

-- ============ F3: swap offers ============
alter table offers
  alter column amount_php drop not null,
  add column offered_listing_id bigint references listings on delete cascade,
  add constraint offers_has_something check (amount_php is not null or offered_listing_id is not null);

drop policy "buyers make offers" on offers;
create policy "buyers make offers" on offers for insert to authenticated with check (
  auth.uid() = buyer_id
  and (offered_listing_id is null
       or exists (select 1 from listings where id = offered_listing_id and seller_id = auth.uid()))
);

-- ============ Notifications (used by F4, F8, F9, F10) ============
create table notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles on delete cascade,
  body text not null,
  listing_id bigint references listings on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table notifications enable row level security;
create policy "own notifications" on notifications for select to authenticated using (auth.uid() = user_id);
create policy "mark own read" on notifications for update to authenticated using (auth.uid() = user_id);

-- ============ F4: Looking For posts ============
create table wanted_posts (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles on delete cascade default auth.uid(),
  title text not null,
  category category,
  school text,
  max_price_php int check (max_price_php >= 0),
  created_at timestamptz not null default now()
);
alter table wanted_posts enable row level security;
create policy "anyone reads wanted posts" on wanted_posts for select using (true);
create policy "post own wanted" on wanted_posts for insert to authenticated with check (auth.uid() = user_id);
create policy "delete own wanted" on wanted_posts for delete to authenticated using (auth.uid() = user_id);

-- New listing -> notify posters whose wanted title shares a word (3+ letters) with it
create or replace function public.notify_wanted()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, body, listing_id)
  select w.user_id, 'New listing for your Looking For post "' || w.title || '": ' || new.title, new.id
  from public.wanted_posts w
  where w.user_id <> new.seller_id
    and (w.category is null or w.category = new.category)
    and (w.school is null or w.school = new.school)
    and (w.max_price_php is null or new.price_php <= w.max_price_php)
    and exists (
      select 1 from regexp_split_to_table(lower(w.title), '\s+') word
      where length(word) >= 3 and lower(new.title) like '%' || word || '%'
    );
  return new;
end $$;
create trigger notify_wanted after insert on public.listings
  for each row execute function public.notify_wanted();

-- ============ F8: chat ============
create table conversations (
  id bigint generated always as identity primary key,
  listing_id bigint not null references listings on delete cascade,
  buyer_id uuid not null references profiles on delete cascade,
  seller_id uuid not null references profiles on delete cascade,
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_id)
);
create table messages (
  id bigint generated always as identity primary key,
  conversation_id bigint not null references conversations on delete cascade,
  sender_id uuid not null references profiles on delete cascade default auth.uid(),
  body text,
  photo_path text,
  created_at timestamptz not null default now(),
  check (body is not null or photo_path is not null)
);
create index on messages (conversation_id, created_at);
alter table conversations enable row level security;
alter table messages enable row level security;

create policy "participants see conversation" on conversations for select to authenticated
  using (auth.uid() in (buyer_id, seller_id));
create policy "buyer starts conversation" on conversations for insert to authenticated with check (
  auth.uid() = buyer_id and buyer_id <> seller_id
  and seller_id = (select l.seller_id from listings l where l.id = listing_id)
);
create policy "participants read messages" on messages for select to authenticated using (
  exists (select 1 from conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id))
);
create policy "participants send messages" on messages for insert to authenticated with check (
  auth.uid() = sender_id
  and exists (select 1 from conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id))
);

-- Notify the other person about a new message
create or replace function public.notify_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare c public.conversations; t text;
begin
  select * into c from public.conversations where id = new.conversation_id;
  select title into t from public.listings where id = c.listing_id;
  insert into public.notifications (user_id, body, listing_id)
  values (case when new.sender_id = c.buyer_id then c.seller_id else c.buyer_id end,
          'New message about "' || t || '"', c.listing_id);
  return new;
end $$;
create trigger notify_message after insert on public.messages
  for each row execute function public.notify_message();

-- Chat photos live in the private bucket "chat-photos" under <conversation id>/<file>
create policy "participants upload chat photos" on storage.objects for insert to authenticated with check (
  bucket_id = 'chat-photos' and exists (
    select 1 from public.conversations c
    where c.id::text = (storage.foldername(name))[1] and auth.uid() in (c.buyer_id, c.seller_id))
);
create policy "participants view chat photos" on storage.objects for select to authenticated using (
  bucket_id = 'chat-photos' and exists (
    select 1 from public.conversations c
    where c.id::text = (storage.foldername(name))[1] and auth.uid() in (c.buyer_id, c.seller_id))
);

-- ============ F2 / F9: reservations and the first-come queue ============
create table queue_entries (
  listing_id bigint not null references listings on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (listing_id, user_id)
);
alter table queue_entries enable row level security;
create policy "see own queue spot" on queue_entries for select to authenticated using (auth.uid() = user_id);
create policy "leave queue" on queue_entries for delete to authenticated using (auth.uid() = user_id);

-- Reserve if free to take, otherwise join the queue. Returns {state, position}.
create or replace function public.claim_listing(p_listing bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare l public.listings; me uuid := auth.uid(); pos int;
begin
  if me is null then raise exception 'Log in first'; end if;
  select * into l from public.listings where id = p_listing for update;
  if not found then raise exception 'Listing not found'; end if;
  if l.seller_id = me then raise exception 'This is your own listing'; end if;
  if l.status = 'sold' then raise exception 'This item is already gone'; end if;
  if l.reserved_by = me then return jsonb_build_object('state', 'reserved'); end if;
  if l.status = 'active' then
    update public.listings set status = 'reserved', reserved_by = me where id = p_listing;
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

-- My place in the queue (0 = not queued)
create or replace function public.queue_position(p_listing bigint)
returns int language sql security definer set search_path = '' stable as $$
  select coalesce((
    select count(*)::int from public.queue_entries q
    where q.listing_id = p_listing
      and q.created_at <= (select created_at from public.queue_entries where listing_id = p_listing and user_id = auth.uid())
  ), 0);
$$;

-- Buyer backs out (or seller releases a no-show): offer it to the next person automatically
create or replace function public.release_reservation(p_listing bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare l public.listings; nxt uuid; me uuid := auth.uid();
begin
  select * into l from public.listings where id = p_listing for update;
  if not found then raise exception 'Listing not found'; end if;
  if me is distinct from l.reserved_by and me is distinct from l.seller_id then raise exception 'Not allowed'; end if;
  update public.meetups set status = 'cancelled' where listing_id = p_listing and status in ('proposed', 'accepted');
  select user_id into nxt from public.queue_entries where listing_id = p_listing order by created_at limit 1;
  if nxt is null then
    update public.listings set status = 'active', reserved_by = null where id = p_listing;
  else
    delete from public.queue_entries where listing_id = p_listing and user_id = nxt;
    update public.listings set reserved_by = nxt where id = p_listing;
    insert into public.notifications (user_id, body, listing_id)
    values (nxt, 'Your turn: "' || l.title || '" is now reserved for you', p_listing);
  end if;
  if me = l.reserved_by then
    insert into public.notifications (user_id, body, listing_id)
    values (l.seller_id, 'The buyer backed out of "' || l.title || '"', p_listing);
  end if;
end $$;

-- ============ F10: campus meetups with a handover code ============
create table meetups (
  id bigint generated always as identity primary key,
  listing_id bigint not null references listings on delete cascade,
  buyer_id uuid not null references profiles on delete cascade,
  seller_id uuid not null references profiles on delete cascade,
  spot text not null check (spot in ('Library lobby', 'Guard house', 'Gym lobby', 'Student center', 'Canteen')),
  meet_at timestamptz not null,
  proposed_by uuid not null references profiles on delete cascade,
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'done', 'cancelled')),
  created_at timestamptz not null default now()
);
create table meetup_codes (
  meetup_id bigint primary key references meetups on delete cascade,
  code text not null
);
alter table meetups enable row level security;
alter table meetup_codes enable row level security;
create policy "participants see meetups" on meetups for select to authenticated
  using (auth.uid() in (buyer_id, seller_id));
create policy "buyer sees handover code" on meetup_codes for select to authenticated using (
  exists (select 1 from meetups m where m.id = meetup_id and m.buyer_id = auth.uid())
);

create or replace function public.propose_meetup(p_listing bigint, p_spot text, p_at timestamptz)
returns bigint language plpgsql security definer set search_path = '' as $$
declare l public.listings; me uuid := auth.uid(); mid bigint;
begin
  select * into l from public.listings where id = p_listing;
  if l.reserved_by is null then raise exception 'Reserve the item before arranging a meetup'; end if;
  if me is distinct from l.reserved_by and me is distinct from l.seller_id then raise exception 'Not allowed'; end if;
  if p_at < now() then raise exception 'Pick a time in the future'; end if;
  update public.meetups set status = 'cancelled' where listing_id = p_listing and status in ('proposed', 'accepted');
  insert into public.meetups (listing_id, buyer_id, seller_id, spot, meet_at, proposed_by)
  values (p_listing, l.reserved_by, l.seller_id, p_spot, p_at, me) returning id into mid;
  insert into public.meetup_codes (meetup_id, code) values (mid, lpad(floor(random() * 1000000)::int::text, 6, '0'));
  insert into public.notifications (user_id, body, listing_id)
  values (case when me = l.seller_id then l.reserved_by else l.seller_id end,
          'Meetup proposed for "' || l.title || '": ' || p_spot || ', ' || to_char(p_at at time zone 'Asia/Manila', 'Mon DD, HH12:MI AM'),
          p_listing);
  return mid;
end $$;

create or replace function public.accept_meetup(p_meetup bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.meetups;
begin
  select * into m from public.meetups where id = p_meetup;
  if auth.uid() not in (m.buyer_id, m.seller_id) or auth.uid() = m.proposed_by then raise exception 'Not allowed'; end if;
  if m.status <> 'proposed' then raise exception 'This meetup is no longer open'; end if;
  update public.meetups set status = 'accepted' where id = p_meetup;
  insert into public.notifications (user_id, body, listing_id) values (m.proposed_by, 'Your meetup was accepted', m.listing_id);
end $$;

-- Seller types the buyer's code at the handover: item is marked sold
create or replace function public.confirm_handover(p_meetup bigint, p_code text)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.meetups;
begin
  select * into m from public.meetups where id = p_meetup;
  if auth.uid() is distinct from m.seller_id then raise exception 'Only the seller confirms the handover'; end if;
  if m.status <> 'accepted' then raise exception 'Accept the meetup first'; end if;
  if not exists (select 1 from public.meetup_codes where meetup_id = p_meetup and code = trim(p_code)) then
    raise exception 'That code does not match. Ask the buyer to read it again.';
  end if;
  update public.meetups set status = 'done' where id = p_meetup;
  update public.listings set status = 'sold' where id = m.listing_id;
  delete from public.queue_entries where listing_id = m.listing_id;
  insert into public.notifications (user_id, body, listing_id) values (m.buyer_id, 'Handover confirmed. Enjoy!', m.listing_id);
end $$;

-- ============ Data API access ============
grant select on wanted_posts to anon, authenticated;
grant insert, delete on wanted_posts to authenticated;
grant select, update on notifications to authenticated;
grant select, insert on conversations, messages to authenticated;
grant select, delete on queue_entries to authenticated;
grant select on meetups, meetup_codes to authenticated;
revoke execute on function public.claim_listing, public.queue_position, public.release_reservation,
  public.propose_meetup, public.accept_meetup, public.confirm_handover from public, anon;
grant execute on function public.claim_listing, public.queue_position, public.release_reservation,
  public.propose_meetup, public.accept_meetup, public.confirm_handover to authenticated;

-- Live updates for chat and notifications
alter publication supabase_realtime add table public.messages, public.notifications;
