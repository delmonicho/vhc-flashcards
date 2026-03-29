-- Migration: rename_weeks_to_decks
-- Renames the `weeks` table to `decks` and `week_id` columns to `deck_id`
-- throughout the schema, and rebuilds affected RLS policies.

-- 1. Rename table
alter table weeks rename to decks;

-- 2. Rename foreign key columns
alter table flashcards rename column week_id to deck_id;
alter table game_stats rename column week_id to deck_id;

-- 3. Rename unique constraint on game_stats
alter table game_stats
  drop constraint game_stats_user_week_unique;
alter table game_stats
  add constraint game_stats_user_deck_unique unique (user_id, deck_id);

-- 4. Rebuild flashcards SELECT policy (references old column name)
drop policy "flashcards_select" on flashcards;
create policy "flashcards_select" on flashcards
  for select using (
    deck_id in (
      select id from decks
      where user_id = auth.uid() or is_public = true
    )
  );

-- 5. Rebuild decks SELECT policy (was "weeks_select" on the now-renamed table)
drop policy "weeks_select" on decks;
create policy "decks_select" on decks
  for select using (
    user_id = auth.uid() or is_public = true
  );

-- 6. Rename stale INSERT / UPDATE / DELETE policy names on decks
alter policy "weeks_insert" on decks rename to "decks_insert";
alter policy "weeks_update" on decks rename to "decks_update";
alter policy "weeks_delete" on decks rename to "decks_delete";
