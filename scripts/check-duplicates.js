const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://aojewecjssqwkhtrcjim.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvamV3ZWNqc3Nxd2todHJjamltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTcyNzU1NywiZXhwIjoyMDc3MzAzNTU3fQ.b9A9_FsNj5ZzYULYQiE6FntWGSvmd0sSHcXu3GAy-Ro'
);

async function checkAndCleanDuplicates() {
  console.log('Checking for duplicates...');

  const { data: allResults, error } = await supabase
    .from('inspection_results')
    .select('session_id, item_id, id, created_at, status, notes');

  if (error) {
    console.error('Error fetching results:', error.message);
    return;
  }

  // Group by session_id + item_id
  const groups = {};
  (allResults || []).forEach(r => {
    const key = r.session_id + '|' + r.item_id;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });

  // Find duplicates
  const duplicateGroups = Object.entries(groups).filter(([k, v]) => v.length > 1);
  console.log('Found', duplicateGroups.length, 'duplicate groups');

  if (duplicateGroups.length === 0) {
    console.log('No duplicates found. Safe to add unique constraint.');
    return;
  }

  // Show some duplicates
  duplicateGroups.slice(0, 5).forEach(([key, items]) => {
    console.log('\nDuplicate group (item_id:', items[0].item_id.slice(0, 8) + '...)');
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    items.forEach((i, idx) => {
      const marker = idx === 0 ? '[KEEP]' : '[DELETE]';
      console.log('  ', marker, i.id.slice(0, 8), i.status, (i.notes || 'no notes').slice(0, 40));
    });
  });

  // Clean up duplicates - keep the most recent one
  console.log('\nCleaning up duplicates...');
  let deleted = 0;

  for (const [key, items] of duplicateGroups) {
    // Sort by created_at descending (most recent first)
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Delete all except the first (most recent)
    const toDelete = items.slice(1).map(i => i.id);

    const { error: deleteError } = await supabase
      .from('inspection_results')
      .delete()
      .in('id', toDelete);

    if (deleteError) {
      console.error('Error deleting duplicates:', deleteError.message);
    } else {
      deleted += toDelete.length;
    }
  }

  console.log('Deleted', deleted, 'duplicate records');
  console.log('Done! Now safe to add unique constraint.');
}

checkAndCleanDuplicates();
