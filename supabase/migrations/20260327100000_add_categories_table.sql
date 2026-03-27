create table categories (
  id text primary key,
  label text not null,
  color text not null,
  created_at timestamptz default now()
);
