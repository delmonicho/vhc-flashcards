create table card_mastery (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  card_id uuid references flashcards(id) on delete cascade not null,
  deck_id uuid references decks(id) on delete cascade not null,
  correct int default 0 not null,
  incorrect int default 0 not null,
  streak int default 0 not null,
  last_seen timestamptz,
  first_seen timestamptz default now() not null,
  sessions_count int default 1 not null,
  created_at timestamptz default now(),
  unique(user_id, card_id)
);

alter table card_mastery enable row level security;

create policy "Users can manage their own card mastery"
  on card_mastery
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
