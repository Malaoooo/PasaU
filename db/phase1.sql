-- Unicycle Phase 1: reporting, blocking, queue size.
-- Run AFTER chat-meetups.sql. Supabase Dashboard -> SQL Editor -> paste -> Run (once).

-- ---------- Reports (listing or user) ----------
create table reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null default auth.uid() references profiles on delete cascade,
  listing_id bigint references listings on delete set null,
  reported_user_id uuid references profiles on delete set null,
  reason text not null check (reason in ('Prohibited or unsafe item', 'Scam or misleading', 'Spam or wrong category',
                                          'Offensive content', 'Harassment', 'Other')),
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  check (listing_id is not null or reported_user_id is not null)
);
alter table reports enable row level security;
create policy "file a report" on reports for insert to authenticated with check (auth.uid() = reporter_id);
create policy "see your own reports" on reports for select to authenticated using (auth.uid() = reporter_id);
grant select, insert on reports to authenticated;

-- ---------- Blocks ----------
create table blocks (
  blocker_id uuid not null default auth.uid() references profiles on delete cascade,
  blocked_id uuid not null references profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table blocks enable row level security;
create policy "see who you blocked" on blocks for select to authenticated using (auth.uid() = blocker_id);
create policy "block someone" on blocks for insert to authenticated with check (auth.uid() = blocker_id);
create policy "unblock someone" on blocks for delete to authenticated using (auth.uid() = blocker_id);
grant select, insert, delete on blocks to authenticated;

create or replace function public.is_blocked(a uuid, b uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.blocks
                 where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;
grant execute on function public.is_blocked to authenticated;

-- Blocked people can't start a chat or message each other (either direction)
drop policy "buyer starts conversation" on conversations;
create policy "buyer starts conversation" on conversations for insert to authenticated with check (
  auth.uid() = buyer_id and buyer_id <> seller_id
  and seller_id = (select l.seller_id from listings l where l.id = listing_id)
  and not public.is_blocked(buyer_id, seller_id)
);
drop policy "participants send messages" on messages;
create policy "participants send messages" on messages for insert to authenticated with check (
  auth.uid() = sender_id
  and exists (select 1 from conversations c
              where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)
                and not public.is_blocked(c.buyer_id, c.seller_id))
);

-- ---------- How many people are in line (public count, no names) ----------
create or replace function public.queue_count(p_listing bigint)
returns int language sql security definer set search_path = '' stable as $$
  select count(*)::int from public.queue_entries where listing_id = p_listing;
$$;
grant execute on function public.queue_count to anon, authenticated;
