-- Add user_id to weeks if not already present
alter table weeks
  add column if not exists user_id uuid references auth.users(id);

-- Add user_id to flashcards if not already present
alter table flashcards
  add column if not exists user_id uuid references auth.users(id);

-- ============================================================
-- Profiles table
-- ============================================================
create table profiles (
  id uuid references auth.users primary key,
  display_name text,
  avatar_color text default '#E8526A',
  native_language text default 'en',
  learning_language text default 'vi',
  class_name text,
  created_at timestamptz default now()
);

-- ============================================================
-- Auto-create profile on signup
-- ============================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into profiles (id, display_name)
  values (
    new.id,
    split_part(new.email, '@', 1)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- Drop all existing permissive policies
-- ============================================================
-- NOTE: Existing rows in weeks/flashcards/game_stats with user_id = null
-- will NOT be visible to any user after RLS is enabled. To assign all
-- pre-auth rows to a specific user, run BEFORE applying this migration:
--
--   UPDATE weeks      SET user_id = '<your-user-uuid>' WHERE user_id IS NULL;
--   UPDATE flashcards SET user_id = '<your-user-uuid>' WHERE user_id IS NULL;
--   UPDATE game_stats SET user_id = '<your-user-uuid>' WHERE user_id IS NULL;
--
-- Get your user UUID from the Supabase dashboard → Authentication → Users.
-- ============================================================
drop policy if exists "allow all" on weeks;
drop policy if exists "allow all" on flashcards;
drop policy if exists "allow all" on game_stats;

-- ============================================================
-- Enable RLS
-- ============================================================
alter table weeks      enable row level security;
alter table flashcards enable row level security;
alter table game_stats enable row level security;
alter table profiles   enable row level security;

-- ============================================================
-- weeks policies — user_id scoped
-- ============================================================
create policy "weeks_select" on weeks
  for select using (user_id = auth.uid());

create policy "weeks_insert" on weeks
  for insert with check (user_id = auth.uid());

create policy "weeks_update" on weeks
  for update using (user_id = auth.uid());

create policy "weeks_delete" on weeks
  for delete using (user_id = auth.uid());

-- ============================================================
-- flashcards policies — via week ownership
-- ============================================================
create policy "flashcards_select" on flashcards
  for select using (
    week_id in (select id from weeks where user_id = auth.uid())
  );

create policy "flashcards_insert" on flashcards
  for insert with check (
    week_id in (select id from weeks where user_id = auth.uid())
  );

create policy "flashcards_update" on flashcards
  for update using (
    week_id in (select id from weeks where user_id = auth.uid())
  );

create policy "flashcards_delete" on flashcards
  for delete using (
    week_id in (select id from weeks where user_id = auth.uid())
  );

-- ============================================================
-- game_stats policies — user_id scoped
-- ============================================================
create policy "game_stats_select" on game_stats
  for select using (user_id = auth.uid());

create policy "game_stats_insert" on game_stats
  for insert with check (user_id = auth.uid());

create policy "game_stats_update" on game_stats
  for update using (user_id = auth.uid());

create policy "game_stats_delete" on game_stats
  for delete using (user_id = auth.uid());

-- ============================================================
-- profiles policies — own row only (trigger handles insert)
-- ============================================================
create policy "profiles_select" on profiles
  for select using (id = auth.uid());

create policy "profiles_update" on profiles
  for update using (id = auth.uid());

-- ============================================================
-- Account deletion function
-- ============================================================
create or replace function delete_user()
returns void
language sql
security definer set search_path = public
as $$
  delete from auth.users where id = auth.uid();
$$;

grant execute on function delete_user() to authenticated;
