create table logs (
  id         uuid        default gen_random_uuid() primary key,
  type       text        not null check (type in ('error', 'event', 'perf')),
  page       text,
  action     text,
  message    text        not null,
  details    jsonb,
  created_at timestamptz default now()
);

create index logs_type_created_at_idx on logs (type, created_at desc);
