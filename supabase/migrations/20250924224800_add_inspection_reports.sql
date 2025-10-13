-- Metadata table for generated NHome inspection reports
create table if not exists nhome_inspection_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references inspection_sessions(id) on delete cascade,
  language text not null check (language in ('pt-PT','en-US','summary')),
  storage_path text,
  public_url text,
  bucket_id text default 'nhome_reports',
  generated_at timestamptz default timezone('utc', now()),
  error jsonb,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz default timezone('utc', now()),
  updated_at timestamptz default timezone('utc', now())
);

insert into storage.buckets (id, name, public)
values ('nhome_reports', 'nhome_reports', false)
on conflict (id) do nothing;

create unique index if not exists uq_nhome_inspection_reports_session_lang
  on nhome_inspection_reports(session_id, language);

create index if not exists idx_nhome_inspection_reports_generated_at
  on nhome_inspection_reports(generated_at desc);

alter table nhome_inspection_reports enable row level security;

drop policy if exists "NHome team manage reports" on nhome_inspection_reports;
create policy "NHome team manage reports" on nhome_inspection_reports
  for all
  using (
    exists (
      select 1
      from inspection_sessions
      where inspection_sessions.id = nhome_inspection_reports.session_id
        and (
          inspection_sessions.inspector_id = auth.uid()
          or exists (
            select 1 from users where id = auth.uid() and role in ('admin','manager')
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from inspection_sessions
      where inspection_sessions.id = nhome_inspection_reports.session_id
        and (
          inspection_sessions.inspector_id = auth.uid()
          or exists (
            select 1 from users where id = auth.uid() and role in ('admin','manager')
          )
        )
    )
  );

create policy if not exists "NHome reports read" on storage.objects
  for select using (
    bucket_id = 'nhome_reports'
    and (
      owner = auth.uid()
      or exists (select 1 from users where id = auth.uid() and role in ('admin','manager'))
    )
  );

create policy if not exists "NHome reports write" on storage.objects
  for insert with check (
    bucket_id = 'nhome_reports'
    and owner = auth.uid()
  );

create policy if not exists "NHome reports modify" on storage.objects
  for update using (
    bucket_id = 'nhome_reports'
    and (
      owner = auth.uid()
      or exists (select 1 from users where id = auth.uid() and role in ('admin','manager'))
    )
  ) with check (
    bucket_id = 'nhome_reports'
    and (
      owner = auth.uid()
      or exists (select 1 from users where id = auth.uid() and role in ('admin','manager'))
    )
  );

create policy if not exists "NHome reports remove" on storage.objects
  for delete using (
    bucket_id = 'nhome_reports'
    and (
      owner = auth.uid()
      or exists (select 1 from users where id = auth.uid() and role in ('admin','manager'))
    )
  );

