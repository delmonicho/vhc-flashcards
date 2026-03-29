-- Migration: public_decks
-- Adds is_public to weeks, fixes game_stats unique constraint,
-- and updates RLS policies to allow reading public decks across users.

-- 1. Add is_public (defaults false — all existing decks stay private on deploy)
alter table weeks
  add column is_public boolean not null default false;

-- 2. Fix game_stats unique constraint: per-user-per-week instead of per-week-globally.
--    The old constraint prevented two users from ever having stats for the same week,
--    which breaks when multiple users study the same public deck.
alter table game_stats
  drop constraint game_stats_week_id_unique;

alter table game_stats
  add constraint game_stats_user_week_unique unique (user_id, week_id);

-- 3. weeks SELECT: own rows OR any public deck
drop policy "weeks_select" on weeks;

create policy "weeks_select" on weeks
  for select using (
    user_id = auth.uid() or is_public = true
  );

-- 4. flashcards SELECT: cards in owned weeks OR public weeks
drop policy "flashcards_select" on flashcards;

create policy "flashcards_select" on flashcards
  for select using (
    week_id in (
      select id from weeks
      where user_id = auth.uid() or is_public = true
    )
  );

-- 5. profiles SELECT: any authenticated user can read any profile
--    (needed to show author display_name on public decks)
drop policy "profiles_select" on profiles;

create policy "profiles_select" on profiles
  for select using (auth.uid() is not null);

-- INSERT / UPDATE / DELETE policies on weeks, flashcards, game_stats are unchanged (owner-only).
