-- Supabase storage bucket + metadata updates for NHome inspection photos
insert into storage.buckets (id, name, public)
values ('nhome_photos', 'nhome_photos', false)
on conflict (id) do update set public = excluded.public;

alter table nhome_inspection_photos
  add column if not exists bucket_id text default 'nhome_photos',
  add column if not exists storage_path text,
  add column if not exists uploaded_by uuid references users(id) on delete set null,
  add column if not exists signed_url_expires_at timestamptz,
  add column if not exists checksum text;

update nhome_inspection_photos
set bucket_id = 'nhome_photos'
where bucket_id is null;

update nhome_inspection_photos
set storage_path = coalesce(
  storage_path,
  concat(
    session_id::text,
    '/',
    coalesce(item_id::text, 'general'),
    '/',
    coalesce(replace(file_name, ' ', '_'), 'photo.jpg')
  )
)
where storage_path is null;

alter table nhome_inspection_photos
  alter column bucket_id set not null,
  alter column storage_path set not null;

create unique index if not exists idx_nhome_inspection_photos_session_item
  on nhome_inspection_photos(session_id, item_id, storage_path);

alter table nhome_inspection_photos
  drop column if exists onedrive_url,
  drop column if exists folder_path,
  drop column if exists company,
  drop column if exists location,
  drop column if exists image_dimensions,
  drop column if exists professional_watermark;

drop policy if exists "NHome team can access photos" on nhome_inspection_photos;
create policy "NHome team can access photos" on nhome_inspection_photos
  for all
  using (
    exists (
      select 1
      from inspection_sessions
      where inspection_sessions.id = nhome_inspection_photos.session_id
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
      where inspection_sessions.id = nhome_inspection_photos.session_id
        and (
          inspection_sessions.inspector_id = auth.uid()
          or exists (
            select 1 from users where id = auth.uid() and role in ('admin','manager')
          )
        )
    )
  );

create policy if not exists "NHome photos read" on storage.objects
  for select
  using (
    bucket_id = 'nhome_photos'
    and (
      owner = auth.uid()
      or exists (select 1 from users where id = auth.uid() and role in ('admin','manager'))
    )
  );

create policy if not exists "NHome photos write" on storage.objects
  for insert
  with check (
    bucket_id = 'nhome_photos'
    and owner = auth.uid()
  );

create policy if not exists "NHome photos modify" on storage.objects
  for update
  using (
    bucket_id = 'nhome_photos'
    and (
      owner = auth.uid()
      or exists (select 1 from users where id = auth.uid() and role in ('admin','manager'))
    )
  )
  with check (
    bucket_id = 'nhome_photos'
    and (
      owner = auth.uid()
      or exists (select 1 from users where id = auth.uid() and role in ('admin','manager'))
    )
  );

create policy if not exists "NHome photos remove" on storage.objects
  for delete
  using (
    bucket_id = 'nhome_photos'
    and (
      owner = auth.uid()
      or exists (select 1 from users where id = auth.uid() and role in ('admin','manager'))
    )
  );
