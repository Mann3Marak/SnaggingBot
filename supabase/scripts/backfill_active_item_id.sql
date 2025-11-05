-- ============================================================================
-- Data Backfill Script: active_item_id for inspection_sessions
-- ============================================================================
-- Purpose: Populate active_item_id for existing inspection sessions based on
--          current_item_index to maintain historical data after schema migration.
--
-- Dependencies: Migration 20251104120000_extend_inspection_statuses.sql must be applied
--
-- Created: 2025-11-04
-- Ticket: Ticket 4 – Data Backfill Script for active_item_id
-- ============================================================================

-- ============================================================================
-- BACKFILL FUNCTION (Idempotent)
-- ============================================================================

CREATE OR REPLACE FUNCTION backfill_active_item_id()
RETURNS TABLE(
  session_id uuid,
  old_active_item_id uuid,
  new_active_item_id uuid,
  current_item_index integer,
  session_status text,
  action_taken text
) AS $$
BEGIN
  RETURN QUERY
  WITH session_data AS (
    -- Get all sessions that need backfilling
    SELECT
      s.id as session_id,
      s.active_item_id as old_active_item_id,
      s.current_item_index,
      s.status as session_status,
      a.apartment_type,
      a.id as apartment_id
    FROM inspection_sessions s
    JOIN apartments a ON a.id = s.apartment_id
    WHERE s.active_item_id IS NULL  -- Only update sessions without active_item_id
  ),
  matched_items AS (
    -- Match each session to the appropriate checklist item
    SELECT
      sd.session_id,
      sd.old_active_item_id,
      sd.current_item_index,
      sd.session_status,
      sd.apartment_type,
      ct.id as matched_item_id,
      ct.room_type,
      ct.item_description,
      ct.order_sequence
    FROM session_data sd
    LEFT JOIN checklist_templates ct ON
      ct.apartment_type = sd.apartment_type
      AND ct.order_sequence = sd.current_item_index
  ),
  updates AS (
    -- Perform the update and capture results
    UPDATE inspection_sessions s
    SET active_item_id = CASE
      -- For completed sessions, keep active_item_id as NULL
      WHEN mi.session_status = 'completed' THEN NULL
      -- For in-progress sessions, set to matched item (may be NULL if no match)
      ELSE mi.matched_item_id
    END
    FROM matched_items mi
    WHERE s.id = mi.session_id
      AND s.active_item_id IS NULL  -- Double-check idempotency
    RETURNING
      s.id as session_id,
      mi.old_active_item_id,
      s.active_item_id as new_active_item_id,
      s.current_item_index,
      s.status as session_status
  )
  SELECT
    u.session_id,
    u.old_active_item_id,
    u.new_active_item_id,
    u.current_item_index,
    u.session_status,
    CASE
      WHEN u.session_status = 'completed' THEN 'SKIPPED (completed session)'
      WHEN u.new_active_item_id IS NOT NULL THEN 'UPDATED (matched item)'
      ELSE 'SKIPPED (no matching item found)'
    END as action_taken
  FROM updates u;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- EXECUTE BACKFILL
-- ============================================================================

-- Run the backfill function and display results
SELECT * FROM backfill_active_item_id();

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- 1. Show summary of backfill results
SELECT
  CASE
    WHEN active_item_id IS NOT NULL THEN 'Has active_item_id'
    WHEN status = 'completed' THEN 'Completed (NULL is expected)'
    ELSE 'Missing active_item_id (needs investigation)'
  END as category,
  status,
  COUNT(*) as session_count
FROM inspection_sessions
GROUP BY
  CASE
    WHEN active_item_id IS NOT NULL THEN 'Has active_item_id'
    WHEN status = 'completed' THEN 'Completed (NULL is expected)'
    ELSE 'Missing active_item_id (needs investigation)'
  END,
  status
ORDER BY category, status;

-- 2. Verify active_item_id matches current_item_index for in-progress sessions
SELECT
  s.id as session_id,
  s.status,
  s.current_item_index,
  s.active_item_id,
  ct.order_sequence,
  ct.room_type,
  ct.item_description,
  CASE
    WHEN s.current_item_index = ct.order_sequence THEN 'MATCH ✓'
    ELSE 'MISMATCH ✗'
  END as validation_status
FROM inspection_sessions s
LEFT JOIN checklist_templates ct ON ct.id = s.active_item_id
WHERE s.status = 'in_progress'
  AND s.active_item_id IS NOT NULL
ORDER BY validation_status, s.id;

-- 3. Find sessions that still need attention (active_item_id is NULL but should have a value)
SELECT
  s.id as session_id,
  s.status,
  s.current_item_index,
  s.active_item_id,
  a.apartment_type,
  a.unit_number,
  COUNT(ct.id) as available_checklist_items
FROM inspection_sessions s
JOIN apartments a ON a.id = s.apartment_id
LEFT JOIN checklist_templates ct ON ct.apartment_type = a.apartment_type
WHERE s.active_item_id IS NULL
  AND s.status != 'completed'
GROUP BY s.id, s.status, s.current_item_index, s.active_item_id, a.apartment_type, a.unit_number
HAVING COUNT(ct.id) > 0
ORDER BY s.created_at DESC;

-- ============================================================================
-- CLEANUP (Optional)
-- ============================================================================

-- After verifying the backfill was successful, you can optionally drop the function
-- to keep the database clean:
--
-- DROP FUNCTION IF EXISTS backfill_active_item_id();

-- ============================================================================
-- NOTES FOR PRODUCTION USE
-- ============================================================================
--
-- 1. IDEMPOTENCY: This script can be run multiple times safely. It only updates
--    rows where active_item_id IS NULL.
--
-- 2. PERFORMANCE: For large datasets (>10,000 sessions), consider adding a LIMIT
--    and running the backfill in batches:
--
--    CREATE OR REPLACE FUNCTION backfill_active_item_id_batch(batch_size integer DEFAULT 1000)
--    RETURNS ... (modify the function to add LIMIT clause)
--
-- 3. EDGE CASES HANDLED:
--    - Completed sessions: active_item_id set to NULL
--    - Invalid current_item_index: active_item_id remains NULL (no match found)
--    - Missing apartment_type: active_item_id remains NULL (no checklist templates)
--
-- 4. ROLLBACK: If you need to undo the backfill:
--    UPDATE inspection_sessions SET active_item_id = NULL WHERE active_item_id IS NOT NULL;
--
-- 5. TESTING: Always test on a staging environment or local database first:
--    - Run the function: SELECT * FROM backfill_active_item_id();
--    - Verify results with the verification queries above
--    - Run the function again to confirm idempotency (should return 0 rows)
--
-- 6. LOGGING: Consider capturing the function output for audit purposes:
--    CREATE TABLE IF NOT EXISTS backfill_audit_log (
--      id uuid primary key default gen_random_uuid(),
--      execution_timestamp timestamp default now(),
--      sessions_updated integer,
--      execution_results jsonb
--    );
--
--    INSERT INTO backfill_audit_log (sessions_updated, execution_results)
--    SELECT COUNT(*), jsonb_agg(row_to_json(r))
--    FROM (SELECT * FROM backfill_active_item_id()) r;
