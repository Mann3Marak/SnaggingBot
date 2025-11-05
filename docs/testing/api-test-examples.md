# API Test Examples: New Status Values

**Ticket:** Ticket 5 – Verify Row-Level Security & Webhooks with New Statuses
**Purpose:** Quick reference for testing REST API with all status values
**Created:** 2025-11-04

---

## Quick Start

### 1. Get Your Configuration

```bash
# Set environment variables
export SUPABASE_URL="https://<your-project-ref>.supabase.co"
export SUPABASE_ANON_KEY="<your-anon-key>"

# For local development
export SUPABASE_URL="http://localhost:54321"
export SUPABASE_ANON_KEY="<local-anon-key>"
```

### 2. Authenticate and Get JWT Token

```bash
# Inspector user
export INSPECTOR_EMAIL="inspector@nhomesetup.com"
export INSPECTOR_PASSWORD="your-password"

curl -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${INSPECTOR_EMAIL}\",\"password\":\"${INSPECTOR_PASSWORD}\"}" \
  | jq -r '.access_token'
```

Store the token:
```bash
export INSPECTOR_TOKEN="<paste-jwt-token-here>"
```

### 3. Get Test IDs

```bash
# Get a session ID
export SESSION_ID=$(curl -s "${SUPABASE_URL}/rest/v1/inspection_sessions?limit=1" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${INSPECTOR_TOKEN}" \
  | jq -r '.[0].id')

# Get checklist item IDs
curl -s "${SUPABASE_URL}/rest/v1/checklist_templates?limit=5" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${INSPECTOR_TOKEN}" \
  | jq -r '.[].id'
```

Store item IDs:
```bash
export ITEM_ID_1="<paste-first-id>"
export ITEM_ID_2="<paste-second-id>"
export ITEM_ID_3="<paste-third-id>"
export ITEM_ID_4="<paste-fourth-id>"
export ITEM_ID_5="<paste-fifth-id>"
```

---

## Test 1: INSERT with `status = 'good'`

```bash
curl -X POST "${SUPABASE_URL}/rest/v1/inspection_results" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${INSPECTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"session_id\": \"${SESSION_ID}\",
    \"item_id\": \"${ITEM_ID_1}\",
    \"status\": \"good\",
    \"notes\": \"All items meet NHome standards\",
    \"priority_level\": 1
  }"
```

**Expected:** HTTP 201, response includes created record with `"status": "good"`

---

## Test 2: INSERT with `status = 'issue'`

```bash
curl -X POST "${SUPABASE_URL}/rest/v1/inspection_results" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${INSPECTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"session_id\": \"${SESSION_ID}\",
    \"item_id\": \"${ITEM_ID_2}\",
    \"status\": \"issue\",
    \"notes\": \"Minor scratch on cabinet door\",
    \"priority_level\": 2
  }"
```

**Expected:** HTTP 201, response includes `"status": "issue"`

---

## Test 3: INSERT with `status = 'critical'`

```bash
curl -X POST "${SUPABASE_URL}/rest/v1/inspection_results" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${INSPECTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"session_id\": \"${SESSION_ID}\",
    \"item_id\": \"${ITEM_ID_3}\",
    \"status\": \"critical\",
    \"notes\": \"Structural crack in load-bearing wall\",
    \"priority_level\": 3
  }"
```

**Expected:** HTTP 201, response includes `"status": "critical"`

---

## Test 4: INSERT with `status = 'skipped'` (NEW)

```bash
curl -X POST "${SUPABASE_URL}/rest/v1/inspection_results" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${INSPECTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"session_id\": \"${SESSION_ID}\",
    \"item_id\": \"${ITEM_ID_4}\",
    \"status\": \"skipped\",
    \"notes\": \"Will inspect after furniture is moved\",
    \"priority_level\": 1
  }"
```

**Expected:** HTTP 201, response includes `"status": "skipped"`

✅ **This is a NEW status value - verify it works!**

---

## Test 5: INSERT with `status = 'not_applicable'` (NEW)

```bash
curl -X POST "${SUPABASE_URL}/rest/v1/inspection_results" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${INSPECTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"session_id\": \"${SESSION_ID}\",
    \"item_id\": \"${ITEM_ID_5}\",
    \"status\": \"not_applicable\",
    \"notes\": \"Unit does not have a balcony (ground floor)\",
    \"priority_level\": 1
  }"
```

**Expected:** HTTP 201, response includes `"status": "not_applicable"`

✅ **This is a NEW status value - verify it works!**

---

## Test 6: INSERT with Invalid Status (Should FAIL)

```bash
curl -X POST "${SUPABASE_URL}/rest/v1/inspection_results" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${INSPECTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"session_id\": \"${SESSION_ID}\",
    \"item_id\": \"${ITEM_ID_1}\",
    \"status\": \"invalid_status\",
    \"notes\": \"This should fail\",
    \"priority_level\": 1
  }"
```

**Expected:** HTTP 400 or 500 with error message about constraint violation

❌ **This should FAIL - confirming constraint is working**

---

## Test 7: SELECT All Results

```bash
curl -s "${SUPABASE_URL}/rest/v1/inspection_results?session_id=eq.${SESSION_ID}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${INSPECTOR_TOKEN}" \
  | jq '.'
```

**Expected:** HTTP 200, array containing all 5 results with different statuses

**Verify:**
- [ ] Result with `"status": "good"` present
- [ ] Result with `"status": "issue"` present
- [ ] Result with `"status": "critical"` present
- [ ] Result with `"status": "skipped"` present
- [ ] Result with `"status": "not_applicable"` present

---

## Test 8: UPDATE Status from 'skipped' to 'good'

First, get the ID of the 'skipped' result:
```bash
export SKIPPED_RESULT_ID=$(curl -s "${SUPABASE_URL}/rest/v1/inspection_results?session_id=eq.${SESSION_ID}&status=eq.skipped&limit=1" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${INSPECTOR_TOKEN}" \
  | jq -r '.[0].id')
```

Then update it:
```bash
curl -X PATCH "${SUPABASE_URL}/rest/v1/inspection_results?id=eq.${SKIPPED_RESULT_ID}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${INSPECTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"status\": \"good\",
    \"notes\": \"Inspected after furniture moved - all good\"
  }"
```

**Expected:** HTTP 200, updated record with `"status": "good"`

---

## Test 9: Filter by New Status Values

### Get all 'skipped' results:
```bash
curl -s "${SUPABASE_URL}/rest/v1/inspection_results?status=eq.skipped" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${INSPECTOR_TOKEN}" \
  | jq '.'
```

### Get all 'not_applicable' results:
```bash
curl -s "${SUPABASE_URL}/rest/v1/inspection_results?status=eq.not_applicable" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${INSPECTOR_TOKEN}" \
  | jq '.'
```

### Get all non-good results (including new statuses):
```bash
curl -s "${SUPABASE_URL}/rest/v1/inspection_results?status=neq.good" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${INSPECTOR_TOKEN}" \
  | jq '.'
```

**Expected:** HTTP 200, filtered results

---

## Test 10: DELETE a Result

```bash
curl -X DELETE "${SUPABASE_URL}/rest/v1/inspection_results?id=eq.${SKIPPED_RESULT_ID}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${INSPECTOR_TOKEN}"
```

**Expected:** HTTP 204 No Content

---

## Test 11: Unauthenticated Request (Should FAIL)

```bash
curl -X POST "${SUPABASE_URL}/rest/v1/inspection_results" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"session_id\": \"${SESSION_ID}\",
    \"item_id\": \"${ITEM_ID_1}\",
    \"status\": \"good\",
    \"notes\": \"Unauthorized attempt\"
  }"
```

**Expected:** HTTP 401 Unauthorized or empty response (RLS blocks it)

---

## Test 12: Admin User (Access All Sessions)

### Authenticate as admin:
```bash
export ADMIN_EMAIL="natalie@nhomesetup.com"
export ADMIN_PASSWORD="your-admin-password"

export ADMIN_TOKEN=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" \
  | jq -r '.access_token')
```

### Get ALL results (across all sessions):
```bash
curl -s "${SUPABASE_URL}/rest/v1/inspection_results?limit=100" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  | jq '. | length'
```

**Expected:** HTTP 200, array with results from multiple sessions

---

## Automation: Run All Tests

Create a bash script:

```bash
#!/bin/bash
# save as: test-all-statuses.sh

# Configuration
export SUPABASE_URL="http://localhost:54321"
export SUPABASE_ANON_KEY="<your-key>"
export INSPECTOR_EMAIL="inspector@nhomesetup.com"
export INSPECTOR_PASSWORD="password"

# Authenticate
export INSPECTOR_TOKEN=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${INSPECTOR_EMAIL}\",\"password\":\"${INSPECTOR_PASSWORD}\"}" \
  | jq -r '.access_token')

# Get test data
export SESSION_ID=$(curl -s "${SUPABASE_URL}/rest/v1/inspection_sessions?limit=1" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${INSPECTOR_TOKEN}" \
  | jq -r '.[0].id')

ITEM_IDS=($(curl -s "${SUPABASE_URL}/rest/v1/checklist_templates?limit=5" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${INSPECTOR_TOKEN}" \
  | jq -r '.[].id'))

# Test each status
STATUSES=("good" "issue" "critical" "skipped" "not_applicable")
for i in "${!STATUSES[@]}"; do
  echo "Testing status: ${STATUSES[$i]}"
  curl -s -X POST "${SUPABASE_URL}/rest/v1/inspection_results" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${INSPECTOR_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "{
      \"session_id\": \"${SESSION_ID}\",
      \"item_id\": \"${ITEM_IDS[$i]}\",
      \"status\": \"${STATUSES[$i]}\",
      \"notes\": \"Test for ${STATUSES[$i]} status\"
    }" | jq '.[] | {id, status, notes}'
  echo ""
done

echo "All tests complete!"
```

Run it:
```bash
chmod +x test-all-statuses.sh
./test-all-statuses.sh
```

---

## Cleanup After Testing

```bash
# Delete all test results for the session
curl -X DELETE "${SUPABASE_URL}/rest/v1/inspection_results?session_id=eq.${SESSION_ID}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${INSPECTOR_TOKEN}"

# Verify deletion
curl -s "${SUPABASE_URL}/rest/v1/inspection_results?session_id=eq.${SESSION_ID}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${INSPECTOR_TOKEN}" \
  | jq '. | length'

# Should return 0
```

---

## Troubleshooting

### Error: `relation "inspection_results" does not exist`

**Cause:** Database not initialized or wrong database URL

**Solution:**
```bash
# For local
supabase db reset

# Verify tables exist
psql $(supabase db get-url) -c "\dt"
```

---

### Error: `new row violates check constraint "inspection_results_status_check"`

**Cause:** Trying to insert an invalid status value

**Expected behavior:** This error should occur for Test 6 (invalid status)

**If it occurs for `'skipped'` or `'not_applicable'`:**
- Migration not applied
- Run: `supabase db reset` or `supabase db push`

---

### Error: `JWT expired`

**Cause:** Auth token has expired (default: 1 hour)

**Solution:** Re-authenticate to get a new token

---

### Error: `No rows returned` (RLS blocking)

**Cause:** RLS policy preventing access

**Check:**
1. Is the session owned by this inspector?
2. Is the auth token valid?
3. Are RLS policies enabled?

```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'inspection_results';

-- Should show: rowsecurity = true
```

---

## Quick Reference

| Operation | HTTP Method | Endpoint |
|-----------|-------------|----------|
| Create result | POST | `/rest/v1/inspection_results` |
| Get all results | GET | `/rest/v1/inspection_results` |
| Get by session | GET | `/rest/v1/inspection_results?session_id=eq.<uuid>` |
| Filter by status | GET | `/rest/v1/inspection_results?status=eq.skipped` |
| Update result | PATCH | `/rest/v1/inspection_results?id=eq.<uuid>` |
| Delete result | DELETE | `/rest/v1/inspection_results?id=eq.<uuid>` |

---

## References

- [RLS Status Matrix](./rls-status-matrix.md)
- [Automated Test Script](./rls-test-script.sh)
- [Webhook Verification Guide](./webhook-verification-guide.md)
- [Supabase REST API Docs](https://supabase.com/docs/reference/javascript/select)
