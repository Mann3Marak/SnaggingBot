-- Add unique constraint on (session_id, item_id) to prevent duplicate results
-- First, remove any existing duplicates by keeping only the most recent entry

-- Create a temporary table to identify duplicates
WITH duplicates AS (
  SELECT id, session_id, item_id,
         ROW_NUMBER() OVER (PARTITION BY session_id, item_id ORDER BY created_at DESC) as rn
  FROM inspection_results
)
DELETE FROM inspection_results
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Now add the unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS uq_inspection_results_session_item
ON inspection_results (session_id, item_id);
