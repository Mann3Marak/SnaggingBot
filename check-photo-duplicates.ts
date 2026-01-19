import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aojewecjssqwkhtrcjim.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvamV3ZWNqc3Nxd2todHJjamltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTcyNzU1NywiZXhwIjoyMDc3MzAzNTU3fQ.b9A9_FsNj5ZzYULYQiE6FntWGSvmd0sSHcXu3GAy-Ro';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // Get all photos
  const { data: photos, error } = await supabase
    .from('nhome_photos')
    .select('id, session_id, item_id, file_name, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error fetching photos:', error);
    return;
  }

  console.log('Recent nhome_photos entries:');
  photos?.forEach(p => {
    const sessionShort = p.session_id?.substring(0, 8) || 'N/A';
    const fileShort = p.file_name?.substring(0, 40) || 'N/A';
    console.log(`  ID: ${p.id}, session: ${sessionShort}..., item_id: ${p.item_id}, file: ${fileShort}`);
  });

  // Group by session_id + item_id to find duplicates
  const grouped: Record<string, number> = {};
  photos?.forEach(p => {
    const key = `${p.session_id}:${p.item_id}`;
    grouped[key] = (grouped[key] || 0) + 1;
  });

  const duplicates = Object.entries(grouped).filter(([k, v]) => v > 1);
  if (duplicates.length > 0) {
    console.log('\nDuplicate photos found (same session+item):');
    duplicates.forEach(([key, count]) => console.log(`  ${key}: ${count} photos`));
  } else {
    console.log('\nNo duplicate photos found in database.');
  }
}

check().catch(console.error);
