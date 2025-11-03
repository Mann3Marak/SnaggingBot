-- Migration: Create inspection_results_pt table for Portuguese translations

create table if not exists public.inspection_results_pt (
  id uuid primary key default gen_random_uuid(),
  inspection_result_id uuid not null references public.inspection_results(id) on delete cascade,

  -- Translated fields
  notes_pt text,
  enhanced_notes_pt text,
  room_type_pt text,
  item_description_pt text,

  -- Metadata
  translated_at timestamptz default now(),
  translation_status text default 'completed',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for faster joins
create index if not exists idx_inspection_results_pt_result_id
  on public.inspection_results_pt (inspection_result_id);
