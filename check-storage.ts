import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aojewecjssqwkhtrcjim.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvamV3ZWNqc3Nxd2todHJjamltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTcyNzU1NywiZXhwIjoyMDc3MzAzNTU3fQ.b9A9_FsNj5ZzYULYQiE6FntWGSvmd0sSHcXu3GAy-Ro';

const supabase = createClient(supabaseUrl, supabaseKey);

const sessionId = '5b6acc70-442d-4525-b22a-3c6c32ec1281';
const bucketName = 'nhome_photos';

async function checkStorage() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('  STORAGE BUCKET INVESTIGATION');
  console.log('  Session ID: ' + sessionId);
  console.log('  Bucket: ' + bucketName);
  console.log('════════════════════════════════════════════════════════════\n');

  // 1. List all files in the session folder
  console.log('1️⃣  FILES IN STORAGE BUCKET FOR THIS SESSION\n');
  const sessionPath = `sessions/${sessionId}`;

  const { data: files, error: listError } = await supabase.storage
    .from(bucketName)
    .list(sessionPath, {
      limit: 100,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' }
    });

  if (listError) {
    console.error('❌ Error listing files:', listError);
  } else if (!files || files.length === 0) {
    console.log('   ⚠️  No files found in storage for this session');
    console.log(`   Path checked: ${sessionPath}`);
  } else {
    console.log(`   Found: ${files.length} file(s) in storage\n`);
    files.forEach((file, idx) => {
      console.log(`   ${idx + 1}. ${file.name}`);
      console.log(`      - Size: ${file.metadata?.size || 'unknown'} bytes`);
      console.log(`      - Created: ${file.created_at}`);
      console.log(`      - Full path: ${sessionPath}/${file.name}`);
      console.log('');
    });
  }

  // 2. Try alternative paths (in case files are stored differently)
  console.log('\n2️⃣  CHECKING ALTERNATIVE STORAGE PATHS\n');

  // Check root level
  const { data: rootFiles, error: rootError } = await supabase.storage
    .from(bucketName)
    .list('', {
      limit: 10,
      offset: 0,
    });

  if (rootError) {
    console.error('❌ Error checking root:', rootError);
  } else {
    console.log(`   Root level: ${rootFiles?.length || 0} items`);
    if (rootFiles && rootFiles.length > 0) {
      rootFiles.forEach(item => {
        console.log(`   - ${item.name} (${item.id ? 'folder' : 'file'})`);
      });
    }
  }

  // Check sessions folder
  const { data: sessionsFolder, error: sessionsFolderError } = await supabase.storage
    .from(bucketName)
    .list('sessions', {
      limit: 50,
      offset: 0,
    });

  if (sessionsFolderError) {
    console.error('\n   ❌ Error checking sessions folder:', sessionsFolderError);
  } else {
    console.log(`\n   Sessions folder: ${sessionsFolder?.length || 0} session folders`);
    if (sessionsFolder && sessionsFolder.length > 0) {
      sessionsFolder.forEach(folder => {
        const marker = folder.name === sessionId ? ' ← TARGET SESSION' : '';
        console.log(`   - ${folder.name}${marker}`);
      });
    }
  }

  console.log('\n════════════════════════════════════════════════════════════\n');
}

checkStorage().catch(console.error);
