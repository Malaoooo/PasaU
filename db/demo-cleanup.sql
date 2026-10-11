-- PasaU demo cleanup. Run in the Supabase SQL editor; review the ids first with the SELECT below.
-- Reversible: listings are hidden (status 'removed'), not deleted, so chats and history stay intact.

select id, title, school, status, kind from public.listings order by id;

-- 1. Hide the test listings (photos of the old UniCycle logo, "test offer", duplicate "Calc To Pe Shirt", ...)
update public.listings set status = 'removed' where id in (9, 10, 12, 13, 14);

-- 2. The six seed listings say "Your University", which matches no school, so every campus shows 0.
--    Give them a real school (UC, the pilot campus) or hide them too. Pick one:
update public.listings set school = 'UC' where id in (1, 2, 3, 4, 5, 6);
-- update public.listings set status = 'removed' where id in (1, 2, 3, 4, 5, 6);

-- 3. Old UniMatch test posts (deletes their pings and replies too)
delete from public.wanted_posts where id in (2, 5, 6);

-- Undo step 1 if needed:
-- update public.listings set status = 'active' where id in (9, 10, 12, 13, 14);
