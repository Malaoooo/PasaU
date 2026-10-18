-- PasaU: parent / guardian accounts.
-- A student invites a parent with a one-time code; the parent signs up with any email (Gmail is fine) on family.html.
-- Guardians can't sell, buy, chat or appear in search. They see the meetups (place, time, item) and, if the student
-- turns it on, completed deals of the students who linked them. Never chats or handover codes.
-- Run AFTER db/two-step.sql, then run db/two-step.sql again so it covers the new tables.
-- Paste into Supabase Dashboard -> SQL Editor -> Run (safe to run again).

-- ---------- Who is a guardian ----------
alter table public.profiles add column if not exists role text not null default 'student'
  check (role in ('student', 'guardian'));

create or replace function public.is_guardian()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'guardian' from public.profiles where id = auth.uid()), false);
$$;
grant execute on function public.is_guardian() to authenticated;

-- Guardians don't show up as students anywhere (search, chats, PasaMatch)
create or replace view public.public_profiles as
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
  where not p.suspended and p.role = 'student';

-- ---------- Invites, links, alerts ----------
create table if not exists public.guardian_invites (
  code text primary key,
  student_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references public.profiles on delete set null,
  used_at timestamptz
);
create table if not exists public.guardian_links (
  student_id uuid not null references public.profiles on delete cascade,
  guardian_id uuid not null references public.profiles on delete cascade,
  share_meetups boolean not null default true,
  share_deals boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (student_id, guardian_id),
  check (student_id <> guardian_id)
);
create table if not exists public.guardian_alerts (
  id bigint generated always as identity primary key,
  guardian_id uuid not null references public.profiles on delete cascade,
  student_id uuid references public.profiles on delete set null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists guardian_alerts_guardian on public.guardian_alerts (guardian_id, created_at desc);
create index if not exists guardian_links_guardian on public.guardian_links (guardian_id);
alter table public.meetups add column if not exists checkin_at timestamptz;

alter table public.guardian_invites enable row level security;
alter table public.guardian_links enable row level security;
alter table public.guardian_alerts enable row level security;

drop policy if exists "student sees own invites" on public.guardian_invites;
create policy "student sees own invites" on public.guardian_invites for select to authenticated using (auth.uid() = student_id);
drop policy if exists "student cancels own invites" on public.guardian_invites;
create policy "student cancels own invites" on public.guardian_invites for delete to authenticated using (auth.uid() = student_id and used_by is null);

drop policy if exists "both sides see the link" on public.guardian_links;
create policy "both sides see the link" on public.guardian_links for select to authenticated using (auth.uid() in (student_id, guardian_id));
drop policy if exists "student picks what is shared" on public.guardian_links;
create policy "student picks what is shared" on public.guardian_links for update to authenticated
  using (auth.uid() = student_id) with check (auth.uid() = student_id);
drop policy if exists "either side unlinks" on public.guardian_links;
create policy "either side unlinks" on public.guardian_links for delete to authenticated using (auth.uid() in (student_id, guardian_id));

drop policy if exists "guardian reads own alerts" on public.guardian_alerts;
create policy "guardian reads own alerts" on public.guardian_alerts for select to authenticated using (auth.uid() = guardian_id);
drop policy if exists "guardian marks alerts read" on public.guardian_alerts;
create policy "guardian marks alerts read" on public.guardian_alerts for update to authenticated using (auth.uid() = guardian_id);

revoke all on public.guardian_invites, public.guardian_links, public.guardian_alerts from anon, authenticated;
grant select, delete on public.guardian_invites to authenticated;
grant select, delete on public.guardian_links to authenticated;
grant update (share_meetups, share_deals) on public.guardian_links to authenticated;
grant select on public.guardian_alerts to authenticated;
grant update (read) on public.guardian_alerts to authenticated;

-- First name only, for alerts
create or replace function public.first_name(p_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(split_part(trim(full_name), ' ', 1), ''), 'Your student') from public.profiles where id = p_id;
$$;
revoke all on function public.first_name(uuid) from public, anon, authenticated;

-- The invite behind a code, if it can still be used
create or replace function public.open_guardian_invite(p_code text)
returns public.guardian_invites language sql stable security definer set search_path = '' as $$
  select * from public.guardian_invites
  where code = upper(trim(p_code)) and used_by is null and expires_at > now();
$$;
revoke all on function public.open_guardian_invite(text) from public, anon, authenticated;

-- ---------- Student side ----------
-- New invite code (replaces any unused one). Codes are 10 characters and last 7 days.
create or replace function public.create_guardian_invite()
returns public.guardian_invites language plpgsql security definer set search_path = '' as $$
declare inv public.guardian_invites;
begin
  if auth.uid() is null or public.is_guardian() then raise exception 'Only students can invite a parent or guardian'; end if;
  if (select count(*) from public.guardian_links where student_id = auth.uid()) >= 4 then
    raise exception 'You can link up to 4 parents or guardians. Unlink one first.';
  end if;
  delete from public.guardian_invites where student_id = auth.uid() and used_by is null;
  insert into public.guardian_invites (code, student_id)
  values (upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)), auth.uid())
  returning * into inv;
  return inv;
end $$;

-- The student's guardians (with their email, so the student can tell who it is) and any open invite
create or replace function public.my_family()
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'guardians', coalesce((
      select json_agg(json_build_object('id', g.id, 'name', g.full_name, 'email', u.email,
               'share_meetups', l.share_meetups, 'share_deals', l.share_deals, 'since', l.created_at) order by l.created_at)
      from public.guardian_links l join public.profiles g on g.id = l.guardian_id join auth.users u on u.id = g.id
      where l.student_id = auth.uid()), '[]'::json),
    'invite', (
      select json_build_object('code', i.code, 'expires_at', i.expires_at) from public.guardian_invites i
      where i.student_id = auth.uid() and i.used_by is null and i.expires_at > now()
      order by i.created_at desc limit 1));
$$;

-- ---------- Guardian side ----------
-- Who sent this invite (shown on the sign-up page before the parent makes an account)
create or replace function public.check_guardian_invite(p_code text)
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object('student', public.first_name(i.student_id), 'school', p.school, 'expires_at', i.expires_at)
  from public.open_guardian_invite(p_code) i join public.profiles p on p.id = i.student_id
  where i.code is not null;
$$;

-- Link a code to the account (used at sign-up, and by a guardian adding a second child)
create or replace function public.link_guardian(p_guardian uuid, p_code text)
returns void language plpgsql security definer set search_path = '' as $$
declare inv public.guardian_invites;
begin
  select * into inv from public.open_guardian_invite(p_code);
  if inv.code is null then raise exception 'This invite code is wrong, used or expired. Ask your student for a new one.'; end if;
  if inv.student_id = p_guardian then raise exception 'You can’t use your own invite'; end if;
  update public.guardian_invites set used_by = p_guardian, used_at = now() where code = inv.code;
  insert into public.guardian_links (student_id, guardian_id) values (inv.student_id, p_guardian) on conflict do nothing;
  insert into public.notifications (user_id, body)
  values (inv.student_id, 'Family: ' || coalesce(nullif(trim((select full_name from public.profiles where id = p_guardian)), ''), 'Your guardian')
                          || ' is now linked as your parent or guardian. Choose what they see in Profile > Family.');
  insert into public.guardian_alerts (guardian_id, student_id, body)
  values (p_guardian, inv.student_id, 'You’re now linked to ' || public.first_name(inv.student_id) || '. You’ll see their meetups here.');
end $$;
revoke all on function public.link_guardian(uuid, text) from public, anon, authenticated;

create or replace function public.accept_guardian_invite(p_code text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_guardian() then raise exception 'Log in with your parent or guardian account to use this invite'; end if;
  perform public.link_guardian(auth.uid(), p_code);
end $$;

-- Everything the guardian dashboard shows. The other student appears as first name, school and verified badge only.
create or replace function public.guardian_overview()
returns json language sql stable security definer set search_path = '' as $$
  select coalesce(json_agg(json_build_object(
    'id', s.id, 'name', s.full_name, 'school', s.school, 'avatar_url', s.avatar_url,
    'share_meetups', l.share_meetups, 'share_deals', l.share_deals,
    'meetups', case when l.share_meetups then coalesce((
      select json_agg(json_build_object(
        'id', m.id, 'title', li.title, 'spot', m.spot, 'meet_at', m.meet_at, 'status', m.status,
        'role', case when m.buyer_id = s.id then 'buying' else 'selling' end,
        'other_name', split_part(trim(o.full_name), ' ', 1), 'other_school', o.school, 'other_verified', o.verified)
        order by m.meet_at)
      from public.meetups m join public.listings li on li.id = m.listing_id
      join public.profiles o on o.id = case when m.buyer_id = s.id then m.seller_id else m.buyer_id end
      where s.id in (m.buyer_id, m.seller_id)
        and (m.status = 'accepted' and m.meet_at > now() - interval '1 day'
             or m.status = 'done' and m.meet_at > now() - interval '7 days')), '[]'::json) end,
    'deals', case when l.share_deals then coalesce((
      select json_agg(json_build_object('title', li.title, 'kind', t.kind, 'price_php', t.price_php, 'at', t.updated_at,
               'role', case when t.buyer_id = s.id then 'bought' else 'sold' end) order by t.updated_at desc)
      from public.transactions t join public.listings li on li.id = t.listing_id
      where s.id in (t.buyer_id, t.seller_id) and t.status = 'completed' and t.updated_at > now() - interval '90 days'), '[]'::json) end
  ) order by l.created_at), '[]'::json)
  from public.guardian_links l join public.profiles s on s.id = l.student_id
  where l.guardian_id = auth.uid();
$$;

-- "Report a concern": goes to the admin Reports queue, about the meetup's item or about the student's account
create or replace function public.guardian_concern(p_student uuid, p_details text, p_meetup bigint default null)
returns void language plpgsql security definer set search_path = '' as $$
declare l public.guardian_links; m public.meetups;
begin
  select * into l from public.guardian_links where guardian_id = auth.uid() and student_id = p_student;
  if l.student_id is null then raise exception 'You aren’t linked to this student'; end if;
  if length(trim(coalesce(p_details, ''))) < 5 then raise exception 'Tell us a little about your concern'; end if;
  if p_meetup is not null then
    select * into m from public.meetups where id = p_meetup and p_student in (buyer_id, seller_id);
    if m.id is null or not l.share_meetups then raise exception 'That meetup isn’t shared with you'; end if;
  end if;
  insert into public.reports (reporter_id, listing_id, reported_user_id, reason, details)
  values (auth.uid(), m.listing_id,
          case when m.id is null then p_student when m.buyer_id = p_student then m.seller_id else m.buyer_id end,
          'Other',
          'Concern from a parent/guardian of ' || (select full_name from public.profiles where id = p_student)
            || case when m.id is not null then ' about a meetup at ' || m.spot || ', '
                 || to_char(m.meet_at at time zone 'Asia/Manila', 'Mon DD, HH12:MI AM') else '' end
            || ': ' || left(trim(p_details), 1000));
end $$;

revoke all on function public.create_guardian_invite(), public.my_family(), public.check_guardian_invite(text),
  public.accept_guardian_invite(text), public.guardian_overview(), public.guardian_concern(uuid, text, bigint) from public, anon;
grant execute on function public.create_guardian_invite(), public.my_family(), public.accept_guardian_invite(text),
  public.guardian_overview(), public.guardian_concern(uuid, text, bigint) to authenticated;
grant execute on function public.check_guardian_invite(text) to anon, authenticated;

-- Student unlinks -> the guardian is told, so it's never hidden
create or replace function public.guardian_unlinked()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() = old.student_id then
    insert into public.guardian_alerts (guardian_id, body)
    values (old.guardian_id, public.first_name(old.student_id) || ' unlinked your account. You no longer see their meetups.');
  end if;
  return old;
end $$;
drop trigger if exists guardian_unlinked on public.guardian_links;
create trigger guardian_unlinked after delete on public.guardian_links
  for each row execute function public.guardian_unlinked();

-- ---------- Sign-up: a valid invite lets a non-school email in ----------
create or replace function public.require_school_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.email is not distinct from old.email then return new; end if;
  if new.email is null or public.school_of_email(new.email) is not null then return new; end if;
  -- Parent signing up with an invite code
  if tg_op = 'INSERT' and (public.open_guardian_invite(new.raw_user_meta_data->>'guardian_invite')).code is not null then return new; end if;
  -- Guardians may change to any email
  if tg_op = 'UPDATE' and exists (select 1 from public.profiles where id = new.id and role = 'guardian') then return new; end if;
  raise exception 'PasaU accounts need a school email (like you@slu.edu.ph)' using errcode = 'check_violation';
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (public.open_guardian_invite(new.raw_user_meta_data->>'guardian_invite')).code is not null then
    insert into public.profiles (id, full_name, school, role)
    values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), '', 'guardian');
    perform public.link_guardian(new.id, new.raw_user_meta_data->>'guardian_invite');
    return new;
  end if;
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

-- ---------- Guardians can't use the marketplace ----------
-- A trigger (not a policy) so it also covers the site's database functions, which skip policies
create or replace function public.no_guardians()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_guardian() then
    raise exception 'Parent and guardian accounts can’t buy, sell or chat on PasaU' using errcode = 'check_violation';
  end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['listings', 'listing_photos', 'saves', 'offers', 'waitlist', 'wanted_posts', 'wanted_replies',
                           'wanted_pings', 'conversations', 'messages', 'conversation_reads', 'queue_entries', 'meetups',
                           'transactions', 'vouches', 'verification_requests', 'blocks']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists no_guardians on public.%I', t);
      execute format('create trigger no_guardians before insert on public.%I for each row execute function public.no_guardians()', t);
    end if;
  end loop;
end $$;

-- ---------- Meetup alerts ----------
create or replace function public.alert_guardians(p_student uuid, p_body text)
returns void language sql security definer set search_path = '' as $$
  insert into public.guardian_alerts (guardian_id, student_id, body)
  select guardian_id, p_student, p_body from public.guardian_links where student_id = p_student and share_meetups;
$$;
revoke all on function public.alert_guardians(uuid, text) from public, anon, authenticated;

create or replace function public.guardian_meetup_alerts()
returns trigger language plpgsql security definer set search_path = '' as $$
declare t text; s uuid; at text;
begin
  if new.status is not distinct from old.status then return new; end if;
  select title into t from public.listings where id = new.listing_id;
  at := to_char(new.meet_at at time zone 'Asia/Manila', 'Dy Mon DD, HH12:MI AM');
  foreach s in array array[new.buyer_id, new.seller_id] loop
    if new.status = 'accepted' then
      perform public.alert_guardians(s, public.first_name(s) || ' has a meetup: '
        || case when s = new.buyer_id then 'buying' else 'selling' end || ' "' || t || '" at ' || new.spot || ', ' || at || '.');
    elsif new.status = 'done' then
      perform public.alert_guardians(s, 'Handover done: ' || public.first_name(s) || ' finished the meetup for "' || t || '".');
    elsif new.status = 'cancelled' and old.status = 'accepted' then
      perform public.alert_guardians(s, 'Meetup cancelled: ' || public.first_name(s) || '’s meetup for "' || t || '" on ' || at || ' was cancelled.');
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists guardian_meetup_alerts on public.meetups;
create trigger guardian_meetup_alerts after update of status on public.meetups
  for each row execute function public.guardian_meetup_alerts();

-- Safe-handover check-in: 30 minutes after an accepted meetup that isn't marked done, nudge the students
-- (only those with a guardian linked) and tell their guardians
create or replace function public.guardian_checkins()
returns void language plpgsql security definer set search_path = '' as $$
declare m record; s uuid;
begin
  for m in
    select mt.*, l.title from public.meetups mt join public.listings l on l.id = mt.listing_id
    where mt.status = 'accepted' and mt.checkin_at is null
      and mt.meet_at between now() - interval '1 day' and now() - interval '30 minutes'
      and exists (select 1 from public.guardian_links g where g.student_id in (mt.buyer_id, mt.seller_id))
  loop
    foreach s in array array[m.buyer_id, m.seller_id] loop
      if exists (select 1 from public.guardian_links g where g.student_id = s) then
        insert into public.notifications (user_id, body, listing_id)
        values (s, 'Meetup check-in: is everything OK? Your meetup for "' || m.title || '" isn’t marked done yet. '
                   || 'Confirm the handover code, or cancel it if it didn’t happen.', m.listing_id);
        perform public.alert_guardians(s, 'Check-in: ' || public.first_name(s) || '’s meetup for "' || m.title || '" at ' || m.spot
          || ' (' || to_char(m.meet_at at time zone 'Asia/Manila', 'HH12:MI AM') || ') isn’t marked done yet. We’ve asked them to check in.');
      end if;
    end loop;
    update public.meetups set checkin_at = now() where id = m.id;
  end loop;
end $$;
revoke execute on function public.guardian_checkins() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('pasau-guardian-checkins', '*/10 * * * *', 'select public.guardian_checkins()');
