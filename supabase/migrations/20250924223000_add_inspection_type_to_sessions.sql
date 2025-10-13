-- Add inspection_type tracking for NHome inspection sessions
alter table inspection_sessions
  add column if not exists inspection_type text check (inspection_type in ('initial','follow_up')) default 'initial';

update inspection_sessions
set inspection_type = 'initial'
where inspection_type is null;

alter table inspection_sessions
  alter column inspection_type set not null;

create index if not exists idx_inspection_sessions_type on inspection_sessions(inspection_type);
