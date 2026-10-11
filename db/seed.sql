-- Unicycle: sample data so the site has real rows to load.
-- 1. Supabase Dashboard -> Authentication -> Users -> copy your test user's UID
-- 2. Paste it below in place of PASTE-USER-UID-HERE
-- 3. SQL Editor -> paste this file -> Run

do $$
declare
  me uuid := '85aa7783-088f-453e-b5b8-fc88866b156b';
begin
  insert into profiles (id, full_name, school, grad_year)
  values (me, 'Test Seller', 'Your University', 2026)
  on conflict (id) do nothing;

  insert into listings (seller_id, title, category, price_php, retail_php, size, condition, pickup_spot, description) values
    (me, 'PE House Shirt',          'uniforms', 250,  550, 'M, chest 38 in',      'Like new',      'Gym lobby',      'Dri-fit PE shirt, Green House.'),
    (me, 'PE Jogging Pants',        'uniforms', 300,  600, 'L, 30 in waist',      'Good',          'Gym lobby',      null),
    (me, 'Calculus I–III Bundle',   'books',    900, 3000, '3 books',             'Light notes',   'Science Hall',   null),
    (me, 'English Lit Reading Set', 'books',    400, 1000, '4 novels',            'No highlights', 'Library steps',  null),
    (me, 'Scientific Calculator',   'supplies', 450,  820, null,                  'Like new',      'Science Hall',   'Exam-approved, batteries included.'),
    (me, 'Campus Backpack',         'supplies', 500, 1000, 'Fits a 15 in laptop', 'Good',          'Student center', null);
end $$;
