-- ============================================================================
-- QA Test Scenarios for active_item_id Backfill
-- ============================================================================
-- Purpose: Create test data and verify backfill script correctness
-- Usage: Run this in a LOCAL or STAGING environment (NEVER in production)
-- ============================================================================

-- ============================================================================
-- SCENARIO 1: Create Test Data with Various States
-- ============================================================================

-- Clean up any previous test data (optional)
-- DELETE FROM inspection_sessions WHERE id IN (SELECT id FROM inspection_sessions ORDER BY created_at DESC LIMIT 10);

-- Create test inspection sessions with different scenarios
DO $$
DECLARE
  v_apartment_id uuid;
  v_inspector_id uuid;
  v_apartment_type text;
  v_checklist_count integer;
BEGIN
  -- Get a test apartment and inspector
  SELECT id, apartment_type INTO v_apartment_id, v_apartment_type
  FROM apartments
  LIMIT 1;

  SELECT id INTO v_inspector_id
  FROM users
  WHERE role = 'inspector'
  LIMIT 1;

  -- Get checklist count for this apartment type
  SELECT COUNT(*) INTO v_checklist_count
  FROM checklist_templates
  WHERE apartment_type = v_apartment_type;

  RAISE NOTICE 'Using apartment_type: %, checklist items: %', v_apartment_type, v_checklist_count;

  -- Test Case 1: In-progress session at start (index 0)
  INSERT INTO inspection_sessions (apartment_id, inspector_id, status, current_item_index, active_item_id)
  VALUES (v_apartment_id, v_inspector_id, 'in_progress', 0, NULL);
  RAISE NOTICE 'Created test case 1: in_progress at index 0';

  -- Test Case 2: In-progress session in middle (index 5)
  INSERT INTO inspection_sessions (apartment_id, inspector_id, status, current_item_index, active_item_id)
  VALUES (v_apartment_id, v_inspector_id, 'in_progress', 5, NULL);
  RAISE NOTICE 'Created test case 2: in_progress at index 5';

  -- Test Case 3: In-progress session near end (index = checklist_count - 1)
  INSERT INTO inspection_sessions (apartment_id, inspector_id, status, current_item_index, active_item_id)
  VALUES (v_apartment_id, v_inspector_id, 'in_progress', GREATEST(v_checklist_count - 1, 0), NULL);
  RAISE NOTICE 'Created test case 3: in_progress near end';

  -- Test Case 4: Completed session (should remain NULL)
  INSERT INTO inspection_sessions (apartment_id, inspector_id, status, current_item_index, active_item_id, completed_at)
  VALUES (v_apartment_id, v_inspector_id, 'completed', v_checklist_count, NULL, NOW());
  RAISE NOTICE 'Created test case 4: completed session';

  -- Test Case 5: Pending session (should be updated)
  INSERT INTO inspection_sessions (apartment_id, inspector_id, status, current_item_index, active_item_id)
  VALUES (v_apartment_id, v_inspector_id, 'pending', 0, NULL);
  RAISE NOTICE 'Created test case 5: pending session';

  -- Test Case 6: Session with out-of-bounds index (should remain NULL)
  INSERT INTO inspection_sessions (apartment_id, inspector_id, status, current_item_index, active_item_id)
  VALUES (v_apartment_id, v_inspector_id, 'in_progress', v_checklist_count + 10, NULL);
  RAISE NOTICE 'Created test case 6: out-of-bounds index';

  -- Test Case 7: Session already has active_item_id (should be skipped)
  INSERT INTO inspection_sessions (apartment_id, inspector_id, status, current_item_index, active_item_id)
  VALUES (
    v_apartment_id,
    v_inspector_id,
    'in_progress',
    3,
    (SELECT id FROM checklist_templates WHERE apartment_type = v_apartment_type ORDER BY order_sequence LIMIT 1)
  );
  RAISE NOTICE 'Created test case 7: already has active_item_id';

END $$;

-- ============================================================================
-- SCENARIO 2: Capture BEFORE State
-- ============================================================================

-- Create temporary table to store before-state for comparison
CREATE TEMP TABLE IF NOT EXISTS backfill_before_state AS
SELECT
  id as session_id,
  status,
  current_item_index,
  active_item_id,
  created_at
FROM inspection_sessions
WHERE created_at > NOW() - INTERVAL '1 hour'  -- Only recent test sessions
ORDER BY created_at DESC;

-- Display BEFORE state
SELECT
  'BEFORE BACKFILL' as state,
  status,
  current_item_index,
  CASE
    WHEN active_item_id IS NOT NULL THEN 'HAS VALUE'
    ELSE 'NULL'
  END as active_item_status,
  COUNT(*) as count
FROM backfill_before_state
GROUP BY status, current_item_index, active_item_id
ORDER BY status, current_item_index;

-- Show detailed BEFORE state
SELECT
  'BEFORE' as timing,
  session_id,
  status,
  current_item_index,
  active_item_id
FROM backfill_before_state
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- SCENARIO 3: Execute Backfill (FIRST RUN)
-- ============================================================================

SELECT '========================================' as separator;
SELECT 'EXECUTING BACKFILL - FIRST RUN' as message;
SELECT '========================================' as separator;

-- Run the backfill function and display results
SELECT * FROM backfill_active_item_id();

-- ============================================================================
-- SCENARIO 4: Capture AFTER State and Compare
-- ============================================================================

-- Create temporary table for after-state
CREATE TEMP TABLE IF NOT EXISTS backfill_after_state AS
SELECT
  id as session_id,
  status,
  current_item_index,
  active_item_id,
  created_at
FROM inspection_sessions
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Display AFTER state
SELECT
  'AFTER BACKFILL' as state,
  status,
  current_item_index,
  CASE
    WHEN active_item_id IS NOT NULL THEN 'HAS VALUE'
    ELSE 'NULL'
  END as active_item_status,
  COUNT(*) as count
FROM backfill_after_state
GROUP BY status, current_item_index, active_item_id
ORDER BY status, current_item_index;

-- Compare BEFORE vs AFTER
SELECT
  b.session_id,
  b.status,
  b.current_item_index,
  b.active_item_id as before_active_item_id,
  a.active_item_id as after_active_item_id,
  CASE
    WHEN b.status = 'completed' AND a.active_item_id IS NULL THEN 'CORRECT (completed should be NULL)'
    WHEN b.status != 'completed' AND b.active_item_id IS NULL AND a.active_item_id IS NOT NULL THEN 'UPDATED ✓'
    WHEN b.active_item_id IS NOT NULL AND a.active_item_id = b.active_item_id THEN 'UNCHANGED (already had value)'
    WHEN b.active_item_id IS NULL AND a.active_item_id IS NULL THEN 'NOT UPDATED (no match found)'
    ELSE 'UNEXPECTED STATE ✗'
  END as result_analysis
FROM backfill_before_state b
JOIN backfill_after_state a ON a.session_id = b.session_id
ORDER BY b.created_at DESC;

-- ============================================================================
-- SCENARIO 5: Validate Data Integrity
-- ============================================================================

SELECT '========================================' as separator;
SELECT 'VALIDATION: Matching Logic' as message;
SELECT '========================================' as separator;

-- Verify that active_item_id matches current_item_index
SELECT
  s.id as session_id,
  s.status,
  s.current_item_index,
  ct.order_sequence,
  ct.room_type,
  ct.item_description,
  CASE
    WHEN s.current_item_index = ct.order_sequence THEN 'MATCH ✓'
    ELSE 'MISMATCH ✗'
  END as validation_result
FROM inspection_sessions s
JOIN checklist_templates ct ON ct.id = s.active_item_id
WHERE s.created_at > NOW() - INTERVAL '1 hour'
  AND s.active_item_id IS NOT NULL
ORDER BY validation_result DESC, s.created_at DESC;

-- Count validation results
SELECT
  CASE
    WHEN s.current_item_index = ct.order_sequence THEN 'MATCH ✓'
    ELSE 'MISMATCH ✗'
  END as validation_result,
  COUNT(*) as count
FROM inspection_sessions s
JOIN checklist_templates ct ON ct.id = s.active_item_id
WHERE s.created_at > NOW() - INTERVAL '1 hour'
  AND s.active_item_id IS NOT NULL
GROUP BY validation_result;

-- ============================================================================
-- SCENARIO 6: Test Idempotency (SECOND RUN)
-- ============================================================================

SELECT '========================================' as separator;
SELECT 'EXECUTING BACKFILL - SECOND RUN (Idempotency Test)' as message;
SELECT '========================================' as separator;

-- Run backfill again - should return 0 rows
SELECT * FROM backfill_active_item_id();

-- Verify no changes occurred
SELECT
  'IDEMPOTENCY CHECK' as test_name,
  CASE
    WHEN COUNT(*) = 0 THEN 'PASS ✓ (No changes on second run)'
    ELSE 'FAIL ✗ (Unexpected changes on second run)'
  END as result
FROM (
  SELECT * FROM backfill_active_item_id()
) second_run;

-- ============================================================================
-- SCENARIO 7: Edge Case Testing
-- ============================================================================

SELECT '========================================' as separator;
SELECT 'EDGE CASE ANALYSIS' as message;
SELECT '========================================' as separator;

-- Find sessions that were NOT updated (excluding completed)
SELECT
  'Sessions NOT Updated (excluding completed)' as category,
  s.id as session_id,
  s.status,
  s.current_item_index,
  s.active_item_id,
  a.apartment_type,
  (SELECT COUNT(*) FROM checklist_templates WHERE apartment_type = a.apartment_type) as checklist_count,
  CASE
    WHEN s.current_item_index >= (SELECT COUNT(*) FROM checklist_templates WHERE apartment_type = a.apartment_type)
      THEN 'Index out of bounds'
    WHEN NOT EXISTS (SELECT 1 FROM checklist_templates WHERE apartment_type = a.apartment_type)
      THEN 'No checklist templates for apartment type'
    ELSE 'Unknown reason'
  END as reason
FROM inspection_sessions s
JOIN apartments a ON a.id = s.apartment_id
WHERE s.created_at > NOW() - INTERVAL '1 hour'
  AND s.status != 'completed'
  AND s.active_item_id IS NULL;

-- ============================================================================
-- SCENARIO 8: Summary Report
-- ============================================================================

SELECT '========================================' as separator;
SELECT 'BACKFILL TEST SUMMARY REPORT' as message;
SELECT '========================================' as separator;

-- Overall statistics
SELECT
  'Test Sessions Created' as metric,
  COUNT(*) as value
FROM inspection_sessions
WHERE created_at > NOW() - INTERVAL '1 hour'
UNION ALL
SELECT
  'Sessions Updated (active_item_id populated)',
  COUNT(*)
FROM inspection_sessions
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND active_item_id IS NOT NULL
  AND status != 'completed'
UNION ALL
SELECT
  'Completed Sessions (active_item_id = NULL)',
  COUNT(*)
FROM inspection_sessions
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND status = 'completed'
  AND active_item_id IS NULL
UNION ALL
SELECT
  'Validation Matches',
  COUNT(*)
FROM inspection_sessions s
JOIN checklist_templates ct ON ct.id = s.active_item_id
WHERE s.created_at > NOW() - INTERVAL '1 hour'
  AND s.current_item_index = ct.order_sequence
UNION ALL
SELECT
  'Validation Mismatches',
  COUNT(*)
FROM inspection_sessions s
JOIN checklist_templates ct ON ct.id = s.active_item_id
WHERE s.created_at > NOW() - INTERVAL '1 hour'
  AND s.current_item_index != ct.order_sequence;

-- ============================================================================
-- SCENARIO 9: Performance Test (Optional)
-- ============================================================================

-- Only run this if you have a large dataset
/*
SELECT '========================================' as separator;
SELECT 'PERFORMANCE TEST' as message;
SELECT '========================================' as separator;

-- Time the backfill function execution
EXPLAIN ANALYZE
SELECT * FROM backfill_active_item_id();

-- Check index usage
EXPLAIN
SELECT *
FROM inspection_sessions s
JOIN checklist_templates ct ON ct.id = s.active_item_id
WHERE s.status = 'in_progress';
*/

-- ============================================================================
-- CLEANUP (Optional)
-- ============================================================================

-- Uncomment to remove test data after verification
/*
DELETE FROM inspection_sessions
WHERE created_at > NOW() - INTERVAL '1 hour';

DROP TABLE IF EXISTS backfill_before_state;
DROP TABLE IF EXISTS backfill_after_state;
*/

-- ============================================================================
-- QA SIGN-OFF CHECKLIST
-- ============================================================================

SELECT '========================================' as separator;
SELECT 'QA VERIFICATION CHECKLIST' as message;
SELECT '========================================' as separator;

-- Display checklist for QA to verify
SELECT
  CASE
    WHEN test_number = 1 THEN '[ ] Test data created successfully (7 scenarios)'
    WHEN test_number = 2 THEN '[ ] BEFORE state captured'
    WHEN test_number = 3 THEN '[ ] Backfill executed (first run) - sessions updated'
    WHEN test_number = 4 THEN '[ ] AFTER state shows changes'
    WHEN test_number = 5 THEN '[ ] All validation checks show MATCH ✓'
    WHEN test_number = 6 THEN '[ ] Idempotency test passed (0 rows on second run)'
    WHEN test_number = 7 THEN '[ ] Completed sessions remain NULL'
    WHEN test_number = 8 THEN '[ ] In-progress sessions have active_item_id'
    WHEN test_number = 9 THEN '[ ] Out-of-bounds sessions handled correctly'
    WHEN test_number = 10 THEN '[ ] No unexpected errors in logs'
    ELSE 'Unknown test'
  END as qa_checklist_item
FROM generate_series(1, 10) as test_number;

-- ============================================================================
-- END OF TEST SCENARIOS
-- ============================================================================
