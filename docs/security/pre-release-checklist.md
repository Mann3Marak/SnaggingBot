# Pre-Release Security Checklist

**Purpose:** Ensure all security requirements are met before deploying customer-facing features to production

**Required For:** Customer portal launch, major releases, security-sensitive features

**Completion Time:** 30-60 minutes

**Sign-off Required:** Security Team + Technical Lead

---

## Overview

This checklist ensures the application meets security standards before production deployment. All items must be verified and checked off before release approval.

**Severity Levels:**
- 🔴 **Critical:** Must pass - blocks release
- 🟡 **High:** Should pass - requires justification if skipped
- 🟢 **Medium:** Nice to have - document if skipped

---

## 1. Authentication & Authorization 🔴

### 1.1 API Authentication

- [ ] **All `/api/nhome/*` routes require authentication**
  - Test: `curl http://localhost:3000/api/nhome/apartments/list` → 401 Unauthorized
  - Verify: No routes bypass `requireApiAuth`, `requireOwnership`, or `requireRole`

- [ ] **All `/api/portal/*` routes require authentication**
  - Test: `curl http://localhost:3000/api/portal/me` → 401 Unauthorized
  - Verify: Every portal route calls `requireApiAuth` first

- [ ] **Unauthenticated requests return 401 (not 500 or 200)**
  - Test each public-facing endpoint without Authorization header
  - Expected: `{ "error": "Unauthorized" }` with status 401

### 1.2 Role-Based Access Control

- [ ] **Admin-only endpoints reject non-admin users**
  - Test: Inspector token → `POST /api/nhome/fix-completed-sessions` → 403 Forbidden
  - Routes: All routes using `requireRole(['admin'])`

- [ ] **Inspector cannot access other inspectors' sessions**
  - Test: Inspector A token → GET session belonging to Inspector B → 403/404
  - Routes: `/api/nhome/diagnostics/[sessionId]`, `/api/nhome/upload-report`

- [ ] **Role checks happen BEFORE any data operations**
  - Verify: Auth errors throw NextResponse with status code (not generic Error)
  - Pattern: All routes catch and return auth errors properly

### 1.3 Session Management

- [ ] **Session tokens expire appropriately**
  - Verify: Token TTL set in Supabase (recommended: 1 hour)
  - Test: Old token (> TTL) → 401 Unauthorized

- [ ] **Refresh tokens work correctly**
  - Test: Refresh endpoint returns new access token
  - Verify: Old access token invalidated after refresh

- [ ] **Logout invalidates tokens**
  - Test: Logout → token no longer works → 401 Unauthorized

---

## 2. Data Isolation 🔴

### 2.1 Company Isolation

- [ ] **All service role queries filter by company_id**
  - Audit: Search codebase for `createServiceClient` usage
  - Verify: Every query includes `.eq('company_id', profile.company_id)` or joins through projects table

- [ ] **RLS policies enabled on all tables**
  - Check: Supabase Dashboard → Table Editor → RLS column shows "Enabled"
  - Tables: projects, apartments, inspection_sessions, inspection_results, users, companies

- [ ] **Service role usage is logged**
  - Verify: All `createServiceClient` calls include `userId` and `route` parameters
  - Test: Check logs for `[ServiceRole]` entries with userId tracking

### 2.2 IDOR Prevention

- [ ] **IDOR test suite passes (100% pass rate)**
  - Run: `npm run test:security:idor`
  - Expected: All tests pass, 0 cross-tenant access

- [ ] **Dynamic routes return 404 (not 403) for unauthorized access**
  - Test: User A → GET apartment belonging to Company B → 404 "Apartment not found"
  - Routes: All `[id]` dynamic routes in `/api/portal/apartments/`

- [ ] **Apartment listing filtered by company**
  - Test: User A → GET `/api/portal/apartments/list` → only Company A apartments returned
  - Verify: No Company B apartments appear in list

### 2.3 Query Safety

- [ ] **No raw SQL queries without parameterization**
  - Search codebase: `supabase.rpc`, `supabase.from().select()`
  - Verify: All dynamic values use `.eq()`, `.in()` (not string concatenation)

- [ ] **Joins include company_id filter**
  - Example: `projects!inner(...)` with `.eq('projects.company_id', profile.company_id)`
  - Verify: All cross-table queries enforce company isolation

---

## 3. Secrets Management 🔴

### 3.1 Service Role Key Protection

- [ ] **Service role key never exposed client-side**
  - Search: `grep -r "SUPABASE_SERVICE_ROLE_KEY" src/app/**/page.tsx src/components src/hooks`
  - Expected: No results

- [ ] **Service role key only in API routes**
  - Verify: Key only accessed in `src/app/api/**/*.ts` files
  - Verify: All access goes through `createServiceClient()` wrapper

- [ ] **Pre-commit hook prevents client-side exposure**
  - Test: Add `SUPABASE_SERVICE_ROLE_KEY` to a component → git commit → BLOCKED
  - File: `.husky/pre-commit`

### 3.2 Environment Variables

- [ ] **All secrets in environment variables (not hardcoded)**
  - Search: `grep -r "sk_live" src/` (Stripe), `grep -r "ghp_" src/` (GitHub tokens)
  - Expected: No hardcoded secrets

- [ ] **Production uses different secrets than staging/dev**
  - Verify: Production `.env` != Staging `.env`
  - Check: Supabase project IDs different

- [ ] **Secrets not committed to git**
  - Run: `git log -p --all | grep "SUPABASE_SERVICE_ROLE_KEY"`
  - Expected: No results (if found, rotate keys immediately)

### 3.3 Key Rotation

- [ ] **Service role key rotation runbook tested**
  - Location: `docs/runbooks/service-role-key-rotation.md`
  - Test: Perform dry-run rotation in staging environment
  - Verify: Rollback procedure works

- [ ] **Next rotation scheduled**
  - Check: Calendar has reminder 3 months from last rotation
  - Verify: Team knows who performs rotations

---

## 4. API Security 🟡

### 4.1 Rate Limiting

- [ ] **Write endpoints have rate limits**
  - Routes: POST `/api/nhome/apartments`, POST `/api/nhome/inspections/create`
  - Verify: Rate limit middleware applied or documented as TODO

- [ ] **Rate limit bypasses logged**
  - Check: Admin/system bypasses are logged
  - Verify: Suspicious activity triggers alerts

### 4.2 Input Validation

- [ ] **Request body validated before processing**
  - Check: All POST/PUT routes validate required fields
  - Example: `if (!sessionId) return 400`

- [ ] **UUIDs validated as valid UUID format**
  - Test: Send invalid UUID → 400 Bad Request (not 500 Internal Error)
  - Routes: All `[id]` dynamic routes

- [ ] **File uploads validated**
  - Check: Max file size enforced (e.g., 10MB for photos)
  - Check: File type validated (only images/PDFs allowed)

### 4.3 CORS Configuration

- [ ] **CORS configured correctly for production**
  - Verify: No wildcard `Access-Control-Allow-Origin: *` in production
  - Expected: Specific domains whitelisted

- [ ] **Credentials included only for trusted origins**
  - Check: `Access-Control-Allow-Credentials: true` only for app domain

### 4.4 Error Handling

- [ ] **Production errors don't expose sensitive data**
  - Test: Trigger error → response doesn't include stack traces, file paths, env vars
  - Verify: Generic error messages in production

- [ ] **Auth errors return appropriate status codes**
  - 401: Unauthenticated
  - 403: Unauthorized (authenticated but insufficient permissions)
  - 404: Not found (IDOR protection)

---

## 5. Infrastructure 🟡

### 5.1 HTTPS

- [ ] **Production enforces HTTPS**
  - Test: `curl http://your-app.com` → redirects to `https://`
  - Verify: HSTS header present

- [ ] **TLS certificate valid**
  - Check: No browser warnings when visiting site
  - Verify: Certificate not expiring within 30 days

### 5.2 Security Headers

- [ ] **Security headers configured**
  - Check: Response includes:
    - `X-Frame-Options: DENY`
    - `X-Content-Type-Options: nosniff`
    - `Strict-Transport-Security: max-age=31536000`
    - `Content-Security-Policy: ...`
  - Tool: https://securityheaders.com/

- [ ] **CSP policy blocks inline scripts**
  - Verify: `Content-Security-Policy` doesn't include `unsafe-inline`
  - Exception: Document if required for third-party scripts

### 5.3 Dependencies

- [ ] **No critical CVEs in dependencies**
  - Run: `npm audit --production`
  - Expected: 0 critical, 0 high vulnerabilities

- [ ] **Dependencies up to date**
  - Run: `npm outdated`
  - Verify: Major version updates reviewed for breaking changes

- [ ] **Unused dependencies removed**
  - Run: `npx depcheck`
  - Remove: Unused packages to reduce attack surface

---

## 6. Testing 🔴

### 6.1 Security Test Suite

- [ ] **IDOR test suite passes**
  - Run: `npm run test:security:idor`
  - Expected: 100% pass rate, 0 cross-tenant access

- [ ] **Authentication test suite passes**
  - Run: `npm run test:security:auth`
  - Expected: All unauthenticated requests blocked

- [ ] **Authorization test suite passes**
  - Run: `npm run test:security:authz`
  - Expected: All role checks enforced

### 6.2 Manual Security Testing

- [ ] **IDOR tampering attempts fail**
  - Test: User A → tamper apartment ID to Company B → 404 Not Found
  - Test: Inspector → tamper session ID to other inspector → 403/404

- [ ] **SQL injection attempts fail**
  - Test: Send `'; DROP TABLE users; --` in query params → no database change
  - Verify: Parameterized queries used everywhere

- [ ] **XSS attempts fail**
  - Test: Submit `<script>alert('XSS')</script>` in forms → escaped in output
  - Verify: User input sanitized before display

### 6.3 Load Testing

- [ ] **Auth endpoints handle traffic**
  - Test: 100 concurrent auth requests → all succeed
  - Tool: Apache Bench or k6

- [ ] **No rate limit DoS vulnerability**
  - Test: Rate limit doesn't block legitimate traffic
  - Verify: Rate limit applies per-user (not global)

---

## 7. Monitoring & Logging 🟢

### 7.1 Audit Logging

- [ ] **Authentication events logged**
  - Events: Login, logout, failed login attempts
  - Check: Logs include userId, IP, timestamp

- [ ] **Authorization failures logged**
  - Events: 403 Forbidden, IDOR attempts
  - Check: Logs include userId, resourceId, route

- [ ] **Service role usage logged**
  - Check: All `createServiceClient` calls log userId + route
  - Verify: Can trace which user triggered service role operation

### 7.2 Error Tracking

- [ ] **Error tracking configured (Sentry/Datadog)**
  - Verify: Errors appear in dashboard
  - Check: PII not included in error reports

- [ ] **Security alerts configured**
  - Alerts: Multiple failed logins, IDOR attempts, rate limit exceeded
  - Verify: Alerts sent to security team channel

### 7.3 Metrics

- [ ] **Authentication metrics tracked**
  - Metrics: Login success/failure rate, token expiry rate
  - Dashboard: Auth metrics visible to security team

- [ ] **API usage metrics tracked**
  - Metrics: Requests per endpoint, error rates, latency
  - Dashboard: Anomalies trigger alerts

---

## 8. Documentation 🟢

### 8.1 Security Documentation

- [ ] **Security architecture documented**
  - Location: `docs/security/architecture.md`
  - Includes: Auth flow, RLS policies, service role usage

- [ ] **Threat model documented**
  - Location: `docs/security/threat-model.md`
  - Includes: Attack vectors, mitigations, residual risks

### 8.2 Runbooks

- [ ] **Incident response runbook exists**
  - Location: `docs/runbooks/security-incident.md`
  - Includes: Who to notify, steps to contain, evidence collection

- [ ] **Key rotation runbook exists and tested**
  - Location: `docs/runbooks/service-role-key-rotation.md`
  - Tested: Dry-run in staging environment

### 8.3 API Documentation

- [ ] **Authentication documented for developers**
  - Location: `docs/api/authentication.md`
  - Includes: How to get tokens, header format, error codes

- [ ] **Rate limits documented**
  - Location: `docs/api/rate-limits.md`
  - Includes: Limits per endpoint, how to handle 429 errors

---

## 9. Compliance 🟢

### 9.1 Data Privacy

- [ ] **GDPR compliance reviewed**
  - Data retention: Defined and documented
  - User deletion: Implemented and tested
  - Data export: User can download their data

- [ ] **Data encryption at rest**
  - Verify: Supabase uses AES-256 encryption
  - Check: Backups also encrypted

- [ ] **Data encryption in transit**
  - Verify: All API calls use HTTPS
  - Check: Database connections use TLS

### 9.2 Access Control

- [ ] **Principle of least privilege applied**
  - Service role: Only used when RLS too restrictive
  - Admin role: Only assigned to necessary users

- [ ] **User access reviewed**
  - Check: No orphaned accounts with admin access
  - Verify: User access matches job function

---

## 10. Release Criteria 🔴

### 10.1 Critical Blockers

All items marked 🔴 **Critical** must pass before release:

- [ ] All API routes require authentication (Section 1.1)
- [ ] IDOR test suite passes (Section 2.2)
- [ ] Service role key never client-side (Section 3.1)
- [ ] RLS policies enabled (Section 2.1)
- [ ] Security test suites pass (Section 6.1)

### 10.2 High Priority

All items marked 🟡 **High** should pass, or document justification:

- [ ] Rate limiting implemented (Section 4.1)
- [ ] HTTPS enforced (Section 5.1)
- [ ] No critical CVEs (Section 5.3)

### 10.3 Documentation Required

- [ ] Known security limitations documented
- [ ] Post-release monitoring plan defined
- [ ] Rollback procedure tested

---

## Sign-Off

### Pre-Release Verification

**Security Checklist Completed By:**
- Name: ________________
- Role: ________________
- Date: ________________
- Signature: ________________

**Critical Items Status:**
- Total Critical Items: 15
- Passed: _____ / 15
- Failed: _____ (must be 0)

**High Priority Items Status:**
- Total High Items: 8
- Passed: _____ / 8
- Exceptions: ________________

### Approval

**Security Team Approval:**
- Reviewer: ________________
- Date: ________________
- Status: ☐ Approved ☐ Rejected ☐ Conditional
- Comments: ________________

**Technical Lead Approval:**
- Reviewer: ________________
- Date: ________________
- Status: ☐ Approved ☐ Rejected ☐ Conditional
- Comments: ________________

**Release Authorization:**
- Authorized by: ________________
- Date: ________________
- Production Deploy Scheduled: ________________

---

## Post-Release Actions

**After Deployment:**

- [ ] Monitor error rates for first 24 hours
- [ ] Review authentication logs for anomalies
- [ ] Verify no security regressions (run tests against production)
- [ ] Update security documentation with lessons learned
- [ ] Schedule security review in 1 month

**Known Issues / Technical Debt:**
- ________________
- ________________

---

**Version:** 1.0
**Last Updated:** 2026-02-07
**Next Review:** 2026-05-07
