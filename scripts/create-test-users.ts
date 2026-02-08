/**
 * Create test users for security testing
 *
 * Usage:
 *   npm run test:setup
 *
 * Requirements:
 *   - NEXT_PUBLIC_SUPABASE_URL in .env.local
 *   - SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// Test user configuration
const TEST_USERS = [
  {
    email: 'inspector-a@company-a.com',
    password: 'TestPassword123!',
    company_id: '11111111-1111-1111-1111-111111111111',
    company_name: 'Test Company A',
    role: 'inspector',
    full_name: 'Inspector A',
  },
  {
    email: 'admin@company-a.com',
    password: 'TestPassword123!',
    company_id: '11111111-1111-1111-1111-111111111111',
    company_name: 'Test Company A',
    role: 'admin',
    full_name: 'Admin A',
  },
  {
    email: 'inspector-b@company-b.com',
    password: 'TestPassword123!',
    company_id: '22222222-2222-2222-2222-222222222222',
    company_name: 'Test Company B',
    role: 'inspector',
    full_name: 'Inspector B',
  },
];

async function createTestUsers() {
  console.log('🔧 Creating test users for security testing...\n');

  // Load environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing environment variables:');
    console.error('   - NEXT_PUBLIC_SUPABASE_URL');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    console.error('\nEnsure these are set in .env.local');
    process.exit(1);
  }

  // Create Supabase admin client
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('✅ Connected to Supabase\n');

  // First, seed the test companies and projects
  console.log('📦 Seeding test companies and projects...');
  try {
    // Create companies
    const { error: companyError } = await supabase.from('companies').upsert([
      { id: '11111111-1111-1111-1111-111111111111', name: 'Test Company A' },
      { id: '22222222-2222-2222-2222-222222222222', name: 'Test Company B' },
    ]);
    if (companyError) throw new Error(`Companies: ${companyError.message}`);

    // Create projects
    const { error: projectError } = await supabase.from('projects').upsert([
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'Test Project A',
        developer_name: 'Test Developer A',
        address: 'Algarve, Portugal',
        company_id: '11111111-1111-1111-1111-111111111111',
      },
      {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        name: 'Test Project B',
        developer_name: 'Test Developer B',
        address: 'Algarve, Portugal',
        company_id: '22222222-2222-2222-2222-222222222222',
      },
    ]);
    if (projectError) throw new Error(`Projects: ${projectError.message}`);

    // Create apartments
    const { error: apartmentError } = await supabase.from('apartments').upsert([
      {
        id: 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
        project_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        unit_number: '101',
        apartment_type: 'T2',
        floor_number: 1,
      },
      {
        id: 'a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2',
        project_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        unit_number: '102',
        apartment_type: 'T3',
        floor_number: 1,
      },
      {
        id: 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1',
        project_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        unit_number: '201',
        apartment_type: 'T2',
        floor_number: 2,
      },
      {
        id: 'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2',
        project_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        unit_number: '202',
        apartment_type: 'T3',
        floor_number: 2,
      },
    ]);
    if (apartmentError) throw new Error(`Apartments: ${apartmentError.message}`);

    console.log('✅ Test data seeded\n');
  } catch (error: any) {
    console.error('❌ Failed to seed test data:', error.message);
    process.exit(1);
  }

  // Create each test user
  for (const user of TEST_USERS) {
    console.log(`👤 Creating user: ${user.email}`);

    try {
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true, // Auto-confirm email for testing
      });

      if (authError) {
        // Check if user already exists
        if (authError.message.includes('already been registered') || authError.message.includes('already registered')) {
          console.log(`   ⚠️  User already exists, upserting profile...`);

          // Find existing user in auth
          const { data: authUser } = await supabase.auth.admin.listUsers();
          const existingAuth = authUser?.users.find(u => u.email === user.email);

          if (!existingAuth) {
            console.log(`   ❌ Could not find existing user in auth`);
            continue;
          }

          // Upsert profile (insert or update)
          const { error: upsertError } = await supabase
            .from('users')
            .upsert({
              id: existingAuth.id,
              email: user.email,
              company_id: user.company_id,
              role: user.role,
              full_name: user.full_name,
            }, {
              onConflict: 'id'
            });

          if (upsertError) {
            console.log(`   ❌ Failed to upsert profile: ${upsertError.message}`);
          } else {
            console.log(`   ✅ Profile upserted`);
          }
          continue;
        }

        console.log(`   ❌ Failed to create user: ${authError.message}`);
        continue;
      }

      if (!authData.user) {
        console.log(`   ❌ User created but no user data returned`);
        continue;
      }

      console.log(`   ✅ Auth user created (ID: ${authData.user.id})`);

      // Insert user profile (trigger doesn't auto-create it)
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: user.email,
          company_id: user.company_id,
          role: user.role,
          full_name: user.full_name,
        });

      if (profileError) {
        console.log(`   ⚠️  Failed to insert profile: ${profileError.message}`);
        console.log(`   ℹ️  You may need to update manually in Supabase Dashboard`);
      } else {
        console.log(`   ✅ Profile updated (Company: ${user.company_name}, Role: ${user.role})`);
      }

      console.log('');
    } catch (error: any) {
      console.log(`   ❌ Unexpected error: ${error.message}\n`);
    }
  }

  // Verify test users
  console.log('🔍 Verifying test users...\n');
  for (const user of TEST_USERS) {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, role, company_id, companies(name)')
      .eq('email', user.email)
      .maybeSingle();

    if (error || !data) {
      console.log(`❌ ${user.email}: Not found or error`);
    } else {
      console.log(`✅ ${user.email}`);
      console.log(`   Role: ${data.role}`);
      console.log(`   Company: ${(data.companies as any)?.name || 'Unknown'}`);
    }
  }

  console.log('\n✨ Test user creation complete!\n');
  console.log('📋 Test credentials:');
  console.log('   - inspector-a@company-a.com / TestPassword123! (Company A, Inspector)');
  console.log('   - admin@company-a.com / TestPassword123! (Company A, Admin)');
  console.log('   - inspector-b@company-b.com / TestPassword123! (Company B, Inspector)');
  console.log('\n🧪 Run security tests with: npm run test:security\n');
}

// Run the script
createTestUsers().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
