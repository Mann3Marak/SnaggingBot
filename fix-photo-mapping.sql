-- Fix Photo Mapping for Session: 5b6acc70-442d-4525-b22a-3c6c32ec1281
-- Problem: Photos exist in nhome_photos table but photo_urls array in inspection_results is empty
-- Solution: Update inspection_results.photo_urls with the correct Supabase storage URLs from nhome_photos

-- Step 1: View current state before fix
SELECT
  ir.id as result_id,
  ir.item_id,
  ct.room_type,
  ct.item_description,
  ir.status,
  ir.photo_urls as current_photo_urls,
  (
    SELECT array_agg(supabase_url ORDER BY created_at)
    FROM nhome_photos np
    WHERE np.session_id = ir.session_id
      AND np.item_id = ir.item_id
  ) as photos_from_nhome_photos_table
FROM inspection_results ir
JOIN checklist_templates ct ON ir.item_id = ct.id
WHERE ir.session_id = '5b6acc70-442d-4525-b22a-3c6c32ec1281'
  AND ir.status IN ('issue', 'critical')
ORDER BY ct.room_type, ct.order_sequence;

-- Step 2: Update inspection_results.photo_urls with URLs from nhome_photos
UPDATE inspection_results ir
SET photo_urls = (
  SELECT array_agg(supabase_url ORDER BY created_at)
  FROM nhome_photos np
  WHERE np.session_id = ir.session_id
    AND np.item_id = ir.item_id
)
WHERE ir.session_id = '5b6acc70-442d-4525-b22a-3c6c32ec1281'
  AND EXISTS (
    SELECT 1
    FROM nhome_photos np
    WHERE np.session_id = ir.session_id
      AND np.item_id = ir.item_id
  );

-- Step 3: Verify the fix
SELECT
  ir.id as result_id,
  ir.item_id,
  ct.room_type,
  ct.item_description,
  ir.status,
  array_length(ir.photo_urls, 1) as num_photos,
  ir.photo_urls
FROM inspection_results ir
JOIN checklist_templates ct ON ir.item_id = ct.id
WHERE ir.session_id = '5b6acc70-442d-4525-b22a-3c6c32ec1281'
  AND ir.status IN ('issue', 'critical')
  AND array_length(ir.photo_urls, 1) > 0
ORDER BY ct.room_type, ct.order_sequence;

-- Step 4: Summary of items WITH photos
SELECT
  'Items WITH photos' as category,
  COUNT(*) as count
FROM inspection_results ir
WHERE ir.session_id = '5b6acc70-442d-4525-b22a-3c6c32ec1281'
  AND ir.status IN ('issue', 'critical')
  AND array_length(ir.photo_urls, 1) > 0

UNION ALL

-- Summary of items WITHOUT photos
SELECT
  'Items WITHOUT photos' as category,
  COUNT(*) as count
FROM inspection_results ir
WHERE ir.session_id = '5b6acc70-442d-4525-b22a-3c6c32ec1281'
  AND ir.status IN ('issue', 'critical')
  AND (ir.photo_urls IS NULL OR array_length(ir.photo_urls, 1) = 0 OR array_length(ir.photo_urls, 1) IS NULL);
