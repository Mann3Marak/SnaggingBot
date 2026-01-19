-- Diagnostic queries for session: 5b6acc70-442d-4525-b22a-3c6c32ec1281

-- Query 1: Check nhome_photos table for this session
SELECT
  id,
  session_id,
  item_id,
  file_name,
  supabase_url,
  inspector_name,
  created_at,
  -- Check if item_id looks like a UUID
  item_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' as is_valid_uuid
FROM public.nhome_photos
WHERE session_id = '5b6acc70-442d-4525-b22a-3c6c32ec1281'
ORDER BY created_at;

-- Query 2: Count photos for this session
SELECT COUNT(*) as total_photos
FROM public.nhome_photos
WHERE session_id = '5b6acc70-442d-4525-b22a-3c6c32ec1281';

-- Query 3: Check inspection_results for this session with photo_urls
SELECT
  id,
  session_id,
  item_id,
  status,
  notes,
  photo_urls,
  jsonb_array_length(COALESCE(photo_urls, '[]'::jsonb)) as photo_count
FROM public.inspection_results
WHERE session_id = '5b6acc70-442d-4525-b22a-3c6c32ec1281'
  AND (photo_urls IS NOT NULL AND photo_urls != '[]'::jsonb);

-- Query 4: Check all inspection_results for this session (even without photos)
SELECT
  id,
  session_id,
  item_id,
  status,
  notes,
  COALESCE(jsonb_array_length(photo_urls), 0) as photo_count
FROM public.inspection_results
WHERE session_id = '5b6acc70-442d-4525-b22a-3c6c32ec1281'
ORDER BY created_at;

-- Query 5: Look for photos with potentially invalid item_ids (non-UUID strings)
SELECT
  id,
  session_id,
  item_id,
  file_name,
  supabase_url,
  -- Try to see if item_id is a description string
  CASE
    WHEN item_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN 'INVALID_UUID'
    ELSE 'VALID_UUID'
  END as uuid_status
FROM public.nhome_photos
WHERE session_id = '5b6acc70-442d-4525-b22a-3c6c32ec1281';

-- Query 6: Get session details
SELECT
  id,
  project_id,
  apartment_id,
  status,
  inspection_type,
  created_at
FROM public.inspection_sessions
WHERE id = '5b6acc70-442d-4525-b22a-3c6c32ec1281';

-- Query 7: Match photos to items by parsing filename
-- Filenames follow pattern: NHome_{project}_{apartment}_{room}___{item}_{timestamp}.jpg
SELECT
  np.id as photo_id,
  np.file_name,
  np.item_id as stored_item_id,
  np.supabase_url,
  -- Extract room and item from filename (very rough parsing)
  split_part(split_part(np.file_name, '___', 2), '_2026-', 1) as extracted_item_description
FROM public.nhome_photos np
WHERE np.session_id = '5b6acc70-442d-4525-b22a-3c6c32ec1281'
ORDER BY np.created_at;
