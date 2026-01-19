import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.local
const envPath = path.join(__dirname, '.env.local');
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
  console.error('Missing required environment variables:');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'found' : 'MISSING');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'found' : 'MISSING');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const sessionId = '5b6acc70-442d-4525-b22a-3c6c32ec1281';

async function investigatePhotos() {
  console.log('=== INVESTIGATING PHOTO MAPPINGS ===\n');
  console.log(`Session ID: ${sessionId}\n`);

  // 1. Get all photos for this session
  console.log('1. PHOTOS IN SESSION:');
  console.log('=' .repeat(80));
  const { data: photos, error: photosError } = await supabase
    .from('nhome_photos')
    .select(`
      id,
      item_id,
      file_name,
      supabase_url,
      created_at,
      metadata
    `)
    .eq('session_id', sessionId)
    .order('created_at');

  if (photosError) {
    console.error('Error fetching photos:', photosError);
    return;
  }

  if (!photos || photos.length === 0) {
    console.log('No photos found for this session.');
    return;
  }

  console.log(`Total photos: ${photos.length}\n`);

  // Get item details for each photo
  for (const photo of photos) {
    const { data: item } = await supabase
      .from('checklist_templates')
      .select('room_type, item_description, item_description_pt')
      .eq('id', photo.item_id)
      .single();

    console.log(`Photo ID: ${photo.id}`);
    console.log(`  File: ${photo.file_name}`);
    console.log(`  Item ID: ${photo.item_id}`);
    console.log(`  Item: ${item?.room_type} - ${item?.item_description}`);
    console.log(`  Created: ${photo.created_at}`);
    console.log(`  Metadata: ${JSON.stringify(photo.metadata || {})}`);
    console.log('');
  }

  // 2. Check for duplicate item_id assignments
  console.log('\n2. DUPLICATE PHOTO ASSIGNMENTS:');
  console.log('=' .repeat(80));
  const itemCounts = photos.reduce((acc, photo) => {
    acc[photo.item_id] = (acc[photo.item_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const duplicates = Object.entries(itemCounts).filter(([_, count]) => count > 1);

  if (duplicates.length === 0) {
    console.log('No items with multiple photos assigned.');
  } else {
    console.log(`Found ${duplicates.length} items with multiple photos:\n`);
    for (const [itemId, count] of duplicates) {
      const { data: item } = await supabase
        .from('checklist_templates')
        .select('room_type, item_description')
        .eq('id', itemId)
        .single();

      const itemPhotos = photos.filter(p => p.item_id === itemId);
      console.log(`Item ID: ${itemId} (${count} photos)`);
      console.log(`  Item: ${item?.room_type} - ${item?.item_description}`);
      console.log(`  Photos:`);
      itemPhotos.forEach(p => {
        console.log(`    - ${p.file_name} (${new Date(p.created_at).toLocaleString()})`);
      });
      console.log('');
    }
  }

  // 3. Get inspection results with issues
  console.log('\n3. INSPECTION RESULTS WITH ISSUES:');
  console.log('=' .repeat(80));
  const { data: results, error: resultsError } = await supabase
    .from('inspection_results')
    .select(`
      id,
      item_id,
      status,
      notes,
      enhanced_notes,
      photo_urls
    `)
    .eq('session_id', sessionId)
    .neq('status', 'good')
    .order('item_id');

  if (resultsError) {
    console.error('Error fetching results:', resultsError);
    return;
  }

  if (!results || results.length === 0) {
    console.log('No issues found in this session.');
  } else {
    console.log(`Total issues: ${results.length}\n`);

    for (const result of results) {
      const { data: item } = await supabase
        .from('checklist_templates')
        .select('room_type, item_description, item_description_pt')
        .eq('id', result.item_id)
        .single();

      console.log(`Result ID: ${result.id}`);
      console.log(`  Item ID: ${result.item_id}`);
      console.log(`  Item: ${item?.room_type} - ${item?.item_description}`);
      console.log(`  Status: ${result.status}`);
      console.log(`  Notes: ${result.notes || '(none)'}`);
      console.log(`  Enhanced Notes: ${result.enhanced_notes || '(none)'}`);
      console.log(`  Photo URLs in result: ${result.photo_urls?.length || 0}`);
      if (result.photo_urls && result.photo_urls.length > 0) {
        result.photo_urls.forEach((url: string) => {
          console.log(`    - ${url}`);
        });
      }
      console.log('');
    }
  }

  // 4. Cross-reference photos with results
  console.log('\n4. PHOTO-TO-RESULT MAPPING ANALYSIS:');
  console.log('=' .repeat(80));

  for (const result of results || []) {
    const itemPhotos = photos.filter(p => p.item_id === result.item_id);
    const { data: item } = await supabase
      .from('checklist_templates')
      .select('room_type, item_description')
      .eq('id', result.item_id)
      .single();

    console.log(`\nItem: ${item?.room_type} - ${item?.item_description}`);
    console.log(`  Item ID: ${result.item_id}`);
    console.log(`  Status: ${result.status}`);
    console.log(`  Photos in nhome_photos: ${itemPhotos.length}`);
    console.log(`  Photos in inspection_results.photo_urls: ${result.photo_urls?.length || 0}`);

    if (itemPhotos.length > 0) {
      console.log(`  Photos from nhome_photos table:`);
      itemPhotos.forEach(p => {
        console.log(`    - ${p.file_name}`);
        console.log(`      Storage URL: ${p.supabase_url}`);
      });
    }

    if (result.photo_urls && result.photo_urls.length > 0) {
      console.log(`  Photos from inspection_results.photo_urls:`);
      result.photo_urls.forEach((url: string) => {
        console.log(`    - ${url}`);
      });
    }

    // Check if URLs match
    const photoStorageUrls = itemPhotos.map(p => p.supabase_url);
    const resultUrls = result.photo_urls || [];
    const mismatched = resultUrls.some((url: string) => !photoStorageUrls.includes(url));

    if (mismatched) {
      console.log(`  ⚠️ MISMATCH: photo_urls contains URLs not in nhome_photos for this item!`);
    }
  }

  // 5. Summary and recommendations
  console.log('\n\n5. SUMMARY AND RECOMMENDATIONS:');
  console.log('=' .repeat(80));

  const totalPhotos = photos.length;
  const totalIssues = results?.length || 0;
  const photosPerIssue = totalPhotos / Math.max(totalIssues, 1);

  console.log(`Total photos: ${totalPhotos}`);
  console.log(`Total issues: ${totalIssues}`);
  console.log(`Average photos per issue: ${photosPerIssue.toFixed(2)}`);
  console.log(`Items with multiple photos: ${duplicates.length}`);

  if (duplicates.length > 0 && totalIssues > 0 && duplicates.length < totalIssues) {
    console.log('\n⚠️ WARNING: Some items have multiple photos while others may have none!');
    console.log('This suggests photos may be incorrectly mapped to items.');
  }
}

investigatePhotos().catch(console.error);
