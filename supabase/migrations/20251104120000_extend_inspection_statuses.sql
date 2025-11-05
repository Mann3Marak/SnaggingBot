-- Migration: Extend Inspection Result Status Values & Add Active Item Tracking
-- Created: 2025-11-04
-- Dependencies: Ticket 1 (inspection-data-flow.md), Ticket 2 (inspection-navigation-wireframe.md)
--
-- Purpose:
-- 1. Extend inspection_results.status to support 'skipped' and 'not_applicable' values
-- 2. Add active_item_id to inspection_sessions for tracking the current checklist item
--
-- This migration enables:
-- - Skipping items that are not present in the unit (e.g., balcony in ground floor unit)
-- - Marking items as not applicable based on property configuration
-- - Direct navigation to any checklist item (instead of sequential navigation only)
-- - Room-based navigation UI as proposed in Ticket 2

-- ============================================================================
-- PART 1: Extend inspection_results.status constraint
-- ============================================================================

-- PostgreSQL uses named constraints, so we need to:
-- 1. Find the constraint name (it's auto-generated or explicitly named)
-- 2. Drop the old constraint
-- 3. Add the new constraint with extended values

-- Drop the existing CHECK constraint on inspection_results.status
-- Note: The constraint name is typically auto-generated as "inspection_results_status_check"
ALTER TABLE inspection_results
DROP CONSTRAINT IF EXISTS inspection_results_status_check;

-- Add the new CHECK constraint with extended status values
ALTER TABLE inspection_results
ADD CONSTRAINT inspection_results_status_check
CHECK (status IN ('good', 'issue', 'critical', 'skipped', 'not_applicable'));

-- Verify the constraint was added successfully
COMMENT ON CONSTRAINT inspection_results_status_check ON inspection_results IS
'Allowed status values: good (meets standards), issue (minor defect), critical (major defect/safety), skipped (item not inspected), not_applicable (item does not exist in this unit)';

-- ============================================================================
-- PART 2: Add active_item_id column to inspection_sessions
-- ============================================================================

-- Add active_item_id column to track the current checklist item being inspected
-- This replaces reliance on current_item_index for direct item access
ALTER TABLE inspection_sessions
ADD COLUMN IF NOT EXISTS active_item_id uuid REFERENCES checklist_templates(id) ON DELETE SET NULL;

-- Add index for performance when querying active item
CREATE INDEX IF NOT EXISTS idx_inspection_sessions_active_item
ON inspection_sessions(active_item_id);

-- Add comment explaining the column purpose
COMMENT ON COLUMN inspection_sessions.active_item_id IS
'UUID reference to the checklist item currently being inspected. Enables direct navigation to any item instead of sequential index-based navigation. NULL when inspection is not active or completed.';

-- ============================================================================
-- PART 3: Data migration (if needed)
-- ============================================================================

-- For existing sessions, we can optionally set active_item_id based on current_item_index
-- This migration does NOT automatically populate active_item_id for existing sessions
-- because current_item_index is 0-indexed and may not reliably map to a specific item UUID
-- without knowing the apartment_type and order_sequence.
--
-- If needed, a backfill script can be run separately:
-- UPDATE inspection_sessions s
-- SET active_item_id = (
--   SELECT ct.id
--   FROM checklist_templates ct
--   JOIN apartments a ON a.id = s.apartment_id
--   WHERE ct.apartment_type = a.apartment_type
--   ORDER BY ct.order_sequence
--   OFFSET s.current_item_index
--   LIMIT 1
-- )
-- WHERE s.status = 'in_progress' AND s.active_item_id IS NULL;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
--
-- To rollback this migration manually:
--
-- 1. Remove the active_item_id column:
--    ALTER TABLE inspection_sessions DROP COLUMN IF EXISTS active_item_id;
--
-- 2. Drop the index (will be auto-dropped with column, but explicit for clarity):
--    DROP INDEX IF EXISTS idx_inspection_sessions_active_item;
--
-- 3. Revert the status constraint to original values:
--    ALTER TABLE inspection_results DROP CONSTRAINT IF EXISTS inspection_results_status_check;
--    ALTER TABLE inspection_results ADD CONSTRAINT inspection_results_status_check
--    CHECK (status IN ('good', 'issue', 'critical'));
--
-- 4. Remove any inspection results with 'skipped' or 'not_applicable' status (optional):
--    DELETE FROM inspection_results WHERE status IN ('skipped', 'not_applicable');
--
-- Note: Always backup your database before running migrations or rollbacks!

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
--
-- After running this migration, verify the changes:
--
-- 1. Check the new constraint on inspection_results:
--    SELECT conname, pg_get_constraintdef(oid)
--    FROM pg_constraint
--    WHERE conrelid = 'inspection_results'::regclass
--      AND conname = 'inspection_results_status_check';
--
-- 2. Verify active_item_id column exists:
--    \d inspection_sessions
--    -- OR --
--    SELECT column_name, data_type, is_nullable
--    FROM information_schema.columns
--    WHERE table_name = 'inspection_sessions' AND column_name = 'active_item_id';
--
-- 3. Check the index was created:
--    SELECT indexname, indexdef
--    FROM pg_indexes
--    WHERE tablename = 'inspection_sessions' AND indexname = 'idx_inspection_sessions_active_item';
--
-- 4. Test inserting a record with new status values:
--    -- This should succeed:
--    INSERT INTO inspection_results (session_id, item_id, status, notes)
--    VALUES ('some-session-uuid', 'some-item-uuid', 'skipped', 'Item not present in unit');
--
--    -- This should fail (invalid status):
--    INSERT INTO inspection_results (session_id, item_id, status)
--    VALUES ('some-session-uuid', 'some-item-uuid', 'invalid_status');
