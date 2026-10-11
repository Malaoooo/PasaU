-- Unicycle: create a profile row automatically when someone makes an account.
-- Name and school come from the sign-up form (saved as user metadata).
-- Paste into Supabase Dashboard -> SQL Editor -> Run (once).

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, school)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'school', '')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
