# Security Test Suite Report

## Test Execution Date
2026-02-08

## Summary
- **Total Tests**: 38
- **Passed**: 15 (39%)
- **Failed**: 23 (61%)
- **Skipped**: 6 (incomplete test data)

## Critical Issues Found

### 1. Bearer Token Authentication Failure ⚠️ CRITICAL
**Severity**: HIGH
**Status**: BLOCKING

**Symptoms**:
- Tests send `Authorization: Bearer <token>` header
- Server logs show "Auth session missing!"
- Endpoints return 401 even with valid tokens

**Affected Endpoints**:
- `/api/portal/me`
- `/api/portal/apartments/list`
- `/api/portal/apartments/[id]`
- All `/api/nhome/*` endpoints

**Root Cause**:
The `requireApiAuth()` function in `apiAuth.ts` checks for Bearer tokens, but the implementation might have an issue with how it creates the authenticated Supabase client.

**Impact**:
- All API testing blocked
- Cannot verify security implementations

---

### 2. Missing Test Data ⚠️ HIGH
**Severity**: HIGH
**Status**: BLOCKING

**Symptoms**:
- Company A apartment ID: (empty)
- Company B apartment ID: (empty)
- Tests skip cross-company validation

**Root Cause**:
The `create-test-users.ts` script creates users and companies but doesn't create:
- Projects
- Apartments
- Inspection sessions

**Impact**:
- Cannot test IDOR prevention
- Cannot test data isolation
- Cannot test cross-company access controls

---

### 3. 500 Errors Instead of Proper Error Codes
**Severity**: MEDIUM
**Status**: FAILING

**Examples**:
```
Test: "Invalid apartment ID returns 404"
Expected: 404
Received: 500

Test: "Admin-only endpoint rejects non-admin"
Expected: 403
Received: 500

Test: "Non-existent resource returns 404"
Expected: 404
Received: 500
```

**Root Cause**:
Endpoints are throwing unhandled exceptions instead of returning proper error responses.

**Affected Code**:
- `/api/portal/apartments/[id]` - UUID validation error
- `/api/nhome/fix-completed-sessions` - Role check error
- Error handling in various endpoints

---

### 4. HTTP Method Mismatches
**Severity**: LOW
**Status**: FAILING

**Example**:
```
Test: "All /api/nhome routes reject unauthenticated"
Expected: 401
Received: 405 (Method Not Allowed)
```

**Root Cause**:
Some routes only accept POST but tests send GET requests.

---

## Detailed Test Results

### ✅ **PASSING TESTS (15)**

#### Authentication:
- ✅ All `/api/portal` routes reject unauthenticated requests
- ✅ Invalid token returns 401
- ✅ Expired token returns 401 (skipped - no expired token)

#### Authorization:
- ✅ Admin users can access admin-only routes
- ✅ Inspector cannot access other inspector sessions (skipped - no session ID)

#### IDOR Prevention:
- ✅ Company A cannot access Company B apartments (both empty, trivially passes)
- ✅ Sequential ID guessing fails (UUIDs used correctly)

#### Data Isolation:
- (None passing)

#### Error Handling:
- ✅ Errors do not expose sensitive information
- ✅ XSS attempts are escaped

#### Security Features:
- ⚠️ Rate limiting not detected (warning, not implemented)

---

### ❌ **FAILING TESTS (23)**

#### Authentication (2 failures):
1. ❌ All `/api/nhome` routes reject unauthenticated
   - **Error**: Got 405 instead of 401
   - **Cause**: HTTP method mismatch

2. ❌ Missing Authorization header returns 401
   - **Error**: Error message format wrong
   - **Expected**: /unauthorized|authentication/i
   - **Received**: "Unable to read authenticated user"

#### Authorization (3 failures):
3. ❌ Admin-only routes reject non-admin users
   - **Error**: Got 500 instead of 403
   - **Cause**: Unhandled exception

4. ❌ Users cannot escalate privileges
   - **Error**: Got 500 instead of 403

5. ❌ Cross-inspector test
   - **Status**: Skipped (no test data)

#### IDOR Prevention (4 failures):
6. ❌ Invalid UUID returns 404 or 400 (not 500)
   - **Error**: Got 500 instead of 404/400
   - **Cause**: UUID validation throwing unhandled error

7. ❌ Non-existent resource returns 404
   - **Error**: Got 500 instead of 404

8. ❌ Company A user cannot access Company B apartment details
   - **Status**: Skipped (no apartment IDs)

9. ❌ Company B user cannot access Company A apartment details
   - **Status**: Skipped (no apartment IDs)

#### Data Isolation (4 failures):
10. ❌ Apartment list only shows user company apartments
    - **Error**: Got 500 instead of 200
    - **Cause**: Bearer token not working

11. ❌ `/api/portal/me` only shows user profile
    - **Error**: `data.user.email` is undefined
    - **Cause**: Endpoint returns 500, JSON response malformed

12. ❌ Inspections filtered by company
    - **Error**: Got 500 instead of 200

13. ❌ User has no apartments
    - **Status**: Skipped (no test data)

#### Error Handling (5 failures):
14. ❌ Authentication errors return 401 (not 500)
    - **Error**: Message format wrong

15. ❌ Authorization errors return 403 (not 500)
    - **Error**: Got 500 instead of 403

16. ❌ IDOR attempts return 404 (not 403 or 500)
    - **Error**: Got 500 instead of 404

17. ❌ Malformed JSON returns 400 (not 500)
    - **Error**: Got 500 instead of 400

18. ❌ Malformed UUID returns 404 or 400 (not 500)
    - **Error**: Got 500 instead of 404/400

#### Input Validation (3 failures):
19. ❌ Missing required fields return 400
    - **Error**: Got 500 instead of 400

20. ❌ SQL injection attempts fail safely
    - **Error**: Got 500 instead of proper handling

21. ❌ XSS attempts escaped
    - ✅ PASSING

#### Portal Endpoints (2 failures):
22. ❌ Company A user can only see their own apartments in list
    - **Error**: Got 500 instead of 200

23. ❌ Company B user can only see their own apartments in list
    - **Error**: Got 500 instead of 200

---

## Required Fixes

### Priority 1: BLOCKING (Must fix to run tests)
1. **Fix Bearer token authentication**
   - Debug `requireApiAuth()` Bearer token handling
   - Verify Supabase client creation with Bearer header
   - Add logging to track token flow

2. **Create test data**
   - Extend `create-test-users.ts` to create:
     - 2 companies
     - 2 projects (1 per company)
     - 4 apartments (2 per company)
     - 2 inspection sessions (1 per company)

### Priority 2: HIGH (Critical security gaps)
3. **Fix error handling**
   - Wrap UUID parsing in try-catch
   - Return proper HTTP status codes (400, 403, 404)
   - Ensure all endpoints catch and handle errors

4. **Standardize error messages**
   - Use consistent error message format
   - Match test expectations (/unauthorized|authentication/i)

### Priority 3: MEDIUM (Quality improvements)
5. **Fix HTTP method mismatches**
   - Verify route handlers accept correct methods
   - Add proper 405 responses for wrong methods

6. **Add input validation**
   - Validate UUID format before querying
   - Return 400 for malformed input

---

## Next Steps

1. **Debug Bearer token auth** (BLOCKING)
   - Add console.log to `requireApiAuth()` to trace Bearer token flow
   - Test manually with curl
   - Verify Supabase client respects Authorization header

2. **Create comprehensive test data** (BLOCKING)
   - Run enhanced `create-test-users.ts`
   - Verify apartments created
   - Verify UUIDs populated

3. **Fix error handling** (HIGH)
   - Audit all endpoints
   - Add proper try-catch blocks
   - Return appropriate status codes

4. **Re-run tests**
   - Execute full suite
   - Generate coverage report
   - Document remaining issues

---

## Test Report Location
This report: `TEST_REPORT.md`
Test suite: `tests/security/`
Raw output: See terminal output above

## Coverage Analysis
Jest coverage reporting is configured but not yet run. To generate:
```bash
npm test -- --coverage
```

This will create an HTML coverage report in `coverage/index.html`.
