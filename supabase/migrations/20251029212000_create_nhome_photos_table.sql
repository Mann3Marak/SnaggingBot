-- Migration: Create nhome_photos table for storing photo metadata
-- This table links uploaded photos to inspection sessions and results.

create table if not exists public.nhome_photos (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references inspection_sessions(id) on delete cascade,
  item_id uuid references checklist_templates(id) on delete set null,
  file_name text,
  supabase_url text,
  inspector_name text,
  metadata jsonb,
  file_size bigint,
  image_dimensions jsonb,
  created_at timestamptz default now()
);

-- Enable Row Level Security for safety
alter table public.nhome_photos enable row level security;

-- Allow service role full access (used by backend/report generation)
create policy "Service role full access"
on public.nhome_photos
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- Allow authenticated users to insert and view their own photos
create policy "Authenticated users can insert photos"
on public.nhome_photos
for insert
to authenticated
with check (true);

create policy "Authenticated users can view photos"
on public.nhome_photos
for select
to authenticated
using (true);

-- Refresh schema cache
notify pgrst, 'reload schema';
