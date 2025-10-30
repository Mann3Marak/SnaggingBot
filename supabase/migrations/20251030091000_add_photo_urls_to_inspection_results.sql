-- Migration: Add photo_urls column to inspection_results table

alter table public.inspection_results
add column if not exists photo_urls jsonb default '[]'::jsonb;

-- Optional: backfill logic can be added here if needed later
-- update public.inspection_results set photo_urls = '[]'::jsonb where photo_urls is null;

-- Refresh schema cache
notify pgrst, 'reload schema';
