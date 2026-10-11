-- Unicycle: starting schema for Supabase (Postgres).
-- Paste into Supabase Dashboard -> SQL Editor -> Run.
-- Prices are whole pesos (int). Every table has Row Level Security on.

create type category as enum ('uniforms', 'books', 'supplies');
create type listing_status as enum ('active', 'reserved', 'sold');
create type offer_status as enum ('pending', 'accepted', 'declined', 'withdrawn');

-- One row per signed-in student (id = their auth user id)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  school text not null,
  grad_year int,
  created_at timestamptz not null default now()
);

create table listings (
  id bigint generated always as identity primary key,
  seller_id uuid not null references profiles on delete cascade,
  title text not null,
  category category not null,
  price_php int not null check (price_php > 0),
  retail_php int check (retail_php > 0),
  size text,                      -- "M, chest 38 in", "3rd edition", etc.
  condition text not null,        -- "Like new", "Good"
  pickup_spot text not null,      -- "Gym lobby"
  description text,
  status listing_status not null default 'active',
  created_at timestamptz not null default now()
);
create index on listings (category, status);

-- Files live in the Storage bucket "listing-photos"; this table keeps their order
create table listing_photos (
  id bigint generated always as identity primary key,
  listing_id bigint not null references listings on delete cascade,
  path text not null,
  position int not null default 0
);

-- The heart button
create table saves (
  user_id uuid not null references profiles on delete cascade,
  listing_id bigint not null references listings on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

-- The offer stepper
create table offers (
  id bigint generated always as identity primary key,
  listing_id bigint not null references listings on delete cascade,
  buyer_id uuid not null references profiles on delete cascade,
  amount_php int not null check (amount_php > 0),
  status offer_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- "Bring Unicycle to your campus" form
create table waitlist (
  email text primary key check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now()
);

-- ---------- Row Level Security ----------
alter table profiles enable row level security;
alter table listings enable row level security;
alter table listing_photos enable row level security;
alter table saves enable row level security;
alter table offers enable row level security;
alter table waitlist enable row level security;

create policy "students see profiles" on profiles for select to authenticated using (true);
create policy "students edit own profile" on profiles for insert to authenticated with check (auth.uid() = id);
create policy "students update own profile" on profiles for update to authenticated using (auth.uid() = id);

create policy "anyone browses listings" on listings for select using (true);
create policy "sellers create listings" on listings for insert to authenticated with check (auth.uid() = seller_id);
create policy "sellers edit own listings" on listings for update to authenticated using (auth.uid() = seller_id);
create policy "sellers delete own listings" on listings for delete to authenticated using (auth.uid() = seller_id);

create policy "anyone sees photos" on listing_photos for select using (true);
create policy "sellers manage own photos" on listing_photos for all to authenticated
  using (auth.uid() = (select seller_id from listings where id = listing_id))
  with check (auth.uid() = (select seller_id from listings where id = listing_id));

create policy "students manage own saves" on saves for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "buyers make offers" on offers for insert to authenticated with check (auth.uid() = buyer_id);
create policy "buyer and seller see the offer" on offers for select to authenticated
  using (auth.uid() = buyer_id or auth.uid() = (select seller_id from listings where id = listing_id));
-- ponytail: seller can update any column; restrict to status only (column privileges or an RPC) before launch
create policy "seller answers offers" on offers for update to authenticated
  using (auth.uid() = (select seller_id from listings where id = listing_id));

create policy "anyone joins the waitlist" on waitlist for insert with check (true);

-- ---------- Data API access ----------
-- Needed when "Automatically expose new tables" is off. RLS policies above still decide which rows.
grant usage on schema public to anon, authenticated;
grant select on listings, listing_photos to anon, authenticated;
grant insert on waitlist to anon, authenticated;
grant select, insert, update on profiles to authenticated;
grant insert, update, delete on listings, listing_photos to authenticated;
grant select, insert, delete on saves to authenticated;
grant select, insert, update on offers to authenticated;
