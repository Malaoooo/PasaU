-- Unicycle: meetup suggestions, accepts and handovers appear inside the chat.
-- Run AFTER features.sql. Supabase Dashboard -> SQL Editor -> paste -> Run (once).

alter table public.messages add column meetup_id bigint references public.meetups on delete set null;

-- Post a line into the buyer/seller conversation for a listing (creates the chat if needed)
create or replace function public.post_meetup_message(p_listing bigint, p_buyer uuid, p_sender uuid, p_meetup bigint, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
declare l public.listings; cid bigint;
begin
  select * into l from public.listings where id = p_listing;
  insert into public.conversations (listing_id, buyer_id, seller_id)
  values (p_listing, p_buyer, l.seller_id)
  on conflict (listing_id, buyer_id) do nothing;
  select id into cid from public.conversations where listing_id = p_listing and buyer_id = p_buyer;
  -- the message trigger notifies the other person
  insert into public.messages (conversation_id, sender_id, body, meetup_id) values (cid, p_sender, p_body, p_meetup);
end $$;
revoke execute on function public.post_meetup_message from public, anon, authenticated;

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
  perform public.post_meetup_message(p_listing, l.reserved_by, me, mid,
    'Meetup proposed: ' || p_spot || ', ' || to_char(p_at at time zone 'Asia/Manila', 'Mon DD, HH12:MI AM'));
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
  perform public.post_meetup_message(m.listing_id, m.buyer_id, auth.uid(), m.id,
    'Meetup accepted: ' || m.spot || ', ' || to_char(m.meet_at at time zone 'Asia/Manila', 'Mon DD, HH12:MI AM'));
end $$;

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
  perform public.post_meetup_message(m.listing_id, m.buyer_id, m.seller_id, m.id, 'Handover confirmed. Item marked as sold.');
end $$;
