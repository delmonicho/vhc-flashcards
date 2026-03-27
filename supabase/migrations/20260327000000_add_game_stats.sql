create table game_stats (
  id uuid default gen_random_uuid() primary key,
  user_id uuid,
  week_id uuid references weeks(id),
  xp int default 0,
  cards_mastered int default 0,
  streak_days int default 0,
  last_played date,
  created_at timestamptz default now(),
  constraint game_stats_week_id_unique unique (week_id)
);
