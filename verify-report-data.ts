/**
 * Verification Script: Test report-data API to confirm photos appear
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aojewecjssqwkhtrcjim.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvamV3ZWNqc3Nxd2todHJjamltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTcyNzU1NywiZXhwIjoyMDc3MzAzNTU3fQ.b9A9_FsNj5ZzYULYQiE6FntWGSvmd0sSHcXu3GAy-Ro';

const supabase = createClient(supabaseUrl, supabaseKey);
const sessionId = '5b6acc70-442d-4525-b22a-3c6c32ec1281';
const BUCKET_ID = 'nhome_photos';

async function verifyReportData() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('  REPORT-DATA API VERIFICATION');
  console.log('  Session ID: ' + sessionId);
  console.log('════════════════════════════════════════════════════════════\n');

  // Simulate what the report-data API does
  console.log('1️⃣  Loading photos from nhome_photos table...\n');

  const { data: photoRows, error: photosError } = await supabase
    .from('nhome_photos')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (photosError) {
    console.error('❌ Error loading photos:', photosError);
    return;
  }

  const photos = photoRows ?? [];
  console.log(`   Found ${photos.length} persisted photos for session ${sessionId}`);

  if (photos.length === 0) {
    console.log('   ⚠️  No photos found - reports will not contain photos\n');
    return;
  }

  console.log('\n2️⃣  Generating signed URLs for photos...\n');

  const signedPhotos = await Promise.all(
    photos.map(async (photo) => {
      const fileName = photo.file_name ?? `photo-${photo.id}.jpg`;
      const storagePath = photo.supabase_url || `sessions/${sessionId}/${fileName}`;

      const { data: signed, error: signedError } = await supabase.storage
        .from(BUCKET_ID)
        .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days

      if (signedError) {
        console.warn(`   ⚠️  Unable to sign URL for ${fileName}:`, signedError.message);
      }

      return {
        ...photo,
        storage_path: storagePath,
        signed_url: signed?.signedUrl ?? null,
      };
    })
  );

  const successfulSigns = signedPhotos.filter(p => p.signed_url !== null).length;
  console.log(`   Successfully generated ${successfulSigns}/${photos.length} signed URLs`);

  console.log('\n3️⃣  Grouping photos by item_id...\n');

  const photosByItemId = new Map<string, any[]>();
  signedPhotos.forEach((photo) => {
    if (!photo.item_id) {
      console.log(`   ⚠️  Photo ${photo.file_name} has no item_id (will not be linked)`);
      return;
    }
    const key = String(photo.item_id);
    const bucket = photosByItemId.get(key) ?? [];
    bucket.push(photo);
    photosByItemId.set(key, bucket);
  });

  console.log(`   Photos grouped into ${photosByItemId.size} unique item(s)`);

  console.log('\n4️⃣  Sample photo groupings:\n');

  let count = 0;
  for (const [itemId, photoGroup] of photosByItemId.entries()) {
    if (count >= 5) break; // Show first 5 groups

    // Get item details
    const { data: item } = await supabase
      .from('checklist_templates')
      .select('room_type, item_description')
      .eq('id', itemId)
      .single();

    console.log(`   Item: ${item?.room_type} - ${item?.item_description}`);
    console.log(`   Photos: ${photoGroup.length}`);
    photoGroup.forEach(photo => {
      console.log(`     - ${photo.file_name}`);
      console.log(`       URL: ${photo.signed_url ? '✅ Signed URL available' : '❌ No URL'}`);
    });
    console.log('');
    count++;
  }

  if (photosByItemId.size > 5) {
    console.log(`   ... and ${photosByItemId.size - 5} more item(s)\n`);
  }

  console.log('════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`\n  📸 Total photos: ${photos.length}`);
  console.log(`  🔗 Photos with item_id: ${photos.filter(p => p.item_id).length}`);
  console.log(`  🔑 Signed URLs generated: ${successfulSigns}`);
  console.log(`  📦 Unique items with photos: ${photosByItemId.size}`);

  if (photos.length > 0 && successfulSigns === photos.length) {
    console.log('\n  ✅ SUCCESS: All photos are ready to appear in reports!');
  } else if (photos.length > 0 && successfulSigns > 0) {
    console.log('\n  ⚠️  PARTIAL: Some photos may not appear in reports');
  } else {
    console.log('\n  ❌ ISSUE: Photos will not appear in reports');
  }

  console.log('\n════════════════════════════════════════════════════════════\n');
}

verifyReportData().catch(console.error);
