# Data Backfill Guide: active_item_id Column

**Migration:** 20251104120000_extend_inspection_statuses.sql
**Backfill Script:** supabase/scripts/backfill_active_item_id.sql
**Created:** 2025-11-04
**Ticket:** Ticket 4 – Data Backfill Script for active_item_id

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Local Testing](#local-testing)
4. [Production Execution](#production-execution)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)
7. [Rollback](#rollback)

---

## Overview

### What Does This Script Do?

After applying migration `20251104120000_extend_inspection_statuses.sql`, the `inspection_sessions` table has a new column `active_item_id` that references the current checklist item being inspected.

This backfill script populates `active_item_id` for **existing inspection sessions** by:
1. Reading the `current_item_index` (0-indexed position)
2. Matching it to a `checklist_templates` record with the same `order_sequence`
3. Ensuring the `apartment_type` matches between session and checklist
4. Setting `active_item_id` to the matched checklist item UUID

### Why Is This Needed?

**Before Migration:**
- Navigation relied solely on `current_item_index` (integer position)
- No direct reference to the actual checklist item

**After Migration:**
- New navigation UI (Ticket 2) uses `active_item_id` for direct item access
- Allows jumping to specific rooms/items instead of sequential navigation
- Historical sessions need backfilling to maintain data integrity

### What Sessions Are Updated?

| Session Status | Backfill Behavior |
|----------------|-------------------|
| `in_progress` or `pending` | `active_item_id` set to matched checklist item |
| `completed` | `active_item_id` remains `NULL` (inspection finished) |
| No matching checklist item | `active_item_id` remains `NULL` (logged for investigation) |

---

## Prerequisites

Before running the backfill script, ensure:

- [x] Migration `20251104120000_extend_inspection_statuses.sql` has been applied
- [x] You have database admin access (or `postgres` role)
- [x] You have a backup of the production database (if running in production)
- [x] You have tested the script on local/staging environment first

**Verify Migration Applied:**

```sql
-- Check if active_item_id column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'inspection_sessions'
  AND column_name = 'active_item_id';
```

Expected output:
```
 column_name    | data_type | is_nullable
----------------+-----------+-------------
 active_item_id | uuid      | YES
```

---

## Local Testing

### Step 1: Create Test Data

First, create some sample inspection sessions with various states:

```sql
-- Insert test sessions with different statuses
WITH test_apartment AS (
  SELECT id, apartment_type FROM apartments LIMIT 1
),
test_inspector AS (
  SELECT id FROM users WHERE role = 'inspector' LIMIT 1
)
INSERT INTO inspection_sessions (apartment_id, inspector_id, status, current_item_index)
SELECT
  ta.id,
  ti.id,
  CASE
    WHEN i = 1 THEN 'in_progress'
    WHEN i = 2 THEN 'completed'
    ELSE 'pending'
  END,
  i * 3  -- Different item indices
FROM test_apartment ta
CROSS JOIN test_inspector ti
CROSS JOIN generate_series(0, 4) AS i;

-- Verify test data created
SELECT id, status, current_item_index, active_item_id
FROM inspection_sessions
ORDER BY created_at DESC
LIMIT 5;
```

Expected: 5 sessions with `active_item_id = NULL`

---

### Step 2: Run Backfill (First Time)

Execute the backfill function:

```sql
SELECT * FROM backfill_active_item_id();
```

**Expected Output:**

```
 session_id  | old_active_item_id | new_active_item_id | current_item_index | session_status |        action_taken
-------------+--------------------+--------------------+--------------------+----------------+----------------------------
 abc-123...  | NULL               | def-456...         | 0                  | in_progress    | UPDATED (matched item)
 abc-124...  | NULL               | NULL               | 3                  | completed      | SKIPPED (completed session)
 abc-125...  | NULL               | ghi-789...         | 6                  | pending        | UPDATED (matched item)
```

**Analysis:**
- `in_progress` and `pending` sessions: `active_item_id` populated
- `completed` sessions: `active_item_id` remains NULL
- Sessions with no matching checklist: `active_item_id` remains NULL

---

### Step 3: Test Idempotency (Run Again)

Run the same function a second time:

```sql
SELECT * FROM backfill_active_item_id();
```

**Expected Output:**

```
 session_id | old_active_item_id | new_active_item_id | current_item_index | session_status | action_taken
------------+--------------------+--------------------+--------------------+----------------+--------------
(0 rows)
```

**Why?** The function only updates sessions where `active_item_id IS NULL`. Since all sessions were updated in Step 2, there's nothing left to update.

✅ **This confirms the script is idempotent and safe to run multiple times.**

---

### Step 4: Verify Results

Run verification queries to ensure correctness:

#### Verification Query 1: Summary by Category

```sql
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
```

**Expected:**
```
            category               |    status    | session_count
-----------------------------------+--------------+---------------
 Completed (NULL is expected)      | completed    | 15
 Has active_item_id                | in_progress  | 42
 Has active_item_id                | pending      | 8
```

---

#### Verification Query 2: Validate Matching Logic

```sql
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
ORDER BY validation_status, s.id
LIMIT 10;
```

**Expected:** All rows should show `MATCH ✓`

---

#### Verification Query 3: Find Sessions Needing Investigation

```sql
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
```

**Expected:** 0 rows (or only sessions with invalid `current_item_index` beyond checklist bounds)

---

## Production Execution

### Method 1: Supabase SQL Editor (Recommended)

1. **Navigate to Supabase Dashboard**
   - Go to [https://app.supabase.com](https://app.supabase.com)
   - Select your project
   - Click **SQL Editor** in the left sidebar

2. **Load the Backfill Script**
   - Click **New Query**
   - Copy the contents of `supabase/scripts/backfill_active_item_id.sql`
   - Paste into the SQL editor

3. **Execute the Script**
   - Click **Run** (or press `Ctrl+Enter`)
   - Wait for execution to complete
   - Review the results table

4. **Save the Execution Results**
   - Export the results to CSV for audit purposes
   - Document the number of sessions updated

---

### Method 2: Supabase CLI (Advanced)

If you prefer command-line execution:

```bash
# Ensure you're connected to the correct project
supabase link --project-ref <your-project-ref>

# Execute the backfill script
supabase db remote exec < supabase/scripts/backfill_active_item_id.sql

# Or use psql directly
psql $(supabase db remote get-url) -f supabase/scripts/backfill_active_item_id.sql
```

---

### Method 3: Direct SQL Connection (For Advanced Users)

```bash
# Get your database connection string from Supabase dashboard
# Settings → Database → Connection String (Direct)

psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \
  -f supabase/scripts/backfill_active_item_id.sql
```

---

## Verification

After running the backfill in production, execute these verification steps:

### 1. Check Execution Results

The backfill function returns a result set showing what was updated:

```sql
SELECT * FROM backfill_active_item_id();
```

If this returns 0 rows, it means either:
- The backfill was already run successfully
- There are no sessions with `active_item_id IS NULL`

### 2. Run Summary Query

```sql
SELECT
  CASE
    WHEN active_item_id IS NOT NULL THEN 'Has active_item_id'
    WHEN status = 'completed' THEN 'Completed (NULL is expected)'
    ELSE 'Missing active_item_id (needs investigation)'
  END as category,
  COUNT(*) as session_count
FROM inspection_sessions
GROUP BY
  CASE
    WHEN active_item_id IS NOT NULL THEN 'Has active_item_id'
    WHEN status = 'completed' THEN 'Completed (NULL is expected)'
    ELSE 'Missing active_item_id (needs investigation)'
  END;
```

### 3. Compare Before/After Counts

**Before Backfill:**
```sql
-- Run this BEFORE executing the backfill
SELECT
  status,
  COUNT(*) FILTER (WHERE active_item_id IS NULL) as null_count,
  COUNT(*) FILTER (WHERE active_item_id IS NOT NULL) as non_null_count,
  COUNT(*) as total
FROM inspection_sessions
GROUP BY status;
```

**After Backfill:**
```sql
-- Run this AFTER executing the backfill
SELECT
  status,
  COUNT(*) FILTER (WHERE active_item_id IS NULL) as null_count,
  COUNT(*) FILTER (WHERE active_item_id IS NOT NULL) as non_null_count,
  COUNT(*) as total
FROM inspection_sessions
GROUP BY status;
```

**Expected Changes:**
- `in_progress` sessions: `null_count` should decrease, `non_null_count` should increase
- `completed` sessions: `null_count` remains the same (expected behavior)
- Total counts remain unchanged

---

## Troubleshooting

### Issue 1: Function Returns 0 Rows

**Possible Causes:**
1. Backfill already completed
2. All sessions already have `active_item_id` populated
3. All sessions are completed (which should have NULL)

**Solution:**
Run verification query to confirm:
```sql
SELECT COUNT(*) as total_sessions,
       COUNT(active_item_id) as sessions_with_active_item,
       COUNT(*) - COUNT(active_item_id) as sessions_without_active_item
FROM inspection_sessions;
```

---

### Issue 2: Some Sessions Still Have NULL active_item_id

**Possible Causes:**
1. `current_item_index` is out of bounds (exceeds checklist length)
2. No checklist templates exist for the apartment type
3. Session status is `completed`

**Solution:**
Investigate specific sessions:
```sql
SELECT
  s.id,
  s.status,
  s.current_item_index,
  a.apartment_type,
  (SELECT COUNT(*) FROM checklist_templates WHERE apartment_type = a.apartment_type) as checklist_count
FROM inspection_sessions s
JOIN apartments a ON a.id = s.apartment_id
WHERE s.active_item_id IS NULL
  AND s.status != 'completed';
```

**Fix for out-of-bounds index:**
```sql
-- Manually set to the last item in the checklist
UPDATE inspection_sessions s
SET active_item_id = (
  SELECT ct.id
  FROM checklist_templates ct
  JOIN apartments a ON a.id = s.apartment_id
  WHERE ct.apartment_type = a.apartment_type
  ORDER BY ct.order_sequence DESC
  LIMIT 1
)
WHERE s.id = '<session-id-here>'
  AND s.active_item_id IS NULL;
```

---

### Issue 3: Validation Shows MISMATCH

**Possible Cause:**
The `order_sequence` in `checklist_templates` doesn't align with `current_item_index`

**Solution:**
This indicates a data integrity issue. Review the checklist templates:
```sql
SELECT apartment_type, room_type, order_sequence, item_description
FROM checklist_templates
WHERE apartment_type = 'T3'
ORDER BY order_sequence;
```

Ensure `order_sequence` is sequential and starts from 0.

---

## Rollback

If you need to undo the backfill (e.g., incorrect data was populated):

### Option 1: Reset All active_item_id to NULL

```sql
UPDATE inspection_sessions
SET active_item_id = NULL
WHERE active_item_id IS NOT NULL;
```

Then re-run the backfill function after fixing the issue.

---

### Option 2: Selective Rollback

If only specific sessions need to be reset:

```sql
UPDATE inspection_sessions
SET active_item_id = NULL
WHERE id IN (
  '<session-id-1>',
  '<session-id-2>',
  '<session-id-3>'
);
```

---

## QA Test Log Template

Use this template to document your testing:

```markdown
### Backfill Test Execution Log

**Environment:** [ ] Local | [ ] Staging | [ ] Production
**Date:** YYYY-MM-DD
**Executed By:** [Name]

#### Pre-Backfill State
- Total sessions: ___
- Sessions with active_item_id: ___
- Sessions without active_item_id: ___
- Sessions in_progress: ___
- Sessions completed: ___

#### Backfill Execution
- Execution time: ___ seconds
- Sessions updated: ___
- Sessions skipped (completed): ___
- Sessions skipped (no match): ___

#### Post-Backfill State
- Total sessions: ___
- Sessions with active_item_id: ___
- Sessions without active_item_id: ___
- Validation MATCH count: ___
- Validation MISMATCH count: ___

#### Idempotency Test
- Second execution returned: ___ rows (should be 0)
- [ ] PASS | [ ] FAIL

#### Issues Encountered
| Issue | Resolution |
|-------|------------|
|       |            |

#### Sign-Off
- [ ] All verification queries passed
- [ ] No data integrity issues found
- [ ] Backfill approved for production

**Approved By:** ___________________
**Date:** ___________________
```

---

## Cleanup

After successful backfill and verification, you can optionally remove the helper function:

```sql
DROP FUNCTION IF EXISTS backfill_active_item_id();
```

**Note:** It's recommended to keep the function available for a few weeks in case re-execution is needed.

---

## References

- **Migration:** [20251104120000_extend_inspection_statuses.sql](../supabase/migrations/20251104120000_extend_inspection_statuses.sql)
- **Backfill Script:** [backfill_active_item_id.sql](../supabase/scripts/backfill_active_item_id.sql)
- **Data Flow Doc:** [inspection-data-flow.md](./inspection-data-flow.md)
- **Migration Test Log:** [migration-20251104-test-log.md](./migration-20251104-test-log.md)

---

## Support

If you encounter issues not covered in this guide:

1. Check the Supabase logs for error messages
2. Review the [Troubleshooting](#troubleshooting) section
3. Contact the database administrator or technical lead
4. Create an issue in the project repository with:
   - Environment (local/staging/production)
   - SQL query executed
   - Error message
   - Expected vs actual results
