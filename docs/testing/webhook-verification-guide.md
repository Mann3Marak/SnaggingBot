# Webhook Verification Guide for New Status Values

**Ticket:** Ticket 5 – Verify Row-Level Security & Webhooks with New Statuses
**Purpose:** Verify database webhooks and triggers function correctly with `'skipped'` and `'not_applicable'` status values
**Created:** 2025-11-04

---

## Table of Contents

1. [Overview](#overview)
2. [Identifying Webhooks & Triggers](#identifying-webhooks--triggers)
3. [Testing Database Triggers](#testing-database-triggers)
4. [Testing Supabase Webhooks](#testing-supabase-webhooks)
5. [Testing Edge Functions](#testing-edge-functions)
6. [Verification Checklist](#verification-checklist)

---

## Overview

### What Are We Verifying?

After extending `inspection_results.status` to include `'skipped'` and `'not_applicable'`, we need to ensure that:

1. **Database Triggers** still fire correctly for all status values
2. **Supabase Webhooks** (if configured) receive payloads with new status values
3. **Edge Functions** (if called by triggers) handle new status values gracefully

### Why Is This Important?

Webhooks and triggers may:
- Send notifications when critical items are found
- Update aggregate data (e.g., quality scores)
- Sync data to external systems
- Generate reports automatically

If they don't handle new status values, they might:
- Crash with unexpected value errors
- Ignore/skip records with new statuses
- Send incomplete data to external systems

---

## Identifying Webhooks & Triggers

### Step 1: List Database Triggers

Connect to your database and run:

```sql
-- List all triggers on inspection_results table
SELECT
  trigger_name,
  event_manipulation as event_type,
  action_timing as when_fired,
  action_statement as trigger_function
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'inspection_results'
ORDER BY trigger_name;
```

**Expected Output:**
```
 trigger_name        | event_type | when_fired | trigger_function
---------------------|------------|------------|-------------------
 enhance_note_trigger | INSERT     | AFTER      | EXECUTE FUNCTION enhance_inspection_note()
 ...                  | ...        | ...        | ...
```

**Action:** Document each trigger found in the table below.

| Trigger Name | Event | Timing | Function Called | Purpose |
|--------------|-------|--------|-----------------|---------|
| [example] | INSERT | AFTER | enhance_inspection_note() | Enhances notes with AI |
|  |  |  |  |  |

---

### Step 2: Check Supabase Webhooks

**Via Supabase Dashboard:**

1. Navigate to **Database** → **Webhooks**
2. Look for webhooks configured on `inspection_results` table
3. Document each webhook:

| Webhook Name | Table | Events | Endpoint URL | HTTP Method |
|--------------|-------|--------|--------------|-------------|
| [example] | inspection_results | INSERT, UPDATE | https://example.com/webhook | POST |
|  |  |  |  |  |

**Via SQL:**

```sql
-- Check for configured webhooks (if using Supabase pg_net)
SELECT * FROM supabase_functions.hooks
WHERE schema_name = 'public'
  AND table_name = 'inspection_results';
```

---

### Step 3: Check Edge Functions

**Via Supabase Dashboard:**

1. Navigate to **Edge Functions**
2. Look for functions that might be triggered by `inspection_results` changes
3. Document each function:

| Function Name | Triggered By | Purpose |
|---------------|--------------|---------|
| enhance-note | Database trigger | AI-enhances inspection notes |
|  |  |  |

---

## Testing Database Triggers

### Trigger Test Template

For each trigger identified, use this template:

#### Trigger: `[trigger_name]`

**Purpose:** [What does this trigger do?]

**Events:** [ ] INSERT | [ ] UPDATE | [ ] DELETE

**Test Scenario 1: INSERT with `status = 'skipped'`**

1. **Create test record:**
   ```sql
   INSERT INTO inspection_results (session_id, item_id, status, notes)
   VALUES (
     (SELECT id FROM inspection_sessions LIMIT 1),
     (SELECT id FROM checklist_templates LIMIT 1),
     'skipped',
     'Testing trigger with skipped status'
   )
   RETURNING id;
   ```

2. **Verify trigger fired:**
   ```sql
   -- Check trigger execution logs (if available)
   SELECT * FROM pg_stat_statements
   WHERE query LIKE '%enhance_inspection_note%'
   ORDER BY calls DESC
   LIMIT 5;
   ```

3. **Check trigger result:**
   - [ ] Trigger fired successfully
   - [ ] No errors in PostgreSQL logs
   - [ ] Expected side effects occurred (e.g., note enhanced, notification sent)

**Expected Behavior:**
```
[Describe what should happen when trigger processes 'skipped' status]
```

**Actual Behavior:**
```
[Fill in during testing]
```

**Status:** [ ] ✅ PASS | [ ] ❌ FAIL

---

**Test Scenario 2: INSERT with `status = 'not_applicable'`**

1. **Create test record:**
   ```sql
   INSERT INTO inspection_results (session_id, item_id, status, notes)
   VALUES (
     (SELECT id FROM inspection_sessions LIMIT 1),
     (SELECT id FROM checklist_templates OFFSET 1 LIMIT 1),
     'not_applicable',
     'Testing trigger with N/A status'
   )
   RETURNING id;
   ```

2. **Verify trigger fired** (same as above)

3. **Check trigger result:**
   - [ ] Trigger fired successfully
   - [ ] No errors in PostgreSQL logs
   - [ ] Expected side effects occurred

**Status:** [ ] ✅ PASS | [ ] ❌ FAIL

---

**Test Scenario 3: UPDATE from 'good' to 'skipped'**

1. **Create initial record:**
   ```sql
   INSERT INTO inspection_results (session_id, item_id, status, notes)
   VALUES (
     (SELECT id FROM inspection_sessions LIMIT 1),
     (SELECT id FROM checklist_templates OFFSET 2 LIMIT 1),
     'good',
     'Initially marked as good'
   )
   RETURNING id;
   ```

2. **Update status:**
   ```sql
   UPDATE inspection_results
   SET status = 'skipped',
       notes = 'Changed to skipped - will return later'
   WHERE id = '<result-id-from-step-1>';
   ```

3. **Verify trigger handling:**
   - [ ] Trigger processed the UPDATE correctly
   - [ ] New status value reflected in trigger results
   - [ ] No errors

**Status:** [ ] ✅ PASS | [ ] ❌ FAIL

---

### Checking PostgreSQL Logs

**Local Supabase:**
```bash
# View PostgreSQL logs
docker logs supabase_db_<project-name> --tail 100 --follow
```

**Cloud Supabase:**
1. Navigate to **Logs** → **Database**
2. Filter by time range
3. Look for error messages related to triggers

**Look for:**
- ❌ `ERROR: invalid input value for enum` (would indicate constraint issue)
- ❌ `function ... does not exist`
- ❌ `constraint violation`
- ✅ Successful trigger execution logs

---

## Testing Supabase Webhooks

### Webhook Test Template

For each webhook identified:

#### Webhook: `[webhook_name]`

**Endpoint:** `[https://...]`
**Events:** INSERT | UPDATE | DELETE
**HTTP Method:** POST

**Test Setup:**

1. **Set up webhook listener** (choose one):

   **Option A: RequestBin/Webhook.site**
   - Go to https://webhook.site
   - Copy the unique URL
   - Update webhook endpoint temporarily to this URL (via Supabase Dashboard)

   **Option B: Local listener**
   ```bash
   # Using nc (netcat)
   nc -l 8080

   # Or using Python simple server
   python3 -m http.server 8080
   ```

2. **Configure webhook to point to listener**

---

**Test Case 1: INSERT with `status = 'skipped'`**

1. **Create record:**
   ```sql
   INSERT INTO inspection_results (session_id, item_id, status, notes)
   VALUES (
     (SELECT id FROM inspection_sessions LIMIT 1),
     (SELECT id FROM checklist_templates LIMIT 1),
     'skipped',
     'Webhook test - skipped status'
   );
   ```

2. **Check webhook listener for payload**

**Expected Payload:**
```json
{
  "type": "INSERT",
  "table": "inspection_results",
  "schema": "public",
  "record": {
    "id": "<uuid>",
    "session_id": "<uuid>",
    "item_id": "<uuid>",
    "status": "skipped",
    "notes": "Webhook test - skipped status",
    "created_at": "2025-11-04T12:00:00.000Z"
  },
  "old_record": null
}
```

**Actual Payload:**
```
[Paste actual payload received]
```

**Verification:**
- [ ] Webhook fired
- [ ] Payload contains `"status": "skipped"`
- [ ] All required fields present
- [ ] No errors in webhook logs

**Status:** [ ] ✅ PASS | [ ] ❌ FAIL

---

**Test Case 2: INSERT with `status = 'not_applicable'`**

1. **Create record:**
   ```sql
   INSERT INTO inspection_results (session_id, item_id, status, notes)
   VALUES (
     (SELECT id FROM inspection_sessions LIMIT 1),
     (SELECT id FROM checklist_templates OFFSET 1 LIMIT 1),
     'not_applicable',
     'Webhook test - N/A status'
   );
   ```

2. **Expected payload:** Same structure with `"status": "not_applicable"`

**Actual Payload:**
```
[Paste actual payload received]
```

**Status:** [ ] ✅ PASS | [ ] ❌ FAIL

---

**Test Case 3: UPDATE Status Change**

1. **Update existing record:**
   ```sql
   UPDATE inspection_results
   SET status = 'skipped', notes = 'Updated via webhook test'
   WHERE id = '<existing-result-id>';
   ```

2. **Expected payload:**
   ```json
   {
     "type": "UPDATE",
     "table": "inspection_results",
     "record": {
       "id": "<uuid>",
       "status": "skipped",
       "notes": "Updated via webhook test",
       ...
     },
     "old_record": {
       "id": "<uuid>",
       "status": "good",
       "notes": "Previous note",
       ...
     }
   }
   ```

**Actual Payload:**
```
[Paste actual payload received]
```

**Status:** [ ] ✅ PASS | [ ] ❌ FAIL

---

### Checking Webhook Logs

**Supabase Dashboard:**
1. Navigate to **Database** → **Webhooks**
2. Click on the webhook
3. View **Logs** tab
4. Look for recent deliveries

**Expected Log Entry:**
```
Status: 200 OK
Timestamp: 2025-11-04 12:00:00
Payload: { "type": "INSERT", "record": { "status": "skipped", ... } }
```

---

## Testing Edge Functions

### Edge Function Test Template

#### Function: `[function_name]`

**Triggered By:** [Database trigger / HTTP request / Schedule]

**Test Method:**

**Option 1: Trigger via Database Event**
```sql
-- Insert record that should trigger the function
INSERT INTO inspection_results (session_id, item_id, status, notes)
VALUES (...);
```

**Option 2: Direct HTTP Invocation**
```bash
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/enhance-note' \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "record": {
      "id": "<uuid>",
      "status": "skipped",
      "notes": "Test note for enhancement"
    }
  }'
```

**Check Function Logs:**

1. **Via Supabase Dashboard:**
   - Navigate to **Edge Functions** → `[function_name]` → **Logs**
   - Filter by time range
   - Look for invocation logs

2. **Via CLI:**
   ```bash
   supabase functions logs enhance-note --tail
   ```

**Expected Behavior:**
```
Function should process 'skipped' and 'not_applicable' statuses without errors
```

**Actual Behavior:**
```
[Fill in during testing]
```

**Status:** [ ] ✅ PASS | [ ] ❌ FAIL

---

### Common Edge Function Issues

| Issue | Symptom | Solution |
|-------|---------|----------|
| Type error | `Unexpected status value: skipped` | Update TypeScript types to include new statuses |
| Enum mismatch | `enum StatusType does not include 'skipped'` | Update enum definition in function code |
| Switch statement | `No case for status: skipped` | Add cases for new statuses |
| Filter logic | `Records with 'skipped' ignored` | Update filters to include new statuses |

---

## Verification Checklist

### Pre-Test Checklist

- [ ] Migration 20251104120000_extend_inspection_statuses.sql applied
- [ ] Database has checklist templates and sessions for testing
- [ ] Test user accounts (inspector, admin) exist
- [ ] Webhook listener configured (if testing webhooks)
- [ ] Edge function logs accessible

---

### Test Execution Checklist

**Database Triggers:**
- [ ] All triggers identified and documented
- [ ] Each trigger tested with `status = 'skipped'`
- [ ] Each trigger tested with `status = 'not_applicable'`
- [ ] No errors in PostgreSQL logs
- [ ] All trigger side effects working correctly

**Supabase Webhooks:**
- [ ] All webhooks identified and documented
- [ ] Webhooks tested with INSERT (skipped, not_applicable)
- [ ] Webhooks tested with UPDATE
- [ ] Webhook payloads contain correct status values
- [ ] Webhook receiving endpoints handle new statuses

**Edge Functions:**
- [ ] All edge functions identified
- [ ] Functions invoked with new status values
- [ ] Function logs show successful execution
- [ ] Functions produce expected outputs

---

### Post-Test Checklist

- [ ] All tests passed
- [ ] Issues documented in [rls-status-matrix.md](./rls-status-matrix.md)
- [ ] Code changes made (if any) to handle new statuses
- [ ] Re-testing completed after fixes
- [ ] Sign-off obtained from QA/Technical Lead

---

## Troubleshooting

### Issue: Webhook Not Firing

**Symptoms:**
- No payload received at webhook endpoint
- No entries in webhook logs

**Possible Causes:**
1. Webhook disabled in Supabase Dashboard
2. RLS policy preventing webhook from accessing data
3. Network/firewall blocking webhook endpoint

**Solutions:**
1. Check webhook is **enabled** in Dashboard
2. Test webhook with manual trigger:
   ```bash
   curl -X POST 'https://<project-ref>.supabase.co/rest/v1/rpc/test_webhook'
   ```
3. Check Supabase logs for webhook delivery failures

---

### Issue: Trigger Function Crashes

**Symptoms:**
- ERROR in PostgreSQL logs
- Trigger does not complete

**Possible Causes:**
1. Trigger function doesn't handle new status values
2. Type mismatch in trigger function parameters

**Solutions:**
1. Review trigger function code:
   ```sql
   \sf enhance_inspection_note
   ```
2. Look for hardcoded status checks like:
   ```sql
   IF NEW.status NOT IN ('good', 'issue', 'critical') THEN
     RAISE EXCEPTION 'Invalid status';
   END IF;
   ```
3. Update to include new values:
   ```sql
   IF NEW.status NOT IN ('good', 'issue', 'critical', 'skipped', 'not_applicable') THEN
     RAISE EXCEPTION 'Invalid status: %', NEW.status;
   END IF;
   ```

---

### Issue: Edge Function Type Error

**Symptoms:**
- Function logs show TypeScript error
- `Property 'skipped' does not exist on type 'Status'`

**Solution:**

Update TypeScript types in edge function:

```typescript
// Before
type InspectionStatus = 'good' | 'issue' | 'critical';

// After
type InspectionStatus = 'good' | 'issue' | 'critical' | 'skipped' | 'not_applicable';
```

---

## Sign-Off

**Testing Completed By:** ___________________________
**Date:** ___________________________

**Webhooks & Triggers Verified:**
- [ ] All webhooks fire correctly with new status values
- [ ] All triggers execute without errors
- [ ] Edge functions handle new statuses gracefully
- [ ] No schema errors or constraint violations

**Overall Status:** [ ] ✅ APPROVED | [ ] ⚠️ NEEDS FIXES

**Comments:**
```
[Add any observations or recommendations]
```

---

## References

- [RLS Status Matrix](./rls-status-matrix.md)
- [Migration 20251104120000](../../supabase/migrations/20251104120000_extend_inspection_statuses.sql)
- [Supabase Webhooks Documentation](https://supabase.com/docs/guides/database/webhooks)
- [PostgreSQL Triggers Documentation](https://www.postgresql.org/docs/current/sql-createtrigger.html)
