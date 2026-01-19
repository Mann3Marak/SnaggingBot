import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aojewecjssqwkhtrcjim.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvamV3ZWNqc3Nxd2todHJjamltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTcyNzU1NywiZXhwIjoyMDc3MzAzNTU3fQ.b9A9_FsNj5ZzYULYQiE6FntWGSvmd0sSHcXu3GAy-Ro';

const supabase = createClient(supabaseUrl, supabaseKey);

const sessionId = '5b6acc70-442d-4525-b22a-3c6c32ec1281';

async function checkPhotos() {
  console.log('=== Checking nhome_photos table ===\n');

  // 1. Check for photos for the specific session
  console.log(`1. Photos for session ${sessionId}:`);
  const { data: sessionPhotos, error: sessionError } = await supabase
    .from('nhome_photos')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  if (sessionError) {
    console.error('Error querying session photos:', sessionError);
  } else {
    console.log(`Found ${sessionPhotos?.length || 0} photos for this session`);
    if (sessionPhotos && sessionPhotos.length > 0) {
      console.log('Sample photo:', JSON.stringify(sessionPhotos[0], null, 2));
    }
  }

  console.log('\n2. All photos in nhome_photos table:');
  const { data: allPhotos, error: allError } = await supabase
    .from('nhome_photos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (allError) {
    console.error('Error querying all photos:', allError);
  } else {
    console.log(`Total photos found: ${allPhotos?.length || 0}`);
    if (allPhotos && allPhotos.length > 0) {
      console.log('Sample photo:', JSON.stringify(allPhotos[0], null, 2));
      console.log('\nAll session IDs with photos:');
      const uniqueSessions = [...new Set(allPhotos.map(p => p.session_id))];
      uniqueSessions.forEach(sid => {
        const count = allPhotos.filter(p => p.session_id === sid).length;
        console.log(`  - ${sid}: ${count} photo(s)`);
      });
    }
  }

  console.log('\n\n=== Checking inspection_results table ===\n');

  // 3. Check inspection_results for photo_urls
  console.log('3. Inspection results with photo_urls populated:');
  const { data: resultsWithPhotos, error: resultsError } = await supabase
    .from('inspection_results')
    .select('id, session_id, item_description, photo_urls, created_at')
    .not('photo_urls', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (resultsError) {
    console.error('Error querying inspection results:', resultsError);
  } else {
    console.log(`Found ${resultsWithPhotos?.length || 0} results with photo_urls`);
    if (resultsWithPhotos && resultsWithPhotos.length > 0) {
      resultsWithPhotos.forEach(result => {
        console.log(`\nResult ID: ${result.id}`);
        console.log(`Session ID: ${result.session_id}`);
        console.log(`Item: ${result.item_description}`);
        console.log(`Photo URLs: ${JSON.stringify(result.photo_urls)}`);
      });
    }
  }

  // 4. Check for the specific session in inspection_results
  console.log(`\n\n4. All inspection results for session ${sessionId}:`);
  const { data: sessionResults, error: sessionResultsError } = await supabase
    .from('inspection_results')
    .select('id, item_description, note, photo_urls, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  if (sessionResultsError) {
    console.error('Error querying session results:', sessionResultsError);
  } else {
    console.log(`Found ${sessionResults?.length || 0} results for this session`);
    if (sessionResults && sessionResults.length > 0) {
      sessionResults.forEach(result => {
        console.log(`\n- Item: ${result.item_description}`);
        console.log(`  Photo URLs: ${result.photo_urls ? JSON.stringify(result.photo_urls) : 'null'}`);
        console.log(`  Note: ${result.note || 'none'}`);
      });
    }
  }

  // 5. Check table structure
  console.log('\n\n5. Table structure for nhome_photos:');
  const { data: tableInfo, error: tableError } = await supabase
    .from('nhome_photos')
    .select('*')
    .limit(1);

  if (tableError) {
    console.error('Error getting table structure:', tableError);
  } else if (tableInfo && tableInfo.length > 0) {
    console.log('Columns:', Object.keys(tableInfo[0]).join(', '));
  } else {
    console.log('Table is empty - cannot determine structure from data');
  }
}

checkPhotos().catch(console.error);
