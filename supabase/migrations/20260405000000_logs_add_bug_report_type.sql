alter table logs
  drop constraint if exists logs_type_check;

alter table logs
  add constraint logs_type_check
    check (type in ('error', 'event', 'perf', 'bug-report'));
