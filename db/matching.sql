-- Unicycle: Looking For matching.
-- Run AFTER phases2-4.sql. Supabase Dashboard -> SQL Editor -> paste -> Run (once).
-- When a student posts a Looking For, Unicycle finds:
--   1. listings up right now that fit it (shown to the poster; their sellers get a nudge)
--   2. students who probably have one: they got a similar item through Unicycle, or they are a
--      higher year in the same course at the same school (any course for uniforms). They get a nudge.
-- Each student gets at most 3 of these nudges a day, and they follow the "Looking For" notification switch.

-- Words from a Looking For title, any of which can match ("scientific calculator" -> scientif | calcul).
-- Common words ("the", "for") are ignored and words are stemmed ("books" matches "book").
-- Generic words like "textbook" or "uniform" count only when they are all there is,
-- so "anatomy textbook" doesn't match every textbook.
-- ponytail: fixed list of generic words; add to it when matches feel noisy
create or replace function public.wanted_query(want text)
returns tsquery language sql immutable set search_path = '' as $$
  with words as (
    select w from unnest(tsvector_to_array(to_tsvector('english', coalesce(want, '')))) w
    where strpos(w, chr(92)) = 0
  ), keep as (
    select w from words where w <> all (array['book', 'textbook', 'uniform', 'set', 'size', 'new', 'use', 'pc', 'pcs',
      'piec', 'item', 'pair', 'school', 'suppli', 'need', 'look', 'want', 'find', 'buy'])
  )
  select nullif(string_agg(quote_literal(w), ' | '), '')::tsquery
  from (select w from keep union all select w from words where not exists (select 1 from keep)) x;
$$;

-- The searchable text of a listing: title first, then its course code
create or replace function public.listing_doc(l public.listings)
returns tsvector language sql immutable set search_path = '' as $$
  select setweight(to_tsvector('english', coalesce(l.title, '')), 'A')
      || setweight(to_tsvector('english', coalesce(l.course_code, '')), 'B');
$$;

-- Does this listing fit this Looking For post?
create or replace function public.listing_fits(l public.listings, w public.wanted_posts)
returns boolean language sql stable set search_path = '' as $$
  select l.status = 'active' and l.seller_id <> w.user_id
    and (w.category is null or l.category = w.category)
    and (w.school is null or l.school = w.school)
    and (w.max_price_php is null or l.price_php <= w.max_price_php)
    and coalesce(public.listing_doc(l) @@ public.wanted_query(w.title), false);
$$;

-- Listings that fit a Looking For post, best match first
create or replace function public.wanted_matches(p_wanted bigint)
returns setof public.listings language sql stable set search_path = '' as $$
  select l.* from public.wanted_posts w
  join public.listings l on public.listing_fits(l, w)
  where w.id = p_wanted
  order by ts_rank(public.listing_doc(l), public.wanted_query(w.title)) desc, l.bumped_at desc
  limit 12;
$$;
grant execute on function public.wanted_query, public.listing_doc, public.listing_fits, public.wanted_matches to authenticated;

-- Who was asked about a post, and why
create table wanted_pings (
  wanted_id bigint not null references wanted_posts on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  reason text not null check (reason in ('listed', 'owned', 'course')),
  created_at timestamptz not null default now(),
  primary key (wanted_id, user_id)
);
create index on wanted_pings (user_id, created_at);
alter table wanted_pings enable row level security;
-- The poster never sees who got an item before ("owned"): that would show what someone bought
create policy "poster and pinged see pings" on wanted_pings for select to authenticated using (
  auth.uid() = user_id
  or (reason <> 'owned' and exists (select 1 from wanted_posts w where w.id = wanted_id and w.user_id = auth.uid()))
);
grant select on wanted_pings to authenticated;

-- Notifications can point at a Looking For post
alter table notifications add column wanted_id bigint references wanted_posts on delete cascade;

-- New Looking For post -> ask the students most likely to have it
create or replace function public.match_wanted()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  q tsquery := public.wanted_query(new.title);
  poster public.profiles;
  years text[] := array['1st year', '2nd year', '3rd year', '4th year', '5th year', 'Graduate'];
begin
  if q is null then return new; end if;
  select * into poster from public.profiles where id = new.user_id;

  -- 1. Sellers with a matching listing up now
  insert into public.wanted_pings (wanted_id, user_id, reason)
  select new.id, l.seller_id, 'listed'
  from public.listings l
  where public.listing_fits(l, new)
  order by ts_rank(public.listing_doc(l), q) desc
  limit 5
  on conflict do nothing;

  -- 2. Students who got a similar item through Unicycle
  insert into public.wanted_pings (wanted_id, user_id, reason)
  select new.id, t.buyer_id, 'owned'
  from public.transactions t
  join public.listings l on l.id = t.listing_id
  join public.profiles p on p.id = t.buyer_id
  where t.status = 'completed' and t.buyer_id <> new.user_id
    and (new.category is null or l.category = new.category)
    and (new.school is null or p.school = new.school)
    and public.listing_doc(l) @@ q
  order by t.updated_at desc
  limit 5
  on conflict do nothing;

  -- 3. Higher years in the same course at the same school (uniforms: any course).
  --    Only between students who both show their course and year on their profile.
  if poster.show_course_year and poster.year_level is not null and coalesce(new.category::text, '') not in ('electronics', 'dorm', 'others') then
    insert into public.wanted_pings (wanted_id, user_id, reason)
    select new.id, p.id, 'course'
    from public.profiles p
    where p.id <> new.user_id and p.show_course_year
      and lower(p.school) = lower(coalesce(new.school, poster.school))
      and array_position(years, p.year_level) > array_position(years, poster.year_level)
      and (new.category = 'uniforms' or (poster.course is not null and lower(p.course) = lower(poster.course)))
    order by random()  -- ponytail: fine for a few thousand students; sample from an index if it grows past that
    limit 8
    on conflict do nothing;
  end if;

  -- Drop anyone suspended, blocked either way, or already asked 3 times today
  delete from public.wanted_pings x
  where x.wanted_id = new.id and (
    exists (select 1 from public.profiles p where p.id = x.user_id and p.suspended)
    or public.is_blocked(new.user_id, x.user_id)
    or (select count(*) from public.wanted_pings y
        where y.user_id = x.user_id and y.wanted_id <> new.id and y.created_at > now() - interval '1 day') >= 3
  );

  insert into public.notifications (user_id, body, wanted_id)
  select x.user_id,
    case x.reason
      when 'listed' then 'A student is Looking For "' || new.title || '" and one of your listings might be it. Tap to send it to them.'
      when 'owned' then 'A student is Looking For "' || new.title || '". You got something like it on Unicycle. Done with it? Tap to reply.'
      else 'A ' || coalesce(poster.year_level || ' ', '') || 'student '
        || case when new.category = 'uniforms' then 'at your school' else 'in your course' end
        || ' is Looking For "' || new.title || '". Have one you no longer need? Tap to reply.'
    end,
    new.id
  from public.wanted_pings x where x.wanted_id = new.id;
  return new;
end $$;
create trigger match_wanted after insert on public.wanted_posts
  for each row execute function public.match_wanted();

-- New listing -> tell Looking For posters it fits (same rules as above, replaces the word-by-word version)
create or replace function public.notify_wanted()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, body, listing_id, wanted_id)
  select w.user_id, 'New listing for your Looking For post "' || w.title || '": ' || new.title, new.id, w.id
  from public.wanted_posts w
  where public.listing_fits(new, w) and not public.is_blocked(w.user_id, new.seller_id);
  return new;
end $$;
