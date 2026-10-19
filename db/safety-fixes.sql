-- PasaU safety fixes (2026-10-19). Paste into Supabase Dashboard -> SQL Editor -> Run (once).

-- 1. Listing and chat photo storage only takes pictures (same types the site uploads),
--    so nobody can host a web page or other file on PasaU's storage.
update storage.buckets set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id in ('listing-photos', 'chat-photos');

-- 2. Sellers edit only what the Sell form sends. Status, reservations, view counts and
--    dates change only through the site's database functions.
revoke update on public.listings from authenticated;
grant update (kind, title, category, condition, price_php, retail_php, swap_for, size, pickup_spot,
              description, college, program, course_code, year_level) on public.listings to authenticated;

-- 3. Old name in two listing messages
do $$
declare f text;
begin
  foreach f in array array['public.admin_remove_listing(bigint, text)', 'public.set_listing_status(bigint, text)'] loop
    execute replace(pg_get_functiondef(f::regprocedure), 'the Unicycle team', 'the PasaU team');
  end loop;
end $$;
