import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aojewecjssqwkhtrcjim.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvamV3ZWNqc3Nxd2todHJjamltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTcyNzU1NywiZXhwIjoyMDc3MzAzNTU3fQ.b9A9_FsNj5ZzYULYQiE6FntWGSvmd0sSHcXu3GAy-Ro';

const supabase = createClient(supabaseUrl, supabaseKey);

const sessionId = '5b6acc70-442d-4525-b22a-3c6c32ec1281';

async function checkPhotos() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('  PHOTO DATA INVESTIGATION');
  console.log('  Session ID: ' + sessionId);
  console.log('════════════════════════════════════════════════════════════\n');

  // 1. Check for photos in nhome_photos table for this session
  console.log('1️⃣  NHOME_PHOTOS TABLE - THIS SESSION\n');
  const { data: sessionPhotos, error: sessionError } = await supabase
    .from('nhome_photos')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  if (sessionError) {
    console.error('❌ Error querying session photos:', sessionError);
  } else {
    console.log(`   Found: ${sessionPhotos?.length || 0} photo(s)`);
    if (sessionPhotos && sessionPhotos.length > 0) {
      sessionPhotos.forEach((photo, idx) => {
        console.log(`\n   Photo ${idx + 1}:`);
        console.log(`   - File: ${photo.file_name}`);
        console.log(`   - URL: ${photo.supabase_url}`);
        console.log(`   - Item ID: ${photo.item_id}`);
        console.log(`   - Created: ${photo.created_at}`);
      });
    } else {
      console.log('   ⚠️  No photos found for this session in nhome_photos table');
    }
  }

  // 2. Check all photos in nhome_photos table
  console.log('\n\n2️⃣  NHOME_PHOTOS TABLE - ALL SESSIONS\n');
  const { data: allPhotos, error: allError } = await supabase
    .from('nhome_photos')
    .select('session_id, file_name, created_at')
    .order('created_at', { ascending: false });

  if (allError) {
    console.error('❌ Error querying all photos:', allError);
  } else {
    console.log(`   Total photos in database: ${allPhotos?.length || 0}`);
    if (allPhotos && allPhotos.length > 0) {
      const sessionCounts = allPhotos.reduce((acc, photo) => {
        acc[photo.session_id] = (acc[photo.session_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('\n   Photos by session:');
      Object.entries(sessionCounts).forEach(([sid, count]) => {
        const marker = sid === sessionId ? ' ← TARGET SESSION' : '';
        console.log(`   - ${sid}: ${count} photo(s)${marker}`);
      });

      console.log('\n   Most recent photos:');
      allPhotos.slice(0, 3).forEach((photo, idx) => {
        console.log(`   ${idx + 1}. ${photo.file_name} (${photo.session_id.substring(0, 8)}...)`);
      });
    }
  }

  // 3. Check inspection_results for this session
  console.log('\n\n3️⃣  INSPECTION_RESULTS TABLE - THIS SESSION\n');
  const { data: sessionResults, error: sessionResultsError } = await supabase
    .from('inspection_results')
    .select('id, session_id, item_id, status, notes, photo_urls, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  if (sessionResultsError) {
    console.error('❌ Error querying session results:', sessionResultsError);
  } else {
    console.log(`   Found: ${sessionResults?.length || 0} inspection result(s)`);
    if (sessionResults && sessionResults.length > 0) {
      let resultsWithPhotos = 0;
      sessionResults.forEach((result, idx) => {
        const hasPhotos = result.photo_urls &&
          ((Array.isArray(result.photo_urls) && result.photo_urls.length > 0) ||
           (typeof result.photo_urls === 'object' && Object.keys(result.photo_urls).length > 0));

        if (hasPhotos) resultsWithPhotos++;

        console.log(`\n   Result ${idx + 1}:`);
        console.log(`   - Item ID: ${result.item_id}`);
        console.log(`   - Status: ${result.status}`);
        console.log(`   - Photo URLs: ${hasPhotos ? JSON.stringify(result.photo_urls) : 'null/empty'}`);
        console.log(`   - Notes: ${result.notes || 'none'}`);
      });
      console.log(`\n   Results with photo_urls: ${resultsWithPhotos}/${sessionResults.length}`);
    } else {
      console.log('   ⚠️  No inspection results found for this session');
    }
  }

  // 4. Check ALL inspection_results with photo_urls
  console.log('\n\n4️⃣  INSPECTION_RESULTS TABLE - ALL RESULTS WITH PHOTO_URLS\n');
  const { data: allResultsWithPhotos, error: allResultsError } = await supabase
    .from('inspection_results')
    .select('id, session_id, item_id, photo_urls, created_at')
    .not('photo_urls', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (allResultsError) {
    console.error('❌ Error querying results with photos:', allResultsError);
  } else {
    const nonEmptyResults = allResultsWithPhotos?.filter(r => {
      const urls = r.photo_urls;
      return urls && ((Array.isArray(urls) && urls.length > 0) ||
             (typeof urls === 'object' && Object.keys(urls).length > 0));
    }) || [];

    console.log(`   Total results with non-null photo_urls: ${allResultsWithPhotos?.length || 0}`);
    console.log(`   Results with actual photo data: ${nonEmptyResults.length}`);

    if (nonEmptyResults.length > 0) {
      console.log('\n   Sample results:');
      nonEmptyResults.slice(0, 3).forEach((result, idx) => {
        console.log(`   ${idx + 1}. Session: ${result.session_id.substring(0, 8)}... | Photos: ${JSON.stringify(result.photo_urls)}`);
      });
    } else {
      console.log('   ⚠️  No inspection results with actual photo URLs found');
    }
  }

  // 5. Check if session exists
  console.log('\n\n5️⃣  SESSION VALIDATION\n');
  const { data: session, error: sessionCheckError } = await supabase
    .from('inspection_sessions')
    .select('id, status, started_at, completed_at, inspector_id')
    .eq('id', sessionId)
    .single();

  if (sessionCheckError) {
    console.error('❌ Error checking session:', sessionCheckError);
  } else if (session) {
    console.log('   ✅ Session exists');
    console.log(`   - Status: ${session.status}`);
    console.log(`   - Started: ${session.started_at}`);
    console.log(`   - Completed: ${session.completed_at || 'Not completed'}`);
    console.log(`   - Inspector: ${session.inspector_id}`);
  } else {
    console.log('   ❌ Session not found');
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`\n  📸 Photos in nhome_photos for session: ${sessionPhotos?.length || 0}`);
  console.log(`  📋 Results in inspection_results for session: ${sessionResults?.length || 0}`);
  const resultsWithPhotoUrls = sessionResults?.filter(r => {
    const urls = r.photo_urls;
    return urls && ((Array.isArray(urls) && urls.length > 0) ||
           (typeof urls === 'object' && Object.keys(urls).length > 0));
  }).length || 0;
  console.log(`  🔗 Results with photo_urls populated: ${resultsWithPhotoUrls}`);
  console.log('\n════════════════════════════════════════════════════════════\n');
}

checkPhotos().catch(console.error);
