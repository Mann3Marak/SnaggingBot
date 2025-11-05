# Migration Test Log: 20251104120000_extend_inspection_statuses.sql

**Migration File:** `supabase/migrations/20251104120000_extend_inspection_statuses.sql`
**Base Schema Updated:** `supabase/migrations/20250922124500_nhome_schema.sql`
**Test Date:** 2025-11-04
**Tester:** [To be completed]

---

## Prerequisites

Before testing this migration, ensure:
- [ ] Docker Desktop is running
- [ ] Supabase CLI is installed (`npm install -g supabase` or available via `npx supabase`)
- [ ] Local Supabase instance is started: `supabase start`
- [ ] You have database admin access

---

## Test Procedure

### Step 1: Start Supabase Local Development Server

```bash
cd "c:\Users\johan\OneDrive\Documents\GitProjects\SnaggingBot V2.0"
supabase start
```

**Expected Output:**
```
Started supabase local development setup.

         API URL: http://localhost:54321
          DB URL: postgresql://postgres:postgres@localhost:54322/postgres
      Studio URL: http://localhost:54323
    Inbucket URL: http://localhost:54324
      JWT secret: <secret>
        anon key: <key>
service_role key: <key>
```

**Status:** [ ] PASS / [ ] FAIL

---

### Step 2: Reset Database (Applies All Migrations)

```bash
supabase db reset
```

This command will:
1. Drop the existing local database
2. Re-run all migrations in order (including the new one)
3. Apply seed data
4. Show any migration errors

**Expected Output:**
```
Resetting local database...
Applying migration 20250922124500_nhome_schema.sql...
Applying migration 20251103000000_fix_completed_inspections.sql...
Applying migration 20251104120000_extend_inspection_statuses.sql...
Seeding data from supabase/seeds/20250922130000_nhome_seed.sql...
Finished supabase db reset on branch main.
```

**Status:** [ ] PASS / [ ] FAIL

**Errors (if any):**
```
[Leave blank if no errors, otherwise paste error output here]
```

---

### Step 3: Verify Schema Changes

Connect to the local database using psql:

```bash
psql postgresql://postgres:postgres@localhost:54322/postgres
```

#### 3.1 Verify `inspection_results.status` Constraint

```sql
-- Query to show the constraint definition
SELECT conname, pg_get_constraintdef(oid) as constraint_def
FROM pg_constraint
WHERE conrelid = 'inspection_results'::regclass
  AND conname = 'inspection_results_status_check';
```

**Expected Output:**
```
            conname             |                                    constraint_def
--------------------------------+--------------------------------------------------------------------------------------
 inspection_results_status_check | CHECK ((status = ANY (ARRAY['good'::text, 'issue'::text, 'critical'::text, 'skipped'::text, 'not_applicable'::text])))
```

**Status:** [ ] PASS / [ ] FAIL

---

#### 3.2 Verify `inspection_sessions.active_item_id` Column

```sql
-- Show table structure
\d inspection_sessions
```

**Expected Output (relevant excerpt):**
```
Table "public.inspection_sessions"
       Column        |           Type           | Collation | Nullable |      Default
---------------------+--------------------------+-----------+----------+-------------------
 id                  | uuid                     |           | not null | gen_random_uuid()
 apartment_id        | uuid                     |           |          |
 inspector_id        | uuid                     |           |          |
 status              | text                     |           |          | 'in_progress'::text
 started_at          | timestamp with time zone |           |          | timezone('utc'::text, now())
 completed_at        | timestamp with time zone |           |          |
 current_item_index  | integer                  |           |          | 0
 active_item_id      | uuid                     |           |          |   <-- NEW COLUMN
 nhome_quality_score | integer                  |           |          |

Foreign-key constraints:
    "inspection_sessions_active_item_id_fkey" FOREIGN KEY (active_item_id) REFERENCES checklist_templates(id) ON DELETE SET NULL
```

**Alternative SQL Query:**
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'inspection_sessions'
  AND column_name = 'active_item_id';
```

**Expected Output:**
```
 column_name   | data_type | is_nullable | column_default
---------------+-----------+-------------+----------------
 active_item_id| uuid      | YES         | NULL
```

**Status:** [ ] PASS / [ ] FAIL

---

#### 3.3 Verify Index Creation

```sql
-- Check if the index was created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'inspection_sessions'
  AND indexname = 'idx_inspection_sessions_active_item';
```

**Expected Output:**
```
            indexname             |                                              indexdef
----------------------------------+----------------------------------------------------------------------------------------------------
 idx_inspection_sessions_active_item | CREATE INDEX idx_inspection_sessions_active_item ON public.inspection_sessions USING btree (active_item_id)
```

**Status:** [ ] PASS / [ ] FAIL

---

### Step 4: Test Inserting Records with New Status Values

#### 4.1 Test: Insert with 'skipped' status (should succeed)

```sql
-- Get a valid session_id and item_id from existing data
SELECT id FROM inspection_sessions LIMIT 1;
SELECT id FROM checklist_templates LIMIT 1;

-- Insert a test record with 'skipped' status
INSERT INTO inspection_results (session_id, item_id, status, notes)
VALUES (
  (SELECT id FROM inspection_sessions LIMIT 1),
  (SELECT id FROM checklist_templates LIMIT 1),
  'skipped',
  'Balcony not present in ground floor unit'
);
```

**Expected Result:** `INSERT 0 1` (success)

**Status:** [ ] PASS / [ ] FAIL

---

#### 4.2 Test: Insert with 'not_applicable' status (should succeed)

```sql
INSERT INTO inspection_results (session_id, item_id, status, notes)
VALUES (
  (SELECT id FROM inspection_sessions LIMIT 1),
  (SELECT id FROM checklist_templates OFFSET 1 LIMIT 1),
  'not_applicable',
  'No fireplace in this unit type'
);
```

**Expected Result:** `INSERT 0 1` (success)

**Status:** [ ] PASS / [ ] FAIL

---

#### 4.3 Test: Insert with invalid status (should fail)

```sql
INSERT INTO inspection_results (session_id, item_id, status)
VALUES (
  (SELECT id FROM inspection_sessions LIMIT 1),
  (SELECT id FROM checklist_templates LIMIT 1),
  'invalid_status'
);
```

**Expected Result:** Error message
```
ERROR:  new row for relation "inspection_results" violates check constraint "inspection_results_status_check"
DETAIL:  Failing row contains (..., invalid_status, ...).
```

**Status:** [ ] PASS / [ ] FAIL

---

#### 4.4 Test: Set active_item_id on a session (should succeed)

```sql
UPDATE inspection_sessions
SET active_item_id = (SELECT id FROM checklist_templates LIMIT 1)
WHERE id = (SELECT id FROM inspection_sessions LIMIT 1);

-- Verify the update
SELECT id, status, current_item_index, active_item_id
FROM inspection_sessions
WHERE active_item_id IS NOT NULL
LIMIT 1;
```

**Expected Result:** One row returned with active_item_id populated

**Status:** [ ] PASS / [ ] FAIL

---

### Step 5: Test Rollback (Optional)

If you need to test the rollback procedure:

```sql
-- 1. Remove the active_item_id column
ALTER TABLE inspection_sessions DROP COLUMN IF EXISTS active_item_id;

-- 2. Drop the index (will be auto-dropped with column)
DROP INDEX IF EXISTS idx_inspection_sessions_active_item;

-- 3. Revert the status constraint
ALTER TABLE inspection_results DROP CONSTRAINT IF EXISTS inspection_results_status_check;
ALTER TABLE inspection_results ADD CONSTRAINT inspection_results_status_check
CHECK (status IN ('good', 'issue', 'critical'));

-- 4. Verify rollback
\d inspection_sessions
\d inspection_results
```

**Expected Result:**
- `active_item_id` column should be gone
- Index should be gone
- Constraint should only allow 'good', 'issue', 'critical'

**Status:** [ ] PASS / [ ] FAIL / [ ] NOT TESTED

---

## Test Results Summary

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| Database reset | Migrations apply without errors | | [ ] PASS / [ ] FAIL |
| Status constraint extended | 5 values allowed | | [ ] PASS / [ ] FAIL |
| active_item_id column | Column exists, UUID type, nullable | | [ ] PASS / [ ] FAIL |
| Index created | idx_inspection_sessions_active_item exists | | [ ] PASS / [ ] FAIL |
| Insert 'skipped' | Success | | [ ] PASS / [ ] FAIL |
| Insert 'not_applicable' | Success | | [ ] PASS / [ ] FAIL |
| Insert invalid status | Error | | [ ] PASS / [ ] FAIL |
| Update active_item_id | Success | | [ ] PASS / [ ] FAIL |
| Rollback (optional) | Schema reverted | | [ ] PASS / [ ] FAIL / [ ] NOT TESTED |

---

## Issues Encountered

| Issue | Description | Resolution |
|-------|-------------|------------|
| [#] | [Describe any issues] | [How it was resolved] |

---

## Performance Validation

### Index Performance Test (Optional)

```sql
-- Test query performance with active_item_id index
EXPLAIN ANALYZE
SELECT s.*, ct.item_description
FROM inspection_sessions s
LEFT JOIN checklist_templates ct ON ct.id = s.active_item_id
WHERE s.status = 'in_progress'
  AND s.active_item_id IS NOT NULL;
```

**Expected:** Index scan on `idx_inspection_sessions_active_item` should be used

**Status:** [ ] PASS / [ ] FAIL / [ ] NOT TESTED

---

## Sign-Off

**Tested By:** ___________________________
**Date:** ___________________________
**Overall Status:** [ ] APPROVED FOR PRODUCTION / [ ] NEEDS REVISION

**Comments:**
```
[Add any additional comments or observations]
```

---

## Production Deployment Checklist

Before deploying to production:

- [ ] All tests passed in local environment
- [ ] Migration file reviewed by technical lead
- [ ] Rollback procedure tested and documented
- [ ] Backup of production database taken
- [ ] Application code updated to use new status values (if needed)
- [ ] Documentation updated (inspection-data-flow.md)
- [ ] Team notified of schema changes
- [ ] Migration scheduled during low-traffic window

**Production Deployment Command:**
```bash
supabase db push
```

**Post-Deployment Verification:**
```bash
supabase db remote changes
```

---

## References

- **Ticket:** Ticket 3 – Supabase Migration: Extend Status Enum & Add Active Item Column
- **Migration File:** [20251104120000_extend_inspection_statuses.sql](../supabase/migrations/20251104120000_extend_inspection_statuses.sql)
- **Base Schema:** [20250922124500_nhome_schema.sql](../supabase/migrations/20250922124500_nhome_schema.sql)
- **Data Flow Doc:** [inspection-data-flow.md](./inspection-data-flow.md)
- **Wireframe Doc:** [inspection-navigation-wireframe.md](./inspection-navigation-wireframe.md)
