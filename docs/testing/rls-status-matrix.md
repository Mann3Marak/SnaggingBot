# RLS & Webhook Testing Matrix: New Status Values

**Migration:** 20251104120000_extend_inspection_statuses.sql
**Test Date:** 2025-11-04
**Ticket:** Ticket 5 – Verify Row-Level Security & Webhooks with New Statuses
**Status:** 🟡 IN PROGRESS

---

## Table of Contents

1. [Overview](#overview)
2. [Test Methodology](#test-methodology)
3. [RLS Policy Analysis](#rls-policy-analysis)
4. [Test Matrix: Inspector Role](#test-matrix-inspector-role)
5. [Test Matrix: Admin Role](#test-matrix-admin-role)
6. [Test Matrix: Unauthenticated](#test-matrix-unauthenticated)
7. [Webhook Verification](#webhook-verification)
8. [Test Results Summary](#test-results-summary)
9. [Issues & Resolutions](#issues--resolutions)
10. [Sign-Off](#sign-off)

---

## Overview

### Purpose

After extending the `inspection_results.status` constraint to include `'skipped'` and `'not_applicable'` (in addition to `'good'`, `'issue'`, `'critical'`), we must verify that:

1. **Row-Level Security (RLS) policies** still function correctly with all 5 status values
2. **Database webhooks/triggers** fire correctly and handle the new status values
3. **API requests** succeed for all status combinations across different user roles

### Status Values Being Tested

| Status | Description | Added In |
|--------|-------------|----------|
| `good` | Meets NHome standards | Original |
| `issue` | Minor defect requiring attention | Original |
| `critical` | Major defect or safety concern | Original |
| `skipped` | Item not inspected (will return later) | **NEW - Ticket 3** |
| `not_applicable` | Item doesn't exist in this unit | **NEW - Ticket 3** |

### User Roles Being Tested

| Role | Description | RLS Access Level |
|------|-------------|------------------|
| `inspector` | Can access their own inspection sessions | Own sessions only |
| `admin` | Can access all sessions in their company | All company sessions |
| `unauthenticated` | No auth token provided | Should be denied |

---

## Test Methodology

### Test Environment

- **Environment:** [ ] Local | [ ] Staging | [ ] Production
- **Supabase Project URL:** `https://<project-ref>.supabase.co`
- **Database Version:** PostgreSQL 15.x
- **Supabase Studio URL:** `http://localhost:54323` (local) or dashboard URL

### Test Tools

1. **Supabase REST API** - For direct table operations
2. **curl** - For HTTP requests with auth tokens
3. **Supabase Studio** - For visual verification
4. **PostgreSQL logs** - For webhook/trigger verification

### Test Approach

For each status value (`good`, `issue`, `critical`, `skipped`, `not_applicable`):

1. **INSERT Test**: Create new `inspection_results` record via REST API
2. **SELECT Test**: Retrieve the created record
3. **UPDATE Test**: Modify the record's status
4. **DELETE Test**: Remove the record (optional)
5. **Webhook Verification**: Confirm trigger/webhook fired (if applicable)

Each test is performed with:
- Inspector role auth token (should succeed for own sessions)
- Admin role auth token (should succeed for all sessions)
- No auth token (should fail with 401/403)

---

## RLS Policy Analysis

### Current Policies on `inspection_results`

**Policy Name:** `"NHome inspectors results"`

**Type:** `for all` (INSERT, SELECT, UPDATE, DELETE)

**USING clause (SELECT, UPDATE, DELETE):**
```sql
using (
  session_id in (
    select id from inspection_sessions where inspector_id = auth.uid()
      or exists (
        select 1 from users where id = auth.uid() and role = 'admin'
      )
  )
)
```

**WITH CHECK clause (INSERT, UPDATE):**
```sql
with check (
  session_id in (
    select id from inspection_sessions where inspector_id = auth.uid()
      or exists (
        select 1 from users where id = auth.uid() and role = 'admin'
      )
  )
)
```

### Policy Behavior

- **Inspectors:** Can only INSERT/SELECT/UPDATE/DELETE results for sessions where `inspector_id = auth.uid()`
- **Admins:** Can access all results for sessions in their company (via the `exists` clause checking role)
- **Status-agnostic:** Policy does NOT filter by status value → **All 5 status values should work identically**

### Expected RLS Behavior with New Statuses

| Status | Inspector (Own Session) | Inspector (Other Session) | Admin | Unauthenticated |
|--------|-------------------------|---------------------------|-------|-----------------|
| `good` | ✅ Allow | ❌ Deny | ✅ Allow | ❌ Deny |
| `issue` | ✅ Allow | ❌ Deny | ✅ Allow | ❌ Deny |
| `critical` | ✅ Allow | ❌ Deny | ✅ Allow | ❌ Deny |
| `skipped` | ✅ Allow | ❌ Deny | ✅ Allow | ❌ Deny |
| `not_applicable` | ✅ Allow | ❌ Deny | ✅ Allow | ❌ Deny |

**Conclusion:** Since RLS policies don't reference the `status` column, extending the CHECK constraint should NOT affect RLS behavior. All tests should pass.

---

## Test Matrix: Inspector Role

### Setup

**Test User:** inspector@nhomesetup.com
**User ID:** `<inspector-uuid>`
**Role:** `inspector`
**Auth Token:** `<JWT-token-from-supabase-auth>`

**Test Session:** Session owned by this inspector
**Session ID:** `<session-uuid>`
**Item ID:** `<item-uuid>`

### Test Execution

#### Test 1.1: INSERT with `status = 'good'`

**Request:**
```bash
curl -X POST 'https://<project-ref>.supabase.co/rest/v1/inspection_results' \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <inspector-jwt-token>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "session_id": "<session-uuid>",
    "item_id": "<item-uuid>",
    "status": "good",
    "notes": "All items meet NHome standards",
    "priority_level": 1
  }'
```

**Expected Response:**
```json
{
  "id": "<result-uuid>",
  "session_id": "<session-uuid>",
  "item_id": "<item-uuid>",
  "status": "good",
  "notes": "All items meet NHome standards",
  "priority_level": 1,
  "created_at": "2025-11-04T12:00:00.000Z"
}
```

**Status:** [ ] ✅ PASS | [ ] ❌ FAIL

**Actual Result:**
```
[To be filled during testing]
```

---

#### Test 1.2: INSERT with `status = 'issue'`

**Request:**
```bash
curl -X POST 'https://<project-ref>.supabase.co/rest/v1/inspection_results' \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <inspector-jwt-token>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "session_id": "<session-uuid>",
    "item_id": "<item-uuid-2>",
    "status": "issue",
    "notes": "Minor scratch on cabinet door",
    "priority_level": 2
  }'
```

**Expected Response:** HTTP 201, record created with `status: "issue"`

**Status:** [ ] ✅ PASS | [ ] ❌ FAIL

**Actual Result:**
```
[To be filled during testing]
```

---

#### Test 1.3: INSERT with `status = 'critical'`

**Request:**
```bash
curl -X POST 'https://<project-ref>.supabase.co/rest/v1/inspection_results' \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <inspector-jwt-token>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "session_id": "<session-uuid>",
    "item_id": "<item-uuid-3>",
    "status": "critical",
    "notes": "Structural crack in load-bearing wall",
    "priority_level": 3
  }'
```

**Expected Response:** HTTP 201, record created with `status: "critical"`

**Status:** [ ] ✅ PASS | [ ] ❌ FAIL

**Actual Result:**
```
[To be filled during testing]
```

---

#### Test 1.4: INSERT with `status = 'skipped'` (NEW)

**Request:**
```bash
curl -X POST 'https://<project-ref>.supabase.co/rest/v1/inspection_results' \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <inspector-jwt-token>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "session_id": "<session-uuid>",
    "item_id": "<item-uuid-4>",
    "status": "skipped",
    "notes": "Will inspect after furniture is moved",
    "priority_level": 1
  }'
```

**Expected Response:** HTTP 201, record created with `status: "skipped"`

**Status:** [ ] ✅ PASS | [ ] ❌ FAIL

**Actual Result:**
```
[To be filled during testing]
```

---

#### Test 1.5: INSERT with `status = 'not_applicable'` (NEW)

**Request:**
```bash
curl -X POST 'https://<project-ref>.supabase.co/rest/v1/inspection_results' \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <inspector-jwt-token>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "session_id": "<session-uuid>",
    "item_id": "<item-uuid-5>",
    "status": "not_applicable",
    "notes": "Unit does not have a balcony (ground floor)",
    "priority_level": 1
  }'
```

**Expected Response:** HTTP 201, record created with `status: "not_applicable"`

**Status:** [ ] ✅ PASS | [ ] ❌ FAIL

**Actual Result:**
```
[To be filled during testing]
```

---

#### Test 1.6: INSERT with Invalid Status (Should Fail)

**Request:**
```bash
curl -X POST 'https://<project-ref>.supabase.co/rest/v1/inspection_results' \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <inspector-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "<session-uuid>",
    "item_id": "<item-uuid-6>",
    "status": "invalid_status",
    "notes": "This should fail",
    "priority_level": 1
  }'
```

**Expected Response:** HTTP 400 or 500 with error:
```json
{
  "code": "23514",
  "message": "new row for relation \"inspection_results\" violates check constraint \"inspection_results_status_check\""
}
```

**Status:** [ ] ✅ PASS | [ ] ❌ FAIL

**Actual Result:**
```
[To be filled during testing]
```

---

#### Test 1.7: SELECT All Results for Own Session

**Request:**
```bash
curl -X GET 'https://<project-ref>.supabase.co/rest/v1/inspection_results?session_id=eq.<session-uuid>' \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <inspector-jwt-token>"
```

**Expected Response:** HTTP 200, array containing all 5 results with different statuses

**Status:** [ ] ✅ PASS | [ ] ❌ FAIL

**Actual Result:**
```
[To be filled during testing]
```

---

#### Test 1.8: UPDATE Status from 'skipped' to 'good'

**Request:**
```bash
curl -X PATCH 'https://<project-ref>.supabase.co/rest/v1/inspection_results?id=eq.<result-uuid-from-test-1.4>' \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <inspector-jwt-token>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "status": "good",
    "notes": "Inspected after furniture moved - all good"
  }'
```

**Expected Response:** HTTP 200, record updated with `status: "good"`

**Status:** [ ] ✅ PASS | [ ] ❌ FAIL

**Actual Result:**
```
[To be filled during testing]
```

---

#### Test 1.9: Access Another Inspector's Session (Should Fail)

**Request:**
```bash
curl -X GET 'https://<project-ref>.supabase.co/rest/v1/inspection_results?session_id=eq.<other-inspector-session-uuid>' \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <inspector-jwt-token>"
```

**Expected Response:** HTTP 200, empty array `[]` (RLS filters out results)

**Status:** [ ] ✅ PASS | [ ] ❌ FAIL

**Actual Result:**
```
[To be filled during testing]
```

---

### Inspector Role Test Summary

| Test # | Status Value | Operation | Expected | Actual | Pass/Fail |
|--------|--------------|-----------|----------|--------|-----------|
| 1.1 | `good` | INSERT | 201 Created | | [ ] |
| 1.2 | `issue` | INSERT | 201 Created | | [ ] |
| 1.3 | `critical` | INSERT | 201 Created | | [ ] |
| 1.4 | `skipped` | INSERT | 201 Created | | [ ] |
| 1.5 | `not_applicable` | INSERT | 201 Created | | [ ] |
| 1.6 | `invalid_status` | INSERT | 400/500 Error | | [ ] |
| 1.7 | All | SELECT | 200 OK (5 results) | | [ ] |
| 1.8 | `skipped` → `good` | UPDATE | 200 OK | | [ ] |
| 1.9 | N/A | SELECT (other session) | 200 OK (empty) | | [ ] |

---

## Test Matrix: Admin Role

### Setup

**Test User:** natalie@nhomesetup.com
**User ID:** `<admin-uuid>`
**Role:** `admin`
**Auth Token:** `<admin-jwt-token>`

**Test Session:** Session owned by ANY inspector in the company
**Session ID:** `<any-session-uuid>`

### Test Execution

#### Test 2.1: INSERT with `status = 'good'` (Admin)

**Request:**
```bash
curl -X POST 'https://<project-ref>.supabase.co/rest/v1/inspection_results' \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "session_id": "<any-session-uuid>",
    "item_id": "<item-uuid>",
    "status": "good",
    "notes": "Admin override - approved",
    "priority_level": 1
  }'
```

**Expected Response:** HTTP 201, record created

**Status:** [ ] ✅ PASS | [ ] ❌ FAIL

**Actual Result:**
```
[To be filled during testing]
```

---

#### Test 2.2: INSERT with `status = 'skipped'` (Admin)

**Request:**
```bash
curl -X POST 'https://<project-ref>.supabase.co/rest/v1/inspection_results' \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "session_id": "<any-session-uuid>",
    "item_id": "<item-uuid-2>",
    "status": "skipped",
    "notes": "Admin marked as skipped for now",
    "priority_level": 1
  }'
```

**Expected Response:** HTTP 201, record created

**Status:** [ ] ✅ PASS | [ ] ❌ FAIL

**Actual Result:**
```
[To be filled during testing]
```

---

#### Test 2.3: INSERT with `status = 'not_applicable'` (Admin)

**Request:**
```bash
curl -X POST 'https://<project-ref>.supabase.co/rest/v1/inspection_results' \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "session_id": "<any-session-uuid>",
    "item_id": "<item-uuid-3>",
    "status": "not_applicable",
    "notes": "Admin confirmed item N/A for this unit type",
    "priority_level": 1
  }'
```

**Expected Response:** HTTP 201, record created

**Status:** [ ] ✅ PASS | [ ] ❌ FAIL

**Actual Result:**
```
[To be filled during testing]
```

---

#### Test 2.4: SELECT All Results Across All Sessions (Admin)

**Request:**
```bash
curl -X GET 'https://<project-ref>.supabase.co/rest/v1/inspection_results?limit=100' \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <admin-jwt-token>"
```

**Expected Response:** HTTP 200, array containing results from multiple sessions

**Status:** [ ] ✅ PASS | [ ] ❌ FAIL

**Actual Result:**
```
[To be filled during testing]
```

---

### Admin Role Test Summary

| Test # | Status Value | Operation | Expected | Actual | Pass/Fail |
|--------|--------------|-----------|----------|--------|-----------|
| 2.1 | `good` | INSERT | 201 Created | | [ ] |
| 2.2 | `skipped` | INSERT | 201 Created | | [ ] |
| 2.3 | `not_applicable` | INSERT | 201 Created | | [ ] |
| 2.4 | All | SELECT | 200 OK (all sessions) | | [ ] |

---

## Test Matrix: Unauthenticated

### Test Execution

#### Test 3.1: INSERT without Auth Token (Should Fail)

**Request:**
```bash
curl -X POST 'https://<project-ref>.supabase.co/rest/v1/inspection_results' \
  -H "apikey: <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "<session-uuid>",
    "item_id": "<item-uuid>",
    "status": "good",
    "notes": "Unauthorized attempt"
  }'
```

**Expected Response:** HTTP 401 Unauthorized or HTTP 403 Forbidden

**Status:** [ ] ✅ PASS | [ ] ❌ FAIL

**Actual Result:**
```
[To be filled during testing]
```

---

#### Test 3.2: SELECT without Auth Token (Should Fail)

**Request:**
```bash
curl -X GET 'https://<project-ref>.supabase.co/rest/v1/inspection_results' \
  -H "apikey: <anon-key>"
```

**Expected Response:** HTTP 200 with empty array `[]` (RLS filters everything)

**Status:** [ ] ✅ PASS | [ ] ❌ FAIL

**Actual Result:**
```
[To be filled during testing]
```

---

### Unauthenticated Test Summary

| Test # | Operation | Expected | Actual | Pass/Fail |
|--------|-----------|----------|--------|-----------|
| 3.1 | INSERT | 401/403 Error | | [ ] |
| 3.2 | SELECT | 200 OK (empty array) | | [ ] |

---

## Webhook Verification

### Overview

Webhooks or database triggers may be configured to fire when `inspection_results` records are created/updated. We need to verify that these work correctly with the new status values.

### Webhook/Trigger Discovery

#### Step 1: Check for Database Triggers

```sql
-- List all triggers on inspection_results table
SELECT
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'inspection_results';
```

**Results:**
```
[To be filled - paste trigger list here]
```

---

#### Step 2: Check for Supabase Edge Function Webhooks

Navigate to Supabase Dashboard → Database → Webhooks

**Configured Webhooks:**
```
[To be filled - list any webhooks configured on inspection_results]
```

---

### Webhook Test Scenarios

#### Webhook Test 1: INSERT with `status = 'skipped'`

**Trigger/Webhook:** `[name of webhook/trigger]`
**Endpoint:** `[webhook URL or function name]`

**Test Action:**
```bash
# Insert a record with status = 'skipped'
curl -X POST 'https://<project-ref>.supabase.co/rest/v1/inspection_results' \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <inspector-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "<session-uuid>",
    "item_id": "<item-uuid>",
    "status": "skipped",
    "notes": "Testing webhook with skipped status"
  }'
```

**Expected Webhook Payload:**
```json
{
  "type": "INSERT",
  "table": "inspection_results",
  "record": {
    "id": "<result-uuid>",
    "session_id": "<session-uuid>",
    "status": "skipped",
    "notes": "Testing webhook with skipped status",
    ...
  },
  "old_record": null
}
```

**Verification Method:**
- [ ] Check webhook logs in Supabase Dashboard
- [ ] Check receiving endpoint logs
- [ ] Query PostgreSQL logs: `SELECT * FROM pg_stat_statements WHERE query LIKE '%inspection_results%';`

**Status:** [ ] ✅ PASS | [ ] ❌ FAIL

**Actual Webhook Payload:**
```
[To be filled during testing]
```

---

#### Webhook Test 2: INSERT with `status = 'not_applicable'`

**Test Action:**
```bash
# Insert a record with status = 'not_applicable'
curl -X POST 'https://<project-ref>.supabase.co/rest/v1/inspection_results' \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <inspector-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "<session-uuid>",
    "item_id": "<item-uuid-2>",
    "status": "not_applicable",
    "notes": "Testing webhook with N/A status"
  }'
```

**Expected:** Webhook fires with `status: "not_applicable"` in payload

**Status:** [ ] ✅ PASS | [ ] ❌ FAIL

**Actual Webhook Payload:**
```
[To be filled during testing]
```

---

#### Webhook Test 3: UPDATE Status from 'good' to 'skipped'

**Test Action:**
```bash
# Update existing record's status
curl -X PATCH 'https://<project-ref>.supabase.co/rest/v1/inspection_results?id=eq.<result-uuid>' \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <inspector-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "skipped"
  }'
```

**Expected Webhook Payload:**
```json
{
  "type": "UPDATE",
  "table": "inspection_results",
  "record": {
    "id": "<result-uuid>",
    "status": "skipped",
    ...
  },
  "old_record": {
    "id": "<result-uuid>",
    "status": "good",
    ...
  }
}
```

**Status:** [ ] ✅ PASS | [ ] ❌ FAIL

**Actual Webhook Payload:**
```
[To be filled during testing]
```

---

### Webhook Logs

**Supabase Edge Function Logs:**
```
[Paste logs from Supabase Dashboard → Edge Functions → Logs]
```

**PostgreSQL Trigger Logs:**
```sql
-- Check PostgreSQL logs for trigger execution
SELECT * FROM pg_stat_activity WHERE query LIKE '%inspection_results%';
```

**Results:**
```
[To be filled]
```

---

## Test Results Summary

### Overall Test Statistics

| Category | Total Tests | Passed | Failed | Pending |
|----------|-------------|--------|--------|---------|
| Inspector Role - INSERT | 6 | [ ] | [ ] | [ ] |
| Inspector Role - SELECT/UPDATE | 3 | [ ] | [ ] | [ ] |
| Admin Role | 4 | [ ] | [ ] | [ ] |
| Unauthenticated | 2 | [ ] | [ ] | [ ] |
| Webhooks | 3 | [ ] | [ ] | [ ] |
| **TOTAL** | **18** | **[ ]** | **[ ]** | **[ ]** |

### Status Value Coverage

| Status | Tested in INSERT | Tested in UPDATE | Tested in SELECT | Webhook Verified |
|--------|------------------|------------------|------------------|------------------|
| `good` | ✅ | ✅ | ✅ | [ ] |
| `issue` | ✅ | [ ] | ✅ | [ ] |
| `critical` | ✅ | [ ] | ✅ | [ ] |
| `skipped` | ✅ | ✅ | ✅ | ✅ |
| `not_applicable` | ✅ | [ ] | ✅ | ✅ |

---

## Issues & Resolutions

### Issue Log

| Issue # | Description | Status Value | Severity | Resolution | Status |
|---------|-------------|--------------|----------|------------|--------|
| [Example] | RLS policy denies skipped status | `skipped` | High | Policy doesn't filter by status - false alarm | Resolved |
|  |  |  |  |  |  |

### Known Limitations

- None identified at this time

---

## Sign-Off

### Test Execution

**Executed By:** ___________________________
**Date:** ___________________________
**Environment:** [ ] Local | [ ] Staging | [ ] Production

### Results

**Overall Status:** [ ] ✅ ALL TESTS PASSED | [ ] ⚠️ SOME FAILURES | [ ] ❌ CRITICAL FAILURES

**Summary:**
```
[Brief summary of test results]
```

### Approvals

- [ ] **QA Engineer:** ___________________________  Date: ___________
- [ ] **Technical Lead:** ___________________________  Date: ___________
- [ ] **Security Review:** ___________________________  Date: ___________

### Production Deployment

- [ ] All tests passed
- [ ] No RLS policy changes required
- [ ] Webhooks verified working
- [ ] Documentation updated
- [ ] Approved for production deployment

**Deployment Date:** ___________________________

---

## References

- **Migration:** [20251104120000_extend_inspection_statuses.sql](../../supabase/migrations/20251104120000_extend_inspection_statuses.sql)
- **Base Schema:** [20250922124500_nhome_schema.sql](../../supabase/migrations/20250922124500_nhome_schema.sql)
- **Data Flow Doc:** [inspection-data-flow.md](../inspection-data-flow.md)
- **Supabase RLS Documentation:** https://supabase.com/docs/guides/auth/row-level-security

---

## Appendix A: How to Get Auth Tokens

### Method 1: Supabase Studio (Local)

1. Start Supabase: `supabase start`
2. Open Studio: `http://localhost:54323`
3. Navigate to **Authentication** → **Users**
4. Click on a user → Copy **JWT Token** from user details

### Method 2: Sign In via API

```bash
# Get JWT token by signing in
curl -X POST 'https://<project-ref>.supabase.co/auth/v1/token?grant_type=password' \
  -H "apikey: <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "inspector@nhomesetup.com",
    "password": "<password>"
  }'
```

Response includes `access_token` (JWT).

### Method 3: Supabase Dashboard (Production)

1. Go to https://app.supabase.com
2. Select your project
3. Navigate to **Authentication** → **Users**
4. Click user → **Generate Link** → **Magic Link**
5. Sign in via magic link and inspect network request for JWT token

---

## Appendix B: Sample Test Script

See [rls-test-script.sh](./rls-test-script.sh) for automated testing script.

---

**End of Test Matrix**
