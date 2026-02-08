# Customer Portal Delivery Plan (SnagginBot Extension)

## Recommendation
Build the customer portal inside the existing `SnagginBot` codebase as a **new bounded module**, not a full rebuild.

- UI namespace: `/portal/*`
- Customer APIs: `/api/portal/*`
- Admin operations APIs: `/api/portal-admin/*`
- Reuse existing DB and proven inspection/report flows
- Do **not** expose existing internal `/api/nhome/*` service-role routes to customer UI

---

## What to Tell Your Team

Use this exact direction:

1. Build this inside the existing `SnagginBot` codebase.
2. Implement a new isolated customer module:
   - UI in `/portal/*`
   - Customer APIs in `/api/portal/*`
   - Admin ops APIs in `/api/portal-admin/*`
3. Reuse the existing DB and proven inspection/report logic patterns.
4. Do not directly expose or call internal `/api/nhome/*` service-role routes from customer-facing pages.
5. Complete all Security Gate tickets (`SEC-001` to `SEC-004`) before any customer release.
6. Follow ticket acceptance criteria strictly and attach test evidence in the test folder.

---

## Architecture Decision

### Selected approach (Option A - Recommended)
Extend current system with strict isolation:
- Same repo
- Same Supabase database
- New customer module
- New customer-safe APIs
- Reuse only stable components and schema

### Why not start from scratch
- Higher timeline risk
- Higher defect risk for a junior team
- You already have validated inspection/report workflows and data model

---

## Security Gate (Mandatory Before Customer Release)

No customer launch until all items below are complete:

1. [ ] `SEC-001`: Fence/refactor risky service-role routes as internal-only
   - Acceptance:
   - [ ] 1. Internal routes are blocked from customer-facing usage
   - [ ] 2. Role checks and middleware protections implemented
   - [ ] 3. Unauthorized access attempts return 401/403

2. [ ] `SEC-002`: Portal least-privilege data access layer
   - Acceptance:
   - [ ] 1. `/api/portal/*` endpoints use auth context and ownership checks
   - [ ] 2. Tampering tests (IDOR) cannot retrieve cross-tenant data

3. [ ] `SEC-003`: Secrets hygiene and rotation
   - Acceptance:
   - [ ] 1. Service role key is server-only and never exposed client-side
   - [ ] 2. Key rotation runbook exists and has been tested once

4. [ ] `SEC-004`: Security sign-off checklist
   - Acceptance:
   - [ ] 1. All high-severity findings closed
   - [ ] 2. Security checklist approved before production release

---

## Sprint Plan (2-week sprints)

## Sprint 0: Foundation and Risk Removal
Goal: make the current platform safe and consistent to extend.

### [ ] `TKT-0001`: ADR for portal boundaries
- Description: Document module boundaries, roles, DB ownership, API ownership.
- Reuse references:
  - `src/app/api/nhome/*`
  - `supabase/migrations/*`
- Acceptance criteria:
  - [ ] 1. ADR exists at `/docs/adr/0001-customer-portal.md`
  - [ ] 2. States internal API separation policy
  - [ ] 3. Defines approved namespaces (`/portal/*`, `/api/portal/*`)

### [ ] `TKT-0002`: Data and naming consistency audit
- Description: Identify and resolve naming mismatches.
- Known examples:
  - `inspection_results` vs `nhome_inspection_results`
  - `nhome_photos` vs `nhome-inspection-photos`
  - `nhome_reports` vs `nhome-reports`
- Acceptance criteria:
  - [ ] 1. Audit doc with exact mismatches and canonical naming
  - [ ] 2. Team sign-off completed

### [ ] `TKT-0003`: Existing API risk classification
- Description: Mark each existing API route as internal-only, reusable, or deprecated.
- Reuse references:
  - `src/app/api/nhome/projects/route.ts`
  - `src/app/api/nhome/apartments/get/route.ts`
- Acceptance criteria:
  - [ ] 1. Route inventory published
  - [ ] 2. High-risk routes explicitly marked internal-only

### [ ] `TKT-0004`: Deterministic seed data for dev/test
- Description: Build realistic seed dataset.
- Acceptance criteria:
  - [ ] 1. One command seeds full demo dataset
  - [ ] 2. Includes at least 3 customers, 10 apartments, and mixed inspection statuses

### [ ] `TKT-0005`: Team delivery guardrails
- Description: PR rules, reviews, checklist.
- Acceptance criteria:
  - [ ] 1. PR template includes security/RLS/test evidence section
  - [ ] 2. No direct merge to `main` without reviewer approval

---

## Sprint 1: Identity, Roles, and Access Control
Goal: secure customer login and property mapping.

### [ ] `TKT-1001`: Add `customer` role support
- Description: extend roles to include `customer`.
- Reuse reference:
  - `supabase/migrations/20250922124500_nhome_schema.sql`
- Acceptance criteria:
  - [ ] 1. Migration applied successfully
  - [ ] 2. Existing roles remain unaffected

### [ ] `TKT-1002`: Create `customer_profiles` table
- Description: profile metadata for customer users.
- Acceptance criteria:
  - [ ] 1. Includes `user_id`, `full_name`, `phone`, `preferred_language`
  - [ ] 2. FK to `users.id` enforced

### [ ] `TKT-1003`: Create `apartment_customer_access` table
- Description: map customers to one or more apartments securely.
- Acceptance criteria:
  - [ ] 1. Many-to-many mapping supported
  - [ ] 2. Unique constraint on `(apartment_id, customer_user_id)`
  - [ ] 3. Access revocation flag exists

### [ ] `TKT-1004`: RLS policies for customer access
- Description: enforce apartment-scoped reads.
- Reuse reference:
  - RLS patterns in `supabase/migrations/20250922124500_nhome_schema.sql`
- Acceptance criteria:
  - [ ] 1. Customer cannot read non-mapped apartment data
  - [ ] 2. Admin/manager flows remain functional

### [ ] `TKT-1005`: `/portal/*` auth middleware
- Description: protect customer portal routes.
- Reuse references:
  - `middleware.ts`
  - `src/hooks/useAuthUser.ts`
- Acceptance criteria:
  - [ ] 1. Unauthenticated users redirected to sign-in
  - [ ] 2. Role enforcement active for customer pages

### [ ] `TKT-1006`: `GET /api/portal/me`
- Description: return profile and accessible apartments.
- Acceptance criteria:
  - [ ] 1. Uses server auth context (no client-supplied user id)
  - [ ] 2. Returns only mapped apartments

---

## Sprint 2: Customer MVP (Read-Only)
Goal: customer can view apartment status, snags, and reports.

### [ ] `TKT-2001`: Portal shell and nav
- Description: dashboard, reports, updates, services tabs.
- Acceptance criteria:
  - [ ] 1. Mobile-first responsive
  - [ ] 2. No direct dependency on inspector dashboard pages

### [ ] `TKT-2002`: `GET /api/portal/apartments`
- Description: customer apartment list endpoint.
- Reuse reference:
  - `src/app/api/nhome/apartments/list/route.ts`
- Acceptance criteria:
  - [ ] 1. Only authorized apartments returned
  - [ ] 2. Includes project/unit/type/building metadata

### [ ] `TKT-2003`: `GET /api/portal/apartments/:id/outstanding-snags`
- Description: unresolved snag details endpoint.
- Reuse references:
  - `src/app/api/nhome/inspections/follow-up-list/route.ts`
  - `inspection_results.follow_up_*`
- Acceptance criteria:
  - [ ] 1. Includes room/item/status/notes/updated time
  - [ ] 2. Shows unresolved items only
  - [ ] 3. Unauthorized apartment id returns 403

### [ ] `TKT-2004`: `GET /api/portal/apartments/:id/reports`
- Description: list report links for customer.
- Reuse references:
  - `src/app/api/nhome/inspections/save-reports/route.ts`
  - `nhome_inspection_reports`
- Acceptance criteria:
  - [ ] 1. Latest report versions first
  - [ ] 2. Clear empty state when reports unavailable

### [ ] `TKT-2005`: Dashboard cards
- Description: Outstanding Snags, Latest Report, Progress.
- Acceptance criteria:
  - [ ] 1. Counts match backend data
  - [ ] 2. Navigation works on desktop/mobile

### [ ] `TKT-2006`: Empty/error states
- Description: robust user messaging.
- Acceptance criteria:
  - [ ] 1. No raw error traces exposed
  - [ ] 2. Designed empty state for no-data scenarios

---

## Sprint 3: Video Updates
Goal: apartment and block-level updates for customers.

### [ ] `TKT-3001`: Create `property_updates` table
- Description: video update metadata by scope.
- Fields: `scope_type (apartment|building|project)`, `scope_id`, `title`, `video_url`, `published_at`, `is_active`.
- Acceptance criteria:
  - [ ] 1. Indexed for scope/date retrieval
  - [ ] 2. RLS enforces scope visibility

### [ ] `TKT-3002`: Admin publish endpoint
- Description: `POST /api/portal-admin/property-updates`.
- Acceptance criteria:
  - [ ] 1. Admin/manager-only access
  - [ ] 2. Scope and URL validation

### [ ] `TKT-3003`: Customer updates endpoint
- Description: `GET /api/portal/apartments/:id/updates`.
- Acceptance criteria:
  - [ ] 1. Returns apartment + building + project updates
  - [ ] 2. Sorted by `published_at` descending

### [ ] `TKT-3004`: Updates UI
- Description: feed and player.
- Acceptance criteria:
  - [ ] 1. Displays scope label and date
  - [ ] 2. Supports MP4 or embed URLs

### [ ] `TKT-3005`: Update visibility tests
- Description: authorization test suite.
- Acceptance criteria:
  - [ ] 1. Cross-customer access blocked
  - [ ] 2. Building-level visibility constrained correctly

---

## Sprint 4: Service Catalog and Requests (Deep Clean MVP)
Goal: self-service requests from customers.

### [ ] `TKT-4001`: Create `service_catalog` table
- Description: define bookable services.
- Acceptance criteria:
  - [ ] 1. Includes active flag, base price, quote-required flag
  - [ ] 2. Seed includes Deep Clean

### [ ] `TKT-4002`: Create `service_requests` table
- Description: request lifecycle model.
- Statuses: `submitted`, `reviewing`, `quoted`, `approved`, `scheduled`, `completed`, `cancelled`.
- Acceptance criteria:
  - [ ] 1. Links customer, apartment, and service
  - [ ] 2. Status and timestamps tracked

### [ ] `TKT-4003`: `POST /api/portal/service-requests`
- Description: create request endpoint.
- Acceptance criteria:
  - [ ] 1. Customer can only submit for mapped apartments
  - [ ] 2. Validation for required fields and preferred schedule

### [ ] `TKT-4004`: `GET /api/portal/service-requests`
- Description: list customer requests.
- Acceptance criteria:
  - [ ] 1. Returns caller-owned requests only
  - [ ] 2. Includes status and latest note

### [ ] `TKT-4005`: Admin request board
- Description: triage and workflow UI.
- Reuse reference:
  - patterns in `src/components/dashboard/*`
- Acceptance criteria:
  - [ ] 1. Filter by status/service
  - [ ] 2. Status changes visible to customer

### [ ] `TKT-4006`: Notifications
- Description: email notifications for create/update.
- Acceptance criteria:
  - [ ] 1. Confirmation on submit
  - [ ] 2. Notification on every status transition

---

## Sprint 5: Booking Workflow
Goal: scheduling and slot management.

### [ ] `TKT-5001`: Create `service_slots` table
- Description: operational capacity slots.
- Acceptance criteria:
  - [ ] 1. Slot date/time/capacity/active fields present
  - [ ] 2. Duplicate slot prevention constraint

### [ ] `TKT-5002`: `POST /api/portal/service-requests/:id/book`
- Description: attach approved request to slot.
- Acceptance criteria:
  - [ ] 1. Reject full slots
  - [ ] 2. Booking is transactional, no double booking

### [ ] `TKT-5003`: Customer booking UI
- Description: slot selection flow.
- Acceptance criteria:
  - [ ] 1. Displays future slots only
  - [ ] 2. Returns booking confirmation reference

### [ ] `TKT-5004`: Admin reschedule/cancel flow
- Description: operational changes with reason.
- Acceptance criteria:
  - [ ] 1. Audit trail records actor/time/reason
  - [ ] 2. Customer notified on changes

### [ ] `TKT-5005`: ICS export (optional)
- Description: calendar integration.
- Acceptance criteria:
  - [ ] 1. ICS imports to Outlook/Google
  - [ ] 2. Includes timezone and location

---

## Sprint 6: Hardening, QA, and UAT
Goal: production readiness.

### [ ] `TKT-6001`: End-to-end test pack
- Description: critical user journeys automated.
- Acceptance criteria:
  - [ ] 1. Full flow coverage from login to booking
  - [ ] 2. Runs in CI on PRs

### [ ] `TKT-6002`: Security and authorization test pack
- Description: IDOR and role escalation negative tests.
- Acceptance criteria:
  - [ ] 1. All negative tests pass
  - [ ] 2. No cross-tenant leakage

### [ ] `TKT-6003`: Performance baseline
- Description: response and load checks.
- Acceptance criteria:
  - [ ] 1. Portal API p95 thresholds met
  - [ ] 2. No identified N+1 hotspots

### [ ] `TKT-6004`: Observability
- Description: logs, monitoring, error tracking.
- Acceptance criteria:
  - [ ] 1. Structured logs with request correlation id
  - [ ] 2. Operational dashboard for portal APIs

### [ ] `TKT-6005`: UAT with real customers
- Description: pilot feedback cycle.
- Acceptance criteria:
  - [ ] 1. Minimum 5 pilot users
  - [ ] 2. Top issues triaged and backlog updated

### [ ] `TKT-6006`: Go-live checklist
- Description: launch/rollback/support runbook.
- Acceptance criteria:
  - [ ] 1. Rollback plan tested
  - [ ] 2. Support procedure published

---

## Sprint 7: Launch and Optimization
Goal: stable rollout and measurable outcomes.

### [ ] `TKT-7001`: Controlled soft launch
- Description: phased release with feature flags.
- Acceptance criteria:
  - [ ] 1. Small cohort rollout first
  - [ ] 2. No Sev-1 incidents in first 7 days

### [ ] `TKT-7002`: KPI dashboard
- Description: adoption and service conversion tracking.
- KPIs:
  - [ ] login rate
  - [ ] snag view rate
  - [ ] request conversion
  - [ ] request completion cycle time
- Acceptance criteria:
  - [ ] 1. Weekly KPI visibility for leadership
  - [ ] 2. Export/report process in place

### [ ] `TKT-7003`: V2 backlog prioritization
- Description: next-quarter roadmap based on data.
- Acceptance criteria:
  - [ ] 1. Ranked backlog with ROI estimate
  - [ ] 2. Top 10 enhancements approved

---

## Reuse Map (Quick Reference)

- Existing schema baseline:
  - [ ] `supabase/migrations/20250922124500_nhome_schema.sql`
- Apartment client metadata:
  - [ ] `20251021160500_add_client_and_building_fields_to_apartments.sql`
- Follow-up fields:
  - [ ] `20251018190500_add_follow_up_columns_to_inspection_results.sql`
- Existing apartments API patterns:
  - [ ] `src/app/api/nhome/apartments/route.ts`
  - [ ] `src/app/api/nhome/apartments/list/route.ts`
- Existing report/session patterns:
  - [ ] `src/app/api/nhome/inspections/save-reports/route.ts`
  - [ ] `src/app/api/nhome/inspections/[sessionId]/report-data/route.ts`
- Existing auth/middleware patterns:
  - [ ] `src/hooks/useAuthUser.ts`
  - [ ] `middleware.ts`
