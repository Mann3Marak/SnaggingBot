import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aojewecjssqwkhtrcjim.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvamV3ZWNqc3Nxd2todHJjamltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTcyNzU1NywiZXhwIjoyMDc3MzAzNTU3fQ.b9A9_FsNj5ZzYULYQiE6FntWGSvmd0sSHcXu3GAy-Ro';

const supabase = createClient(supabaseUrl, supabaseKey);
const sessionId = '5b6acc70-442d-4525-b22a-3c6c32ec1281';

async function checkImageSizes() {
  console.log('Checking image sizes for session:', sessionId);

  // Get photos from database
  const { data: photos, error } = await supabase
    .from('nhome_photos')
    .select('*')
    .eq('session_id', sessionId);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${photos?.length || 0} photos in database\n`);

  for (const photo of photos || []) {
    console.log(`Photo: ${photo.file_name}`);
    console.log(`  DB file_size: ${photo.file_size ? (photo.file_size / 1024).toFixed(0) + 'KB' : 'not recorded'}`);

    // Try to get actual file size from storage
    const storagePath = `sessions/${sessionId}/${photo.file_name}`;

    const { data: signed } = await supabase.storage
      .from('nhome_photos')
      .createSignedUrl(storagePath, 60);

    if (signed?.signedUrl) {
      try {
        const response = await fetch(signed.signedUrl);
        const arrayBuffer = await response.arrayBuffer();
        const sizeKB = (arrayBuffer.byteLength / 1024).toFixed(0);
        console.log(`  Actual size: ${sizeKB}KB`);

        if (arrayBuffer.byteLength > 500 * 1024) {
          console.log(`  ⚠️  EXCEEDS 500KB LIMIT - will be skipped in PDF`);
        } else {
          console.log(`  ✅ Within 500KB limit`);
        }
      } catch (e) {
        console.log(`  Failed to fetch: ${e}`);
      }
    } else {
      console.log(`  Could not create signed URL for path: ${storagePath}`);
    }
    console.log('');
  }
}

checkImageSizes().catch(console.error);
