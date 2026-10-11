-- Unicycle: meetup reminders about an hour before an agreed meetup (optional).
-- Run this file in the SQL Editor (once). Run AFTER phases2-4.sql.
-- The first line turns on the pg_cron scheduler (same as Database -> Extensions -> pg_cron).

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.send_meetup_reminders()
returns void language plpgsql security definer set search_path = '' as $$
declare m record;
begin
  for m in
    select mt.*, l.title from public.meetups mt join public.listings l on l.id = mt.listing_id
    where mt.status = 'accepted' and mt.reminded_at is null
      and mt.meet_at between now() and now() + interval '70 minutes'
  loop
    insert into public.notifications (user_id, body, listing_id)
    select uid, 'Reminder: meetup for "' || m.title || '" at ' || m.spot || ', '
                || to_char(m.meet_at at time zone 'Asia/Manila', 'HH12:MI AM'), m.listing_id
    from unnest(array[m.buyer_id, m.seller_id]) as uid;
    update public.meetups set reminded_at = now() where id = m.id;
  end loop;
end $$;
revoke execute on function public.send_meetup_reminders from public, anon, authenticated;

select cron.schedule('unicycle-meetup-reminders', '*/10 * * * *', 'select public.send_meetup_reminders()');
