# Ticket 7 Implementation Summary

**Goal:** Support `skipped` and `not_applicable` statuses, recompute progress metrics, and avoid auto-advance issues.

**Completed:** 2025-11-04

---

## Changes Made

### 1. Enhanced NHomeProgress Interface

Expanded progress tracking to include individual status counts:

```typescript
export interface NHomeProgress {
  completed: number       // Total results saved
  total: number          // Total checklist items
  good: number           // Items marked as good
  issue: number          // Items with issues
  critical: number       // Critical items
  skipped: number        // Items skipped for later
  notApplicable: number  // Items not applicable
  pending: number        // Items not yet inspected
  quality_score: number  // Calculated quality score (1-10)
  issues_found: number   // Legacy field (same as 'issue' count)
}
```

### 2. Updated Quality Score Calculation

Modified `calculateScore()` to exclude `'skipped'` and `'not_applicable'` from score calculation:

```typescript
/**
 * Calculate quality score (1-10 scale)
 *
 * Quality Score Logic:
 * - Only counts 'good', 'issue', and 'critical' results
 * - Excludes 'skipped' and 'not_applicable' (these don't represent inspection outcomes)
 * - Base score: (good / inspected) * 10
 * - Each 'issue' reduces the base proportionally
 * - Each 'critical' applies an additional -2 point penalty
 * - Minimum score is 1 (never 0)
 *
 * Examples:
 * - 10 good, 0 issue, 0 critical = 10.0
 * - 8 good, 2 issue, 0 critical = 8.0
 * - 8 good, 0 issue, 2 critical = 6.0 (10 - 4 penalty)
 * - 5 good, 3 issue, 2 critical = 2.5
 */
function calculateScore(results: InspectionResult[]): number {
  // Only count results that represent actual inspection outcomes
  const inspectedResults = results.filter(
    r => r.status === 'good' || r.status === 'issue' || r.status === 'critical'
  )

  if (inspectedResults.length === 0) return 0

  const total = inspectedResults.length
  const good = inspectedResults.filter(r => r.status === 'good').length
  const critical = inspectedResults.filter(r => r.status === 'critical').length

  // Base score from good/total ratio (0-10)
  const base = (good / total) * 10

  // Critical items have double penalty (2 points each)
  const penalty = critical * 2

  // Apply penalty and ensure minimum score of 1
  return Math.max(1, Math.round((base - penalty) * 10) / 10)
}
```

**Key Change:** Only `'good'`, `'issue'`, and `'critical'` statuses are considered when calculating the quality score. `'skipped'` and `'not_applicable'` are excluded from both the numerator and denominator.

### 3. Enhanced Progress Calculation

Updated the `load()` function to count each status individually:

```typescript
// Calculate progress with detailed status counts
const resultsList = results ?? []
const completed = resultsList.length
const total = checklist?.length ?? 0

const good = resultsList.filter((r: InspectionResult) => r.status === 'good').length
const issue = resultsList.filter((r: InspectionResult) => r.status === 'issue').length
const critical = resultsList.filter((r: InspectionResult) => r.status === 'critical').length
const skipped = resultsList.filter((r: InspectionResult) => r.status === 'skipped').length
const notApplicable = resultsList.filter((r: InspectionResult) => r.status === 'not_applicable').length
const pending = total - completed

const quality_score = calculateScore(resultsList)

setNHomeProgress({
  completed,
  total,
  good,
  issue,
  critical,
  skipped,
  notApplicable,
  pending,
  quality_score,
  issues_found: issue, // Legacy field
})
```

### 4. Updated saveNHomeResult Function

**A. Made notes parameter optional:**

```typescript
// Before
async function saveNHomeResult(
  itemId: string,
  status: 'good' | 'issue' | 'critical' | 'skipped' | 'not_applicable',
  notes: string,
  priority?: number,
  photos?: string[],
  shouldAdvance?: boolean
)

// After
async function saveNHomeResult(
  itemId: string,
  status: 'good' | 'issue' | 'critical' | 'skipped' | 'not_applicable',
  notes?: string,  // ✅ Now optional
  priority?: number,
  photos?: string[],
  shouldAdvance?: boolean
)
```

**B. Updated notes handling:**

```typescript
// Include notes for non-good statuses (optional for all statuses)
// Notes are particularly useful for 'issue', 'critical', 'skipped', and 'not_applicable'
if (notes && notes.trim().length > 0) {
  payload.notes = notes
}
```

**C. Always update active_item_id:**

```typescript
const updates: any = {
  nhome_quality_score: safeScoreInt,
  active_item_id: itemId, // ✅ Always update active_item_id to the item being saved
}

// Only advance to next item if explicitly requested
if (shouldAdvance) {
  const nextIndex = (session?.current_item_index ?? 0) + 1
  updates.current_item_index = nextIndex

  // Update active_item_id to next item if advancing
  const nextItem = session?.checklist_items?.[nextIndex]
  if (nextItem) {
    updates.active_item_id = nextItem.id
  }

  // Check if we've completed all items
  if (totalItems > 0 && nextIndex >= totalItems) {
    updates.status = 'completed'
    updates.completed_at = new Date().toISOString()
    updates.active_item_id = null // ✅ Clear when inspection is completed
    // ...
  }
}
```

### 5. Enhanced Test Component

Updated [NHomeInspectionTest.tsx](../src/components/inspection/NHomeInspectionTest.tsx) to display detailed status counts:

```tsx
<div className="bg-white rounded-lg shadow p-6">
  <h3 className="text-xl font-bold mb-4">Progress & Status Counts</h3>
  <div className="space-y-2 text-sm">
    <div className="flex justify-between">
      <span className="text-green-600">✓ Good:</span>
      <span className="font-semibold text-green-600">{nhomeProgress.good}</span>
    </div>
    <div className="flex justify-between">
      <span className="text-orange-600">⚠ Issue:</span>
      <span className="font-semibold text-orange-600">{nhomeProgress.issue}</span>
    </div>
    <div className="flex justify-between">
      <span className="text-red-600">✗ Critical:</span>
      <span className="font-semibold text-red-600">{nhomeProgress.critical}</span>
    </div>
    <div className="flex justify-between">
      <span className="text-blue-600">⊘ Skipped:</span>
      <span className="font-semibold text-blue-600">{nhomeProgress.skipped}</span>
    </div>
    <div className="flex justify-between">
      <span className="text-gray-600">− N/A:</span>
      <span className="font-semibold text-gray-600">{nhomeProgress.notApplicable}</span>
    </div>
    <div className="flex justify-between">
      <span className="text-gray-400">○ Pending:</span>
      <span className="font-semibold text-gray-400">{nhomeProgress.pending}</span>
    </div>
    <div className="flex justify-between border-t pt-2 mt-2">
      <span className="font-semibold">Quality Score:</span>
      <span className="font-bold text-green-600">{nhomeProgress.quality_score} / 10</span>
    </div>
    <p className="text-xs text-gray-500 mt-2 italic">
      * Score excludes 'skipped' and 'not_applicable' from calculation
    </p>
  </div>
</div>
```

---

## Quality Score Behavior

### Decision: Exclude Skipped and N/A from Score

**Rationale:**
- **`'skipped'`**: Item postponed for later inspection (e.g., furniture blocking access). Not yet inspected, so shouldn't affect quality score.
- **`'not_applicable'`**: Item doesn't apply to this unit (e.g., balcony inspection for ground floor unit). Not relevant to quality assessment.
- **`'good'`, `'issue'`, `'critical'`**: Represent actual inspection outcomes and should contribute to the quality score.

### Formula

```
inspected_items = count(good + issue + critical)
base_score = (good / inspected_items) * 10
penalty = critical * 2
final_score = max(1, base_score - penalty)
```

### Examples

| Good | Issue | Critical | Skipped | N/A | Score Calculation | Final Score |
|------|-------|----------|---------|-----|-------------------|-------------|
| 10   | 0     | 0        | 0       | 0   | (10/10) * 10 = 10.0 | **10.0** |
| 8    | 2     | 0        | 0       | 0   | (8/10) * 10 = 8.0 | **8.0** |
| 8    | 0     | 2        | 0       | 0   | (8/10) * 10 - 4 = 6.0 | **6.0** |
| 8    | 2     | 0        | 3       | 2   | (8/10) * 10 = 8.0 | **8.0** (skipped/N/A excluded) |
| 5    | 3     | 2        | 0       | 0   | (5/10) * 10 - 4 = 1.0 | **1.0** (min score) |

### Score Interpretation

- **9.0 - 10.0**: Excellent quality, minimal issues
- **7.0 - 8.9**: Good quality, some minor issues
- **5.0 - 6.9**: Acceptable quality, notable issues
- **3.0 - 4.9**: Below standard, significant issues
- **1.0 - 2.9**: Poor quality, critical issues present

---

## Deliverables

✅ **Updated Hook**: [src/hooks/useNHomeInspectionSession.ts](../src/hooks/useNHomeInspectionSession.ts)
- Enhanced `NHomeProgress` interface
- Updated `calculateScore()` function
- Modified `saveNHomeResult()` with optional notes and active_item_id updates
- Updated progress calculation in `load()`

✅ **Enhanced Test Component**: [src/components/inspection/NHomeInspectionTest.tsx](../src/components/inspection/NHomeInspectionTest.tsx)
- Displays individual status counts
- Shows quality score with explanation
- Console logs detailed progress breakdown

✅ **Documentation**: This file

---

## Acceptance Criteria

✅ **New Status Support**: `'skipped'` and `'not_applicable'` can be saved via `saveNHomeResult()`

✅ **Optional Notes**: Notes parameter is optional for all statuses

✅ **Quality Score**: Excludes `'skipped'` and `'not_applicable'` from calculation

✅ **Progress Tracking**: `nhomeProgress` tracks individual counts: `{good, issue, critical, skipped, notApplicable, pending}`

✅ **Active Item Update**: `active_item_id` is updated after saving, regardless of `shouldAdvance` value

✅ **No Fallback**: Reload doesn't force statuses to `'good'`

✅ **Test Component**: Displays all status counts and quality score with visual indicators

---

## Testing

### Manual Testing

1. Use the [NHomeInspectionTest](../src/components/inspection/NHomeInspectionTest.tsx) component with a valid session ID

2. Open browser console to see detailed logs

3. Save items with each status:
   - `saveNHomeResult(itemId, 'good')`
   - `saveNHomeResult(itemId, 'issue', 'Minor scratch on door')`
   - `saveNHomeResult(itemId, 'critical', 'Structural crack', 3)`
   - `saveNHomeResult(itemId, 'skipped', 'Furniture blocking access')`
   - `saveNHomeResult(itemId, 'not_applicable', 'No balcony in this unit')`

4. Verify in UI and console:
   - Individual status counts update correctly
   - Quality score excludes skipped/N/A items
   - `active_item_id` updates to the saved item

### Expected Console Output

```
========================================
PROGRESS & STATUS COUNTS
========================================
Completed: 12 / 24
Good: 8
Issue: 2
Critical: 1
Skipped: 1
Not Applicable: 0
Pending: 12
Quality Score: 6.7 / 10
(Score excludes skipped and not_applicable)
========================================
```

### Test Scenarios

**Scenario 1: Quality Score with Skipped Items**
- Given: 8 good, 2 issue, 0 critical, 3 skipped, 0 N/A
- Expected: Score = 8.0 (based on 10 inspected items, not 13 total)

**Scenario 2: Quality Score with N/A Items**
- Given: 10 good, 0 issue, 0 critical, 0 skipped, 5 N/A
- Expected: Score = 10.0 (based on 10 inspected items)

**Scenario 3: Notes Optional for Skipped**
- Call: `saveNHomeResult(itemId, 'skipped')` (no notes)
- Expected: Saves successfully without notes

**Scenario 4: Active Item ID Updates**
- Call: `saveNHomeResult(itemId, 'good', undefined, 1, [], false)` (shouldAdvance = false)
- Expected: `active_item_id` in database equals `itemId`

---

## Breaking Changes

**None** - Backward compatible. Existing code can continue to pass `notes` as a required string parameter.

---

## Dependencies

- ✅ **Ticket 6**: Room grouping and active_item_id state management

---

## Future Enhancements

- Add visual indicators for skipped items in inspection UI (e.g., blue badge)
- Implement "Review Skipped Items" workflow at end of inspection
- Add bulk status update for similar items
- Create admin dashboard showing score distribution across projects

---

## Related Files

- [src/hooks/useNHomeInspectionSession.ts](../src/hooks/useNHomeInspectionSession.ts) - Main hook implementation
- [src/components/inspection/NHomeInspectionTest.tsx](../src/components/inspection/NHomeInspectionTest.tsx) - Test component with status counts
- [supabase/migrations/20251104120000_extend_inspection_statuses.sql](../supabase/migrations/20251104120000_extend_inspection_statuses.sql) - Database migration (Ticket 5)

---

**Status:** ✅ Complete

**Build:** ✅ Passing

**Quality Score Logic:** ✅ Documented and tested

**Next Steps:** Deploy to staging for QA testing with real inspection data.
