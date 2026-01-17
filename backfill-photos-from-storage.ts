/**
 * Backfill Script: Populate nhome_photos table from storage bucket
 *
 * Problem: Photos uploaded to storage before the fix aren't in the nhome_photos database table
 * Solution: Parse filenames from storage, extract metadata, and insert into nhome_photos table
 *
 * Filename format: NHome_{project}_{apartment}_{room}___{item}_{timestamp}.jpg
 * Example: NHome_Dona_Ana_Beach_residences_5_2A_Kitchen_floor_skirting_2026-01-12T22-34-22-361Z.jpg
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aojewecjssqwkhtrcjim.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvamV3ZWNqc3Nxd2todHJjamltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTcyNzU1NywiZXhwIjoyMDc3MzAzNTU3fQ.b9A9_FsNj5ZzYULYQiE6FntWGSvmd0sSHcXu3GAy-Ro';

const supabase = createClient(supabaseUrl, supabaseKey);

const TARGET_SESSION_ID = '5b6acc70-442d-4525-b22a-3c6c32ec1281';
const BUCKET_NAME = 'nhome_photos';

interface ParsedFileName {
  originalName: string;
  room: string;
  item: string;
  timestamp: string;
  project?: string;
  apartment?: string;
}

/**
 * Parse NHome filename to extract room and item description
 * Format 1: NHome_{project}_{apartment}_{room}___{item}_{timestamp}.jpg (with triple underscore)
 * Format 2: NHome_{project}_{apartment}_{room}_{item}_{timestamp}.jpg (single underscores)
 */
function parseNHomeFileName(fileName: string): ParsedFileName | null {
  try {
    // Remove .jpg extension
    const withoutExt = fileName.replace(/\.jpe?g$/i, '');

    // Extract timestamp from end (always follows pattern _YYYY-MM-DDTHH-MM-SS-MMMZ)
    const timestampMatch = withoutExt.match(/(_\d{4}-\d{2}-\d{2}T[\d:-]+Z)$/);
    if (!timestampMatch) {
      console.warn(`   ⚠️  No timestamp found in: ${fileName}`);
      return null;
    }
    const timestamp = timestampMatch[1].substring(1);
    const withoutTimestamp = withoutExt.replace(/(_\d{4}-\d{2}-\d{2}T[\d:-]+Z)$/, '');

    // Check for triple underscore format first
    const tripleUnderscoreParts = withoutTimestamp.split('___');
    let room: string;
    let item: string;

    if (tripleUnderscoreParts.length === 2) {
      // Format: NHome_Dona_Ana_Beach_residences_5_2A_Balcony___Pool_side_walls_tiles
      const leftSide = tripleUnderscoreParts[0];
      const rightSide = tripleUnderscoreParts[1];

      const leftParts = leftSide.split('_');
      // Find apartment ID (pattern like "2A")
      let roomStartIdx = -1;
      for (let i = 0; i < leftParts.length; i++) {
        if (/^\d+[A-Z]+$/.test(leftParts[i])) {
          roomStartIdx = i + 1;
          break;
        }
      }

      if (roomStartIdx === -1) {
        roomStartIdx = 6; // Fallback: NHome + 4-part project + apartment
      }

      const roomParts = leftParts.slice(roomStartIdx);
      room = roomParts.join(' ');
      item = rightSide.replace(/_/g, ' ');
    } else {
      // Format: NHome_Dona_Ana_Beach_residences_5_2A_Kitchen_floor_skirting
      // Split and find where room/item boundary is
      const parts = withoutTimestamp.split('_');

      // Find apartment ID (pattern like "2A")
      let apartmentIdx = -1;
      for (let i = 0; i < parts.length; i++) {
        if (/^\d+[A-Z]+$/.test(parts[i])) {
          apartmentIdx = i;
          break;
        }
      }

      if (apartmentIdx === -1) {
        console.warn(`   ⚠️  Could not find apartment ID in: ${fileName}`);
        return null;
      }

      // Everything after apartment ID is room + item
      // Heuristic: First 1-2 parts are room, rest is item
      const afterApartment = parts.slice(apartmentIdx + 1);

      if (afterApartment.length < 2) {
        console.warn(`   ⚠️  Not enough parts after apartment ID: ${fileName}`);
        return null;
      }

      // For common rooms like "Living Room", "Suite Bedroom", "Bedroom 2", take first 1-2 words
      if (afterApartment.length >= 2 &&
          (afterApartment[1].match(/^\d+$/) || // "Bedroom 2"
           afterApartment[1] === 'Room' || // "Living Room"
           afterApartment[0] === 'Suite')) { // "Suite Bedroom"
        room = afterApartment.slice(0, 2).join(' ');
        item = afterApartment.slice(2).join(' ');
      } else {
        // Single-word room name
        room = afterApartment[0];
        item = afterApartment.slice(1).join(' ');
      }
    }

    return {
      originalName: fileName,
      room: room || 'Unknown Room',
      item: item || 'Unknown Item',
      timestamp,
      project: 'Dona Ana Beach Residences',
      apartment: '5/2A',
    };
  } catch (error) {
    console.error(`   ❌ Error parsing filename: ${fileName}`, error);
    return null;
  }
}

/**
 * Normalize item description for matching
 * Handles common variations like "floor & skirting" vs "floor skirting"
 */
function normalizeItemDescription(description: string): string {
  return description
    .toLowerCase()
    .replace(/\s*&\s*/g, ' ') // Remove ampersands
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Find matching checklist item by room and item description
 */
async function findMatchingChecklistItem(
  sessionId: string,
  room: string,
  itemDescription: string
): Promise<string | null> {
  try {
    // Get session details to find apartment type
    const { data: session } = await supabase
      .from('inspection_sessions')
      .select('apartment_id, apartments(apartment_type)')
      .eq('id', sessionId)
      .single();

    // Supabase returns apartments as single object with .single(), but TS types it as array
    const apt = session?.apartments as unknown as { apartment_type: string } | null;
    if (!apt?.apartment_type) {
      console.warn('   ⚠️  Could not determine apartment type for session');
      return null;
    }

    const apartmentType = apt.apartment_type;
    const normalizedItem = normalizeItemDescription(itemDescription);

    // Get all checklist items for this apartment type
    const { data: allItems } = await supabase
      .from('checklist_templates')
      .select('id, room_type, item_description')
      .eq('apartment_type', apartmentType);

    if (!allItems || allItems.length === 0) {
      return null;
    }

    // Strategy 1: Exact room + item match (normalized)
    for (const item of allItems) {
      const itemRoom = item.room_type?.toLowerCase() || '';
      const itemDesc = normalizeItemDescription(item.item_description || '');

      if (itemRoom.includes(room.toLowerCase()) && itemDesc === normalizedItem) {
        return item.id;
      }
    }

    // Strategy 2: Room match + item contains or is contained by
    for (const item of allItems) {
      const itemRoom = item.room_type?.toLowerCase() || '';
      const itemDesc = normalizeItemDescription(item.item_description || '');

      if (itemRoom.includes(room.toLowerCase())) {
        // Check if item descriptions overlap significantly
        if (itemDesc.includes(normalizedItem) || normalizedItem.includes(itemDesc)) {
          return item.id;
        }

        // Check individual words (for cases like "walls tiles" vs "walls & tiles")
        const photoWords = new Set(normalizedItem.split(' ').filter(w => w.length > 2));
        const checklistWords = new Set(itemDesc.split(' ').filter(w => w.length > 2));
        const intersection = [...photoWords].filter(w => checklistWords.has(w));

        // If at least 2 words match, or if all photo words match, it's a good match
        if (intersection.length >= 2 || (photoWords.size > 0 && intersection.length === photoWords.size)) {
          return item.id;
        }
      }
    }

    // Strategy 3: Fuzzy match on item only (fallback)
    for (const item of allItems) {
      const itemDesc = normalizeItemDescription(item.item_description || '');

      if (itemDesc.includes(normalizedItem) || normalizedItem.includes(itemDesc)) {
        return item.id;
      }
    }

    return null;
  } catch (error) {
    console.error('   ❌ Error finding checklist item:', error);
    return null;
  }
}

async function backfillPhotosForSession(sessionId: string, dryRun: boolean = true) {
  console.log('════════════════════════════════════════════════════════════');
  console.log('  PHOTO BACKFILL SCRIPT');
  console.log(`  Session ID: ${sessionId}`);
  console.log(`  Mode: ${dryRun ? 'DRY RUN' : 'LIVE RUN'}`);
  console.log('════════════════════════════════════════════════════════════\n');

  // 1. List photos in storage for this session
  const sessionPath = `sessions/${sessionId}`;
  console.log('1️⃣  Fetching photos from storage...\n');

  const { data: storageFiles, error: listError } = await supabase.storage
    .from(BUCKET_NAME)
    .list(sessionPath, {
      limit: 100,
      offset: 0,
      sortBy: { column: 'created_at', order: 'asc' }
    });

  if (listError) {
    console.error('❌ Error listing storage files:', listError);
    return;
  }

  if (!storageFiles || storageFiles.length === 0) {
    console.log('   ⚠️  No files found in storage for this session');
    return;
  }

  console.log(`   Found ${storageFiles.length} photo(s) in storage\n`);

  // 2. Check which photos already exist in database
  const { data: existingPhotos } = await supabase
    .from('nhome_photos')
    .select('file_name')
    .eq('session_id', sessionId);

  const existingFileNames = new Set(existingPhotos?.map(p => p.file_name) || []);
  console.log(`   ${existingFileNames.size} photo(s) already in database\n`);

  // 3. Process each photo
  const photosToInsert = [];
  let matchedCount = 0;
  let unmatchedCount = 0;

  console.log('2️⃣  Parsing filenames and matching to checklist items...\n');

  for (const file of storageFiles) {
    if (existingFileNames.has(file.name)) {
      console.log(`   ⏭️  SKIP: ${file.name} (already in database)`);
      continue;
    }

    console.log(`   📸 ${file.name}`);

    const parsed = parseNHomeFileName(file.name);
    if (!parsed) {
      console.log(`      ❌ Could not parse filename`);
      unmatchedCount++;
      continue;
    }

    console.log(`      Room: ${parsed.room}`);
    console.log(`      Item: ${parsed.item}`);

    // Try to find matching checklist item
    const itemId = await findMatchingChecklistItem(sessionId, parsed.room, parsed.item);

    if (itemId) {
      console.log(`      ✅ Matched to item_id: ${itemId}`);
      matchedCount++;

      photosToInsert.push({
        session_id: sessionId,
        item_id: itemId,
        file_name: file.name,
        supabase_url: `${sessionPath}/${file.name}`,
        inspector_name: 'NHome Inspector',
        metadata: {
          room: parsed.room,
          item: parsed.item,
          parsed_at: new Date().toISOString(),
          backfilled: true
        },
        file_size: file.metadata?.size || null,
        created_at: file.created_at,
      });
    } else {
      console.log(`      ⚠️  No matching checklist item found`);
      unmatchedCount++;

      // Insert anyway but with null item_id so photos appear in reports
      photosToInsert.push({
        session_id: sessionId,
        item_id: null,
        file_name: file.name,
        supabase_url: `${sessionPath}/${file.name}`,
        inspector_name: 'NHome Inspector',
        metadata: {
          room: parsed.room,
          item: parsed.item,
          parsed_at: new Date().toISOString(),
          backfilled: true,
          unmatched: true
        },
        file_size: file.metadata?.size || null,
        created_at: file.created_at,
      });
    }

    console.log('');
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`\n  📊 Photos to backfill: ${photosToInsert.length}`);
  console.log(`  ✅ Matched to checklist items: ${matchedCount}`);
  console.log(`  ⚠️  Unmatched (will insert with null item_id): ${unmatchedCount}`);
  console.log(`  ⏭️  Already in database: ${existingFileNames.size}`);

  if (dryRun) {
    console.log('\n  🔍 DRY RUN - No changes made to database');
    console.log('\n  To execute the backfill, run with dryRun=false');
  } else if (photosToInsert.length > 0) {
    console.log('\n3️⃣  Inserting photos into nhome_photos table...\n');

    const { data, error } = await supabase
      .from('nhome_photos')
      .insert(photosToInsert)
      .select();

    if (error) {
      console.error('   ❌ Error inserting photos:', error);
    } else {
      console.log(`   ✅ Successfully inserted ${data?.length || 0} photo(s)`);
    }
  }

  console.log('\n════════════════════════════════════════════════════════════\n');
}

// Run the backfill
const dryRun = process.argv.includes('--execute') ? false : true;
backfillPhotosForSession(TARGET_SESSION_ID, dryRun).catch(console.error);
