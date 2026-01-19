# Photo Backfill Summary - Session 5b6acc70-442d-4525-b22a-3c6c32ec1281

**Date:** 2026-01-15
**Issue:** Photos exist in Supabase storage but aren't appearing in reports
**Status:** ✅ RESOLVED

---

## Problem Diagnosis

### Symptoms
- 24 photos successfully uploaded to Supabase storage bucket `nhome_photos`
- Photos exist at path: `sessions/5b6acc70-442d-4525-b22a-3c6c32ec1281/`
- Report-data API shows: "Found 0 persisted photos for session"
- Reports generated without any photos despite visual evidence of uploads

### Root Cause
The photos were uploaded to the **storage bucket** but never persisted to the **`nhome_photos` database table**. This created a disconnect between what exists in storage and what the report generation system can access.

#### Why did this happen?
The photos were uploaded **before** recent fixes to the photo upload flow. The upload process at the time:

1. ✅ Successfully uploaded file to storage bucket
2. ❌ Failed to persist metadata to `nhome_photos` table
3. ❌ No error handling/retry mechanism to catch this failure

This meant that:
- Files physically existed in storage
- The database had **zero records** linking these files to inspection results
- The report generation API queries the database (not storage directly)
- Result: Photos invisible to reports

---

## Investigation Results

### Database Queries Run

**1. Check `nhome_photos` table for session:**
```sql
SELECT * FROM nhome_photos
WHERE session_id = '5b6acc70-442d-4525-b22a-3c6c32ec1281';
```
**Result:** 0 rows (before backfill)

**2. Check `inspection_results` for session:**
```sql
SELECT id, item_id, photo_urls
FROM inspection_results
WHERE session_id = '5b6acc70-442d-4525-b22a-3c6c32ec1281';
```
**Result:** 115 rows, but all with `photo_urls = null` or `[]`

**3. Check storage bucket:**
```typescript
await supabase.storage
  .from('nhome_photos')
  .list('sessions/5b6acc70-442d-4525-b22a-3c6c32ec1281');
```
**Result:** 24 files found ✅

### The Disconnect
- **Storage:** 24 photos ✅
- **Database:** 0 records ❌
- **Reports:** "No photos found" ❌

---

## Solution Implemented

### Backfill Script: `backfill-photos-from-storage.ts`

Created a comprehensive backfill script that:

1. **Lists files from storage** for the target session
2. **Parses filenames** to extract metadata:
   - Room name (e.g., "Living Room", "Kitchen", "Balcony")
   - Item description (e.g., "walls", "ceiling", "floor skirting")
   - Timestamp
3. **Matches photos to checklist items** using intelligent fuzzy matching:
   - Normalizes descriptions (handles "floor & skirting" vs "floor skirting")
   - Multi-strategy matching (exact match → word overlap → fuzzy match)
   - Accounts for variations in room/item naming
4. **Inserts records into `nhome_photos` table** with:
   - Correct `session_id`
   - Matched `item_id` (links to checklist_templates)
   - Storage path (`supabase_url`)
   - Metadata (room, item, backfill timestamp)
   - File size and creation timestamp

### Filename Parsing Logic

The script handles two filename formats:

**Format 1: Triple underscore separator**
```
NHome_Dona_Ana_Beach_residences_5_2A_Balcony___Pool_side_walls_tiles_2026-01-12T22-56-48-958Z.jpg
                                        ↑        ↑           ↑
                                      Room      ___        Item
```

**Format 2: Single underscores**
```
NHome_Dona_Ana_Beach_residences_5_2A_Kitchen_floor_skirting_2026-01-12T22-34-22-361Z.jpg
                                        ↑      ↑           ↑
                                      Room   Item    Timestamp
```

### Matching Success Rate

**Final results:**
- 24 photos processed
- **24 successfully matched** to checklist items (100% success rate)
- 0 unmatched photos

**Matching strategies used:**
1. Exact room + item match (normalized)
2. Room match + word overlap in item description
3. Fuzzy match on item description only (fallback)

### Execution

```bash
# Dry run (preview changes)
npx tsx backfill-photos-from-storage.ts

# Execute (insert into database)
npx tsx backfill-photos-from-storage.ts --execute
```

---

## Verification

### Before Backfill
```
Photos in nhome_photos: 0
Photos in storage: 24
Report shows: "Found 0 persisted photos"
```

### After Backfill
```
Photos in nhome_photos: 24 ✅
Photos in storage: 24 ✅
All 24 photos linked to correct checklist items ✅
```

### Database State
All 24 photos now have entries in `nhome_photos` table with:
- Valid `session_id`: `5b6acc70-442d-4525-b22a-3c6c32ec1281`
- Valid `item_id`: Correctly matched to checklist_templates
- Storage path: `sessions/{sessionId}/{filename}`
- Metadata: Room, item, and backfill timestamp

---

## Report Generation Impact

### How Photos Appear in Reports

The report-data API (`/api/nhome/inspections/[sessionId]/report-data`) now:

1. Queries `nhome_photos` table for all photos with matching `session_id`
2. Groups photos by `item_id` (links to inspection results)
3. Generates signed URLs for each photo (24-hour expiry)
4. Attaches photos to corresponding inspection results
5. Renders photos in the generated report

### Expected Behavior

Reports generated for session `5b6acc70-442d-4525-b22a-3c6c32ec1281` will now:
- Show all 24 photos
- Photos grouped by room and item
- Photos appear next to their corresponding inspection notes
- Signed URLs valid for 7 days (for reports) or 24 hours (for API responses)

---

## Prevention & Recommendations

### Immediate Actions Taken

1. ✅ **Backfill completed** for session `5b6acc70-442d-4525-b22a-3c6c32ec1281`
2. ✅ **Script created** for backfilling other sessions if needed
3. ✅ **Documentation created** for future reference

### Recommended Future Improvements

#### 1. Enhanced Error Handling
```typescript
// In nhomePhotoUploadService.ts
async uploadNHomeInspectionPhoto(...) {
  try {
    // Upload to storage
    const uploadResult = await uploadToStorage(...);

    // CRITICAL: Persist to database
    const dbResult = await persistToDatabase(...);

    if (!dbResult.success) {
      // Log error and alert
      console.error('Database persistence failed after storage upload');
      // Could trigger retry or notification
    }
  } catch (error) {
    // Rollback storage upload if database fails?
    // Or queue for retry?
  }
}
```

#### 2. Automated Consistency Checks
Create a scheduled job to detect orphaned photos:
```typescript
// Check for photos in storage without database records
async function detectOrphanedPhotos() {
  // For each session:
  // - List storage files
  // - Query database records
  // - Report discrepancies
  // - Optional: Auto-trigger backfill
}
```

#### 3. Transactional Upload Pattern
Consider implementing a two-phase commit:
```typescript
// Phase 1: Create database record with status='pending'
// Phase 2: Upload to storage
// Phase 3: Update database record to status='complete'
// Cleanup: Periodically remove pending records that never completed
```

#### 4. Monitoring & Alerts
- Add metric tracking for upload success/failure rates
- Alert when storage/database counts diverge
- Dashboard showing upload health metrics

#### 5. Testing Improvements
- Add integration tests that verify end-to-end upload flow
- Test failure scenarios (storage succeeds, database fails)
- Test consistency checks and backfill scripts

---

## Additional Sessions to Check

To check if other sessions have the same issue, run:

```bash
npx tsx check-photos-final.ts
# Modify script to check multiple sessions
```

Look for sessions where:
- `storage_files.count > 0`
- `nhome_photos.count === 0`
- These indicate orphaned photos needing backfill

---

## Files Created/Modified

### New Files
- `backfill-photos-from-storage.ts` - Backfill script
- `check-storage.ts` - Storage inspection utility
- `check-photos-final.ts` - Database verification utility
- `diagnose_photos.sql` - SQL diagnostic queries
- `docs/photo-backfill-summary.md` - This document

### No Modifications Required
The existing upload flow has been fixed in recent updates, so no code changes were needed. This was purely a data backfill issue for photos uploaded before the fixes.

---

## Conclusion

The issue was successfully resolved by backfilling the `nhome_photos` table with records for all 24 photos that existed in storage but had no database entries. All photos are now correctly linked to their inspection results and will appear in generated reports.

The root cause was a gap in the upload flow where storage uploads succeeded but database persistence failed silently. Recent fixes to the upload flow should prevent this from happening again, but implementing the recommended monitoring and consistency checks would provide additional safeguards.
