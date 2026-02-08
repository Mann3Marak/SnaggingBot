/**
 * Check if test data exists in the database
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

// Create admin client (bypasses RLS)
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function checkData() {
  console.log('🔍 Checking test data in database...\n');

  // Check companies
  const { data: companies, error: compError } = await supabase
    .from('companies')
    .select('*')
    .in('id', [
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
    ]);

  console.log(`📦 Companies: ${companies?.length || 0}`);
  companies?.forEach(c => console.log(`   - ${c.name} (${c.id})`));

  // Check projects
  const { data: projects, error: projError } = await supabase
    .from('projects')
    .select('*')
    .in('id', [
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    ]);

  console.log(`\n📂 Projects: ${projects?.length || 0}`);
  projects?.forEach(p => console.log(`   - ${p.name} (${p.id}, Company: ${p.company_id})`));

  // Check apartments
  const { data: apartments, error: aptError } = await supabase
    .from('apartments')
    .select('*, projects(name, company_id)')
    .in('id', [
      'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
      'a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2',
      'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1',
      'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2',
    ]);

  console.log(`\n🏢 Apartments: ${apartments?.length || 0}`);
  apartments?.forEach(a => {
    const project = a.projects;
    console.log(`   - Unit ${a.unit_number} in ${project?.name} (Company: ${project?.company_id})`);
  });

  if (aptError) {
    console.error('\n❌ Apartment query error:', aptError);
  }
}

checkData().catch(console.error);
