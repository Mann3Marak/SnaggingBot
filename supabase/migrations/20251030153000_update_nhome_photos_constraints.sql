-- Migration: Align nhome_photos foreign key with checklist templates and add metadata fields

alter table if exists public.nhome_photos
  drop constraint if exists nhome_photos_item_id_fkey;

alter table if exists public.nhome_photos
  add column if not exists metadata jsonb,
  add column if not exists file_size bigint,
  add column if not exists image_dimensions jsonb;

alter table if exists public.nhome_photos
  add constraint nhome_photos_item_id_fkey
  foreign key (item_id)
  references checklist_templates(id)
  on delete set null;
