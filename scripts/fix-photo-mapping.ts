import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.local
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      process.env[key] = value;
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const sessionId = '5b6acc70-442d-4525-b22a-3c6c32ec1281';

async function fixPhotoMapping() {
  console.log('=== FIX PHOTO MAPPING ===\n');
  console.log(`Session ID: ${sessionId}\n`);

  // Step 1: Get all inspection results with issues for this session
  console.log('Step 1: Fetching inspection results with issues...');
  const { data: results, error: resultsError } = await supabase
    .from('inspection_results')
    .select(
      `
      id,
      item_id,
      status,
      photo_urls
    `
    )
    .eq('session_id', sessionId)
    .in('status', ['issue', 'critical']);

  if (resultsError) {
    console.error('Error fetching results:', resultsError);
    return;
  }

  console.log(`Found ${results?.length || 0} inspection results with issues\n`);

  // Step 2: For each result, get photos from nhome_photos
  console.log('Step 2: Mapping photos to inspection results...\n');

  let updatedCount = 0;
  let noPhotosCount = 0;

  for (const result of results || []) {
    // Get photos for this item
    const { data: photos, error: photosError } = await supabase
      .from('nhome_photos')
      .select('supabase_url, file_name, created_at')
      .eq('session_id', sessionId)
      .eq('item_id', result.item_id)
      .order('created_at');

    if (photosError) {
      console.error(`Error fetching photos for result ${result.id}:`, photosError);
      continue;
    }

    const photoUrls = photos?.map(p => p.supabase_url) || [];

    // Get item details for logging
    const { data: item } = await supabase
      .from('checklist_templates')
      .select('room_type, item_description')
      .eq('id', result.item_id)
      .single();

    if (photoUrls.length > 0) {
      // Update the inspection result with photo URLs
      const { error: updateError } = await supabase
        .from('inspection_results')
        .update({ photo_urls: photoUrls })
        .eq('id', result.id);

      if (updateError) {
        console.error(`Error updating result ${result.id}:`, updateError);
      } else {
        console.log(`✓ Updated: ${item?.room_type} - ${item?.item_description}`);
        console.log(`  Result ID: ${result.id}`);
        console.log(`  Status: ${result.status}`);
        console.log(`  Photos added: ${photoUrls.length}`);
        photoUrls.forEach(url => {
          console.log(`    - ${url}`);
        });
        console.log('');
        updatedCount++;
      }
    } else {
      console.log(`✗ No photos: ${item?.room_type} - ${item?.item_description}`);
      console.log(`  Result ID: ${result.id}`);
      console.log(`  Status: ${result.status}`);
      console.log('');
      noPhotosCount++;
    }
  }

  // Step 3: Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Total inspection results with issues: ${results?.length || 0}`);
  console.log(`Updated with photos: ${updatedCount}`);
  console.log(`No photos available: ${noPhotosCount}`);

  // Step 4: Verify the fix
  console.log('\n=== VERIFICATION ===');
  console.log('Fetching updated results...\n');

  const { data: verifyResults, error: verifyError } = await supabase
    .from('inspection_results')
    .select(
      `
      id,
      item_id,
      status,
      photo_urls
    `
    )
    .eq('session_id', sessionId)
    .in('status', ['issue', 'critical'])
    .not('photo_urls', 'is', null);

  if (verifyError) {
    console.error('Error verifying results:', verifyError);
    return;
  }

  const withPhotos = verifyResults?.filter(r => r.photo_urls && r.photo_urls.length > 0) || [];
  const withoutPhotos = (results?.length || 0) - withPhotos.length;

  console.log(`Results with photos: ${withPhotos.length}`);
  console.log(`Results without photos: ${withoutPhotos}`);

  if (withPhotos.length > 0) {
    console.log('\nSample of results with photos:');
    for (const result of withPhotos.slice(0, 5)) {
      const { data: item } = await supabase
        .from('checklist_templates')
        .select('room_type, item_description')
        .eq('id', result.item_id)
        .single();

      console.log(`  - ${item?.room_type} - ${item?.item_description}: ${result.photo_urls?.length} photo(s)`);
    }
  }

  console.log('\n✅ Fix completed!');
}

fixPhotoMapping().catch(console.error);
