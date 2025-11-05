# Inspection Data Flow & Status Usage Documentation

**Version:** 1.0
**Last Updated:** 2025-01-04
**Purpose:** Document how checklist items and inspection results are fetched, merged, and displayed, and catalog every component that depends on `inspection_results.status` or `inspection_sessions.current_item_index`.

---

## Table of Contents

1. [Data Model Overview](#data-model-overview)
2. [Hook Load Sequence](#hook-load-sequence)
3. [Status Enum Values](#status-enum-values)
4. [Consumers of `current_item_index`](#consumers-of-current_item_index)
5. [Consumers of `status` Field](#consumers-of-status-field)
6. [Report & Webhook Coupling](#report--webhook-coupling)
7. [Known Dependencies Summary](#known-dependencies-summary)

---

## Data Model Overview

### Database Tables

#### `inspection_sessions`
- **Primary status field**: `status` (text, default: `'in_progress'`)
- **Valid values** (inferred from codebase):
  - `'in_progress'` - Inspection is actively being conducted
  - `'completed'` - All checklist items have been inspected
  - `'pending'` - Session created but not started (less common)
- **Index field**: `current_item_index` (integer, default: 0)
  - 0-indexed pointer to the current checklist item
  - Incremented as inspector progresses through checklist
- **Other fields**: `started_at`, `completed_at`, `nhome_quality_score`, `inspector_id`, `apartment_id`

#### `inspection_results`
- **Primary status field**: `status` (text with CHECK constraint)
- **Valid values** (enforced by database constraint):
  - `'good'` - Item meets NHome standards
  - `'issue'` - Item has a problem that needs attention
  - `'critical'` - Item has a critical/urgent problem
- **Other fields**: `notes`, `enhanced_notes`, `photo_urls`, `priority_level`, `item_id`, `session_id`

#### `checklist_templates`
- Template definitions for inspection items
- Grouped by `apartment_type` (T2, T2+1, T3, T3+1)
- Ordered by `order_sequence`

---

## Hook Load Sequence

### `useNHomeInspectionSession(sessionId: string)`

**Location**: [`src/hooks/useNHomeInspectionSession.ts`](../src/hooks/useNHomeInspectionSession.ts)

#### Load Sequence (lines 13-121)

1. **Fetch Inspection Session** (lines 18-22)
   ```typescript
   const { data: sessionData } = await supabase
     .from('inspection_sessions')
     .select('*, apartments:apartment_id (*, projects (*))')
     .eq('id', sessionId)
     .single()
   ```
   - Retrieves session with nested apartment and project data
   - Includes `status`, `current_item_index`, `nhome_quality_score`

2. **Fetch Checklist Templates** (lines 67-71)
   ```typescript
   const { data: checklist } = await supabase
     .from('checklist_templates')
     .select('*')
     .eq('apartment_type', sessionData?.apartments?.apartment_type)
     .order('order_sequence')
   ```
   - Gets ordered checklist for apartment type
   - Used to determine total item count

3. **Fetch Inspection Results** (lines 89-92)
   ```typescript
   const { data: results } = await supabase
     .from('inspection_results')
     .select('*')
     .eq('session_id', sessionId)
   ```
   - Gets all results (completed items) for this session
   - Each result has `status: 'good' | 'issue' | 'critical'`

4. **Merge and Enhance Data** (line 102)
   ```typescript
   const enhanced = {
     ...sessionData,
     checklist_items: checklist ?? [],
     results: results ?? [],
     apartment: sessionData?.apartments,
     project: sessionData?.apartments?.projects
   }
   ```

5. **Calculate Derived Fields** (lines 105-109)
   ```typescript
   const completed = results?.length ?? 0
   const total = checklist?.length ?? 0
   const issues_found = results.filter(r => r.status === 'issue').length
   const quality_score = calculateScore(results ?? [])
   ```
   - **completed**: Count of inspection_results rows
   - **total**: Count of checklist_templates rows
   - **issues_found**: Count where `status === 'issue'`
   - **quality_score**: Calculated from good/issue/critical counts (lines 123-131)

6. **Set Current Item** (lines 111-112)
   ```typescript
   const idx = sessionData?.current_item_index ?? 0
   setCurrentItem(checklist?.[idx])
   ```
   - Uses `current_item_index` to retrieve the active checklist item
   - If `idx >= checklist.length`, `currentItem` becomes `undefined`

#### Exported Values
```typescript
return {
  session,           // Enhanced session with nested data
  currentItem,       // Current checklist item (based on current_item_index)
  loading,           // Boolean loading state
  nhomeProgress,     // { completed, total, issues_found, quality_score }
  saveNHomeResult,   // Function to save a result and optionally advance
  reload: load       // Function to refresh data
}
```

#### Quality Score Calculation (lines 123-131)
```typescript
function calculateScore(results: any[]): number {
  if (results.length === 0) return 0
  const total = results.length
  const issue = results.filter(r => r.status === 'issue').length
  const critical = results.filter(r => r.status === 'critical').length
  const base = ((total - issue) / total) * 10
  const penalty = critical * 2
  return Math.max(1, Math.round((base - penalty) * 10) / 10)
}
```
- Base score: proportion of non-issue items * 10
- Penalty: 2 points per critical item
- Clamped to minimum of 1

---

## Status Enum Values

### `inspection_results.status`

**Database Constraint** (line 82 in schema):
```sql
status text check (status in ('good', 'issue', 'critical')) not null
```

**Values:**
- `'good'` - Item passes inspection
- `'issue'` - Item has a non-critical defect
- `'critical'` - Item has a critical/urgent defect

### `inspection_sessions.status`

**Database Definition** (line 70 in schema):
```sql
status text default 'in_progress'
```

**Values** (inferred from usage):
- `'in_progress'` - Active inspection
- `'completed'` - Inspection finished (all items checked)
- `'pending'` - Session created but not started (rare)

**Transition Logic** (lines 189-197 in hook):
```typescript
if (totalItems > 0 && nextIndex >= totalItems) {
  updates.status = 'completed'
  updates.completed_at = new Date().toISOString()
}
```
- Status changes to `'completed'` when `current_item_index` reaches or exceeds total checklist count
- `completed_at` timestamp is set

---

## Consumers of `current_item_index`

### 1. **useNHomeInspectionSession Hook**
- **File**: `src/hooks/useNHomeInspectionSession.ts`
- **Lines**: 111-112, 183-197
- **Usage**:
  - **Read**: Gets current checklist item: `checklist?.[sessionData?.current_item_index ?? 0]`
  - **Write**: Increments on `saveNHomeResult` when `shouldAdvance=true`
  - **Completion check**: Sets `status='completed'` when `nextIndex >= totalItems`

### 2. **NHomeVoiceInspection Component**
- **File**: `src/components/inspection/NHomeVoiceInspection.tsx`
- **Lines**: 135, 140-164
- **Usage**:
  - **Read**: `const currentIndex = session?.current_item_index ?? 0`
  - **Display**: Progress bar calculation (line 879): `(currentIndex + 1) / (nhomeProgress.total || 1) * 100`
  - **Write**: `goToNext()` and `goToPrevious()` manually update index
  - **Completion check**: When navigating next, checks if inspection should be marked complete

### 3. **Migration: Fix Completed Sessions**
- **File**: `supabase/migrations/20251103000000_fix_completed_inspections.sql`
- **Usage**: Identifies sessions where `current_item_index >= total_items` and marks them as completed

### 4. **API Route: Fix Completed Sessions**
- **File**: `src/app/api/nhome/fix-completed-sessions/route.ts`
- **Lines**: Throughout
- **Usage**: One-time fix to mark sessions as completed if `current_item_index >= totalItems`

### 5. **Diagnostics API**
- **File**: `src/app/api/nhome/diagnostics/[sessionId]/route.ts`
- **Usage**: Returns `current_item_index` for debugging/monitoring

### 6. **Server State Management**
- **File**: `src/lib/server/nhome-inspection-state.ts`
- **Lines**: 52-56
- **Usage**: `moveToNextItem()` function updates `current_item_index` (though this function may be deprecated)

---

## Consumers of `status` Field

### Components

#### 1. **NHomeVoiceInspection**
- **File**: `src/components/inspection/NHomeVoiceInspection.tsx`
- **Lines**: 97-101, 739, 781-813
- **Usage**:
  - **Status Display**: Shows completion screen when `session?.status === 'completed'`
  - **Button Handlers**: Sets `status` when saving results ('good', 'issue', 'critical')
  - **Conditional Rendering**: Different UI for completed vs in-progress

#### 2. **Dashboard Page**
- **File**: `src/app/dashboard/page.tsx`
- **Lines**: 77-78
- **Usage**:
  - **Filtering**: Splits sessions into lists
    ```typescript
    inProgress = enriched.filter(s => s.status === 'in_progress')
    followUpInspections = enriched.filter(s => s.status === 'completed')
    ```
  - **Display**: Shows in-progress and completed inspections in separate sections

#### 3. **Report Templates (English & Portuguese)**
- **Files**:
  - `src/components/reports/NHomeReportTemplateEN.tsx`
  - `src/components/reports/NHomeReportTemplatePT.tsx`
- **Lines**: 97-119 (EN), 113-139 (PT)
- **Usage**:
  - **Conditional Formatting**:
    ```typescript
    {it.status === 'good' ? (
      <Text>{item} - Good</Text>
    ) : (
      <Text>{item} - {status === 'critical' ? 'Critical' : 'Issue'}</Text>
      {it.notes && <Text>Notes: {it.notes}</Text>}
      {it.photo_urls && <Images />}
    )}
    ```
  - **Good items**: Display only "Item - Good" (no notes, no photos)
  - **Issue/Critical items**: Display status, notes, and photos

#### 4. **NHomeFollowUpInspection**
- **File**: `src/components/inspection/NHomeFollowUpInspection.tsx`
- **Usage**: Filters results by status to show only items needing follow-up

#### 5. **StartInspectionCard**
- **File**: `src/components/dashboard/StartInspectionCard.tsx`
- **Usage**: Checks session status for UI state

#### 6. **NHomeInspectionStart**
- **File**: `src/components/inspection/NHomeInspectionStart.tsx`
- **Usage**: Initializes new inspection with `status: 'in_progress'`

### API Routes

#### 7. **Create Inspection API**
- **File**: `src/app/api/nhome/inspections/create/route.ts`
- **Lines**: 24
- **Usage**: Creates session with initial status
  ```typescript
  .insert([{ apartment_id, status: "in_progress", started_at: new Date() }])
  ```

#### 8. **Follow-up List API**
- **File**: `src/app/api/nhome/inspections/follow-up-list/route.ts`
- **Lines**: 41-42
- **Usage**:
  - **Query**: Filters for completed sessions with outstanding issues
    ```typescript
    .eq("status", "completed")
    .or("inspection_results.status.eq.issue,inspection_results.status.eq.critical")
    ```

#### 9. **Fix Completed Sessions API**
- **File**: `src/app/api/nhome/fix-completed-sessions/route.ts`
- **Usage**: Updates `status` from 'in_progress' to 'completed' for sessions where all items are done

### Database & Migrations

#### 10. **Schema Definition**
- **File**: `supabase/migrations/20250922124500_nhome_schema.sql`
- **Lines**: 70, 82
- **Usage**:
  - `inspection_sessions.status` definition with default
  - `inspection_results.status` with CHECK constraint

#### 11. **Fix Completed Inspections Migration**
- **File**: `supabase/migrations/20251103000000_fix_completed_inspections.sql`
- **Usage**: Updates session status based on `current_item_index` vs total items

### Services

#### 12. **Report Generation Service**
- **File**: `src/services/nhomeReportGenerationService.tsx`
- **Usage**: Reads `status` from results to format report content

#### 13. **Server Inspection State**
- **File**: `src/lib/server/nhome-inspection-state.ts`
- **Lines**: 64-72, 78-88
- **Usage**: Functions to mark items as good/issue with status updates

---

## Report & Webhook Coupling

### Report Generation Dependencies

#### English Report Template
- **File**: `src/components/reports/NHomeReportTemplateEN.tsx`
- **Status Dependencies**:
  - Good items: Shows `"Item - Good"` only
  - Issue items: Shows `"Item - Issue"` + notes + photos
  - Critical items: Shows `"Item - Critical"` + notes + photos
- **Logic**: Lines 97-119
- **Impact**: Report formatting is tightly coupled to 3-value enum

#### Portuguese Report Template
- **File**: `src/components/reports/NHomeReportTemplatePT.tsx`
- **Status Dependencies**:
  - Good items: Shows `"Item - Bom"` only
  - Issue items: Shows `"Item - Problema"` + observações + fotos
  - Critical items: Shows `"Item - Crítico"` + observações + fotos
- **Logic**: Lines 113-139
- **Translation Map**: `good → Bom`, `issue → Problema`, `critical → Crítico`
- **Impact**: Portuguese translations depend on exact status values

### Quality Score Calculation
- **Location**: `src/hooks/useNHomeInspectionSession.ts:123-131`
- **Dependencies**:
  - Filters `status === 'issue'` for issue count
  - Filters `status === 'critical'` for penalty calculation
  - Formula: `base = ((total - issues) / total) * 10 - (critical * 2)`
- **Impact**: Score calculation breaks if status values change

### Dashboard Filtering
- **Location**: `src/app/dashboard/page.tsx:77-78`
- **Dependencies**:
  - `status === 'in_progress'` for active inspections
  - `status === 'completed'` for follow-up list
- **Impact**: Dashboard sections rely on exact string matches

### Follow-up System
- **Location**: `src/app/api/nhome/inspections/follow-up-list/route.ts:41-42`
- **Dependencies**:
  - Queries where `inspection_results.status = 'issue'` OR `'critical'`
  - Only completed sessions: `inspection_sessions.status = 'completed'`
- **Impact**: Follow-up workflow requires both status fields

---

## Known Dependencies Summary

### Critical Dependencies (Breaking Changes)

#### `inspection_results.status` ('good' | 'issue' | 'critical')
1. **Database constraint** - Enforced at DB level
2. **Report templates** - Hard-coded conditionals in EN/PT templates
3. **Quality score calculation** - Filters by exact strings
4. **Follow-up queries** - SQL WHERE clauses
5. **Hook calculations** - `issues_found` count

**Change Impact**: High - Requires DB migration, report updates, query changes

#### `inspection_sessions.status` ('in_progress' | 'completed' | 'pending')
1. **Dashboard filtering** - String comparison for lists
2. **Completion logic** - Triggers `completed_at` timestamp
3. **Report generation** - May check status before generating
4. **Follow-up system** - Only queries completed sessions

**Change Impact**: High - Requires multi-file updates

#### `inspection_sessions.current_item_index`
1. **Current item lookup** - Array index for checklist
2. **Progress calculation** - Used in UI progress bars
3. **Completion detection** - Compared to total item count
4. **Navigation** - Incremented/decremented by prev/next buttons

**Change Impact**: High - Core to inspection navigation flow

### Non-Breaking Dependencies (Safe to Extend)

- Adding new apartment types (T4, etc.) - Template-based, no code changes
- Adding new checklist items - Dynamic queries, no hard-coding
- Adding fields to `inspection_results` (e.g., `estimated_cost`) - Optional fields

---

## File Reference Index

### Hook & State Management
- `src/hooks/useNHomeInspectionSession.ts` - Main data hook
- `src/lib/server/nhome-inspection-state.ts` - Server-side state functions

### Components
- `src/components/inspection/NHomeVoiceInspection.tsx` - Main inspection UI
- `src/components/inspection/NHomeFollowUpInspection.tsx` - Follow-up workflow
- `src/components/inspection/NHomeInspectionStart.tsx` - Session creation
- `src/components/dashboard/StartInspectionCard.tsx` - Dashboard card
- `src/components/reports/NHomeReportTemplateEN.tsx` - English PDF report
- `src/components/reports/NHomeReportTemplatePT.tsx` - Portuguese PDF report

### API Routes
- `src/app/api/nhome/inspections/create/route.ts` - Create session
- `src/app/api/nhome/inspections/follow-up-list/route.ts` - Query follow-ups
- `src/app/api/nhome/fix-completed-sessions/route.ts` - Fix incomplete sessions
- `src/app/api/nhome/diagnostics/[sessionId]/route.ts` - Debug endpoint

### Database
- `supabase/migrations/20250922124500_nhome_schema.sql` - Schema definitions
- `supabase/migrations/20251103000000_fix_completed_inspections.sql` - Status fix migration

### Pages
- `src/app/dashboard/page.tsx` - Dashboard with session lists
- `src/app/inspection/nhome/[sessionId]/page.tsx` - Inspection page wrapper

---

## Change Risk Assessment

### Adding a Fourth Status (e.g., 'pending-review')

**Required Changes:**
1. Database: Alter CHECK constraint in `inspection_results.status`
2. Hook: Update `calculateScore()` logic
3. Reports: Add conditional rendering for new status in EN/PT templates
4. Follow-up: Update queries to include/exclude new status
5. TypeScript: Update type definitions

**Estimated Files**: 8-10 files
**Risk**: High (breaking changes across stack)

### Adding a New Session Status (e.g., 'on-hold')

**Required Changes:**
1. Dashboard: Update filtering logic
2. Hook: Update completion detection if needed
3. UI: Handle new status in display components

**Estimated Files**: 3-5 files
**Risk**: Medium (isolated to session management)

### Changing `current_item_index` to 1-indexed

**Required Changes:**
1. Hook: Adjust all index calculations
2. Components: Update progress displays
3. Completion logic: Update comparison (`>` vs `>=`)
4. Database: Migrate existing data

**Estimated Files**: 6-8 files
**Risk**: High (affects core navigation)

---

## Recommendations for Future Refactoring

1. **Status Enum Constants**: Define status values in a central constants file
   ```typescript
   // src/constants/inspection-status.ts
   export const INSPECTION_RESULT_STATUS = {
     GOOD: 'good',
     ISSUE: 'issue',
     CRITICAL: 'critical'
   } as const
   ```

2. **Type Safety**: Use TypeScript enums or const assertions
   ```typescript
   type InspectionResultStatus = 'good' | 'issue' | 'critical'
   type InspectionSessionStatus = 'in_progress' | 'completed' | 'pending'
   ```

3. **Centralized Queries**: Create a data service layer to encapsulate status queries

4. **Status Utility Functions**: Helper functions for status checks
   ```typescript
   function isCompletedSession(status: string): boolean {
     return status === 'completed'
   }
   ```

5. **Migration Strategy**: Document status changes in ADRs (Architecture Decision Records)

---

## Grep Commands for Verification

```bash
# Find all status comparisons
rg "\.status\s*===|status\s*in\s*\(|status:\s*['\"]" --type ts --type tsx

# Find all current_item_index usage
rg "current_item_index" --type ts --type tsx

# Find database status constraints
rg "status.*check|status.*enum" supabase/migrations/

# Find hook consumers
rg "useNHomeInspectionSession" src/

# Find quality score calculations
rg "calculateScore|quality_score" src/
```

---

**Document Maintenance:**
- Update this document when adding new status values
- Update when refactoring data flow
- Review quarterly for accuracy
- Version in git with inspection system code

**Last Reviewed By:** Claude (Assistant)
**Next Review:** When adding new inspection features or status values
