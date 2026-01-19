# Photo Mapping Analysis & Fix

**Session ID:** `5b6acc70-442d-4525-b22a-3c6c32ec1281`
**Date:** 2026-01-15
**Issue:** Same photos appearing for different issues in PDF report

---

## Problem Summary

The user reported that the same photos are appearing for different issues in their PDF report. Investigation revealed a critical data inconsistency between two tables:

1. **`nhome_photos` table:** Contains 24 photos correctly mapped to their respective `item_id` based on file names
2. **`inspection_results` table:** Contains 50 inspection results with issues, but **ALL have empty `photo_urls` arrays**

### Root Cause

The photos were successfully uploaded to Supabase Storage and recorded in the `nhome_photos` table with correct item mappings. However, the `photo_urls` field in the `inspection_results` table was never populated. This causes:

- PDF reports either show no photos or incorrectly display photos
- Photo-to-issue mapping is lost at the report generation level
- The data exists in the database but is not properly linked

---

## Investigation Findings

### 1. Photos in `nhome_photos` Table

**Total Photos:** 24 photos across 17 unique items

**Items with Multiple Photos (7 items):**

1. **Living Room - Walls** (3 photos)
   - `NHome_Dona_Ana_Beach_residences_5_2A_Living_Room_walls_2026-01-12T22-48-26-323Z.jpg`
   - `NHome_Dona_Ana_Beach_residences_5_2A_Living_Room_walls_2026-01-12T22-48-32-527Z.jpg`
   - `NHome_Dona_Ana_Beach_residences_5_2A_Living_Room_walls_2026-01-12T22-49-39-696Z.jpg`

2. **Living Room - Ceiling** (2 photos)
   - `NHome_Dona_Ana_Beach_residences_5_2A_Living_Room_ceiling_2026-01-12T22-51-12-528Z.jpg`
   - `NHome_Dona_Ana_Beach_residences_5_2A_Living_Room_ceiling_2026-01-12T22-51-18-512Z.jpg`

3. **Balcony - Back - Walls & Tiles** (3 photos)
   - `NHome_Dona_Ana_Beach_residences_5_2A_Balcony___Pool_side_walls_tiles_2026-01-12T22-56-48-958Z.jpg`
   - `NHome_Dona_Ana_Beach_residences_5_2A_Balcony___Back_walls_tiles_2026-01-12T23-08-36-388Z.jpg`
   - `NHome_Dona_Ana_Beach_residences_5_2A_Balcony___Back_walls_tiles_2026-01-12T23-10-58-826Z.jpg`

4. **Balcony - Back - Other** (2 photos)
   - `NHome_Dona_Ana_Beach_residences_5_2A_Balcony___Pool_side_other_2026-01-12T23-03-07-375Z.jpg`
   - `NHome_Dona_Ana_Beach_residences_5_2A_Balcony___Pool_side_other_2026-01-12T23-03-13-558Z.jpg`

5. **Balcony - Back - Floor & skirting** (2 photos)
   - `NHome_Dona_Ana_Beach_residences_5_2A_Balcony___Back_floor_skirting_2026-01-12T23-15-16-112Z.jpg`
   - `NHome_Dona_Ana_Beach_residences_5_2A_Balcony___Back_floor_skirting_2026-01-12T23-15-26-427Z.jpg`

6. **Suite Bedroom - Wardrobe** (2 photos)
   - `NHome_Dona_Ana_Beach_residences_5_2A_Suite_Bedroom_wardrobe_2026-01-12T23-21-35-871Z.jpg`
   - `NHome_Dona_Ana_Beach_residences_5_2A_Suite_Bedroom_wardrobe_2026-01-12T23-21-44-046Z.jpg`

7. **Bedroom 2 - Wardrobe** (2 photos)
   - `NHome_Dona_Ana_Beach_residences_5_2A_Bedroom_2_wardrobe_2026-01-12T23-34-21-463Z.jpg`
   - `NHome_Dona_Ana_Beach_residences_5_2A_Bedroom_2_wardrobe_2026-01-12T23-34-25-228Z.jpg`

**Observation:** File names include room and item information, suggesting a backfill process correctly parsed and mapped photos based on naming convention.

### 2. Inspection Results with Issues

**Total Issues:** 50 inspection results with status `issue` or `critical`
**Issues with Photos in `photo_urls`:** 0 (NONE!)
**Issues without Photos:** 50 (ALL!)

**Sample Issues Missing Photos:**

- Bathroom 2 - Shower Cubicle (Issue)
- Balcony - Pool side - Ceiling (Issue)
- Bedroom 3 - Blinds (Issue)
- **Bathroom 2 - Walls & Tiles (Issue)** - Has 1 photo in `nhome_photos`
- Bedroom 2 - Walls (Issue) - Has 1 photo in `nhome_photos`
- Suite Bedroom - Wardrobe (Issue) - Has 2 photos in `nhome_photos`
- Bedroom 2 - Wardrobe (Issue) - Has 2 photos in `nhome_photos`

### 3. Data Mismatch

**Critical Finding:** Items with photos in `nhome_photos` table do NOT have those URLs populated in the `inspection_results.photo_urls` field.

Example:
- **Item:** Balcony - Back - Walls & Tiles
- **Photos in `nhome_photos`:** 3 photos
- **`photo_urls` in `inspection_results`:** Empty array `[]`
- **Result:** PDF report cannot display photos for this issue

---

## Technical Analysis

### Schema Context

**`nhome_photos` table:**
```sql
CREATE TABLE nhome_photos (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES inspection_sessions(id),
  item_id UUID REFERENCES checklist_templates(id),
  file_name TEXT,
  supabase_url TEXT,  -- Storage path in Supabase
  metadata JSONB,
  created_at TIMESTAMPTZ
);
```

**`inspection_results` table:**
```sql
CREATE TABLE inspection_results (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES inspection_sessions(id),
  item_id UUID REFERENCES checklist_templates(id),
  status TEXT CHECK (status IN ('good', 'issue', 'critical', 'skipped', 'not_applicable')),
  notes TEXT,
  enhanced_notes TEXT,
  photo_urls TEXT[],  -- Array of storage URLs
  created_at TIMESTAMPTZ
);
```

### Expected Behavior

When a photo is uploaded for an inspection item:
1. Photo is stored in Supabase Storage bucket
2. Record created in `nhome_photos` with `item_id` and `supabase_url`
3. **`inspection_results.photo_urls` should be updated** with the `supabase_url`

### Actual Behavior

Steps 1 and 2 work correctly, but step 3 is not happening. The `photo_urls` array remains empty.

### Likely Code Issue

The photo upload service likely:
- ✅ Inserts into `nhome_photos` table correctly
- ❌ Does NOT update `inspection_results.photo_urls` with the URL

Possible locations to check:
- `/c/Users/johan/OneDrive/Documents/GitProjects/SnaggingBot V2.0/src/services/nhomePhotoUploadService.ts`
- `/c/Users/johan/OneDrive/Documents/GitProjects/SnaggingBot V2.0/src/app/api/nhome/upload-photo/route.ts`

---

## Solution

### Immediate Fix (Data Repair)

Use the provided SQL or TypeScript script to backfill `photo_urls` from `nhome_photos`:

```sql
UPDATE inspection_results ir
SET photo_urls = (
  SELECT array_agg(supabase_url ORDER BY created_at)
  FROM nhome_photos np
  WHERE np.session_id = ir.session_id
    AND np.item_id = ir.item_id
)
WHERE ir.session_id = '5b6acc70-442d-4525-b22a-3c6c32ec1281'
  AND EXISTS (
    SELECT 1
    FROM nhome_photos np
    WHERE np.session_id = ir.session_id
      AND np.item_id = ir.item_id
  );
```

### How to Execute the Fix

#### Option 1: Using TypeScript Script (Recommended)
```bash
npx tsx fix-photo-mapping.ts
```

This script will:
1. Fetch all inspection results with issues for the session
2. Query `nhome_photos` for each item
3. Update `inspection_results.photo_urls` with the correct URLs
4. Provide detailed logging and verification

#### Option 2: Using SQL Script
If you have direct database access via psql or Supabase Studio SQL Editor:
```bash
# Copy queries from fix-photo-mapping.sql and execute them
```

### Long-term Fix (Code Update)

Update the photo upload logic to ensure `inspection_results.photo_urls` is updated when photos are uploaded:

```typescript
// After inserting into nhome_photos
const { data: photoData, error: insertError } = await supabase
  .from('nhome_photos')
  .insert({
    session_id,
    item_id,
    file_name,
    supabase_url,
    metadata
  })
  .select()
  .single();

if (!insertError && photoData) {
  // IMPORTANT: Also update inspection_results.photo_urls
  const { error: updateError } = await supabase
    .from('inspection_results')
    .update({
      photo_urls: supabase.rpc('append_photo_url', {
        p_session_id: session_id,
        p_item_id: item_id,
        p_photo_url: supabase_url
      })
    })
    .eq('session_id', session_id)
    .eq('item_id', item_id);
}
```

Or use a database function:
```sql
CREATE OR REPLACE FUNCTION append_photo_url_to_result()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inspection_results
  SET photo_urls = array_append(COALESCE(photo_urls, ARRAY[]::text[]), NEW.supabase_url)
  WHERE session_id = NEW.session_id
    AND item_id = NEW.item_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_append_photo_url
AFTER INSERT ON nhome_photos
FOR EACH ROW
EXECUTE FUNCTION append_photo_url_to_result();
```

---

## Verification Steps

After running the fix, verify:

1. **Check photo_urls are populated:**
```sql
SELECT
  ir.id,
  ct.room_type,
  ct.item_description,
  array_length(ir.photo_urls, 1) as num_photos,
  ir.photo_urls
FROM inspection_results ir
JOIN checklist_templates ct ON ir.item_id = ct.id
WHERE ir.session_id = '5b6acc70-442d-4525-b22a-3c6c32ec1281'
  AND ir.status IN ('issue', 'critical')
  AND array_length(ir.photo_urls, 1) > 0;
```

2. **Regenerate the PDF report** and confirm photos appear correctly for each issue

3. **Test new photo uploads** to ensure the fix prevents future occurrences

---

## Files Provided

1. **`investigate-photos.ts`** - Diagnostic script that revealed the issue
2. **`fix-photo-mapping.sql`** - SQL queries to fix the data
3. **`fix-photo-mapping.ts`** - TypeScript script to fix the data programmatically
4. **`photo-investigation-report.txt`** - Full investigation report with all data
5. **`PHOTO-MAPPING-ANALYSIS.md`** - This document

---

## Next Steps

1. ✅ **Run the fix script** to repair data for session `5b6acc70-442d-4525-b22a-3c6c32ec1281`
2. ⚠️ **Check if other sessions have the same issue** (likely they do)
3. 🔧 **Update photo upload code** to prevent future occurrences
4. 🧪 **Add tests** to verify `photo_urls` is populated when photos are uploaded
5. 📝 **Consider database trigger** as a safety net to automatically sync photos

---

## Contact

If you need assistance running the fix or have questions about the analysis, please let me know!
