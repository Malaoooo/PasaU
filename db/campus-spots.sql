-- Unicycle: meetup spots now come from each school's own list in universities.js,
-- so the database no longer limits them to the five original names.
-- Run AFTER matching.sql. Supabase Dashboard -> SQL Editor -> paste -> Run (once).

alter table public.meetups drop constraint if exists meetups_spot_check;
alter table public.meetups add constraint meetups_spot_length check (char_length(trim(spot)) between 2 and 80);
