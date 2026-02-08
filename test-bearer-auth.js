/**
 * Quick test script to verify Bearer token authentication
 * Run with: node test-bearer-auth.js
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3003';

async function testBearerAuth() {
  console.log('🧪 Testing Bearer Token Authentication\n');

  // Step 1: Login to get token
  console.log('Step 1: Logging in to get access token...');
  const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'inspector-a@company-a.com',
      password: 'TestPassword123!',
    }),
  });

  if (!loginResponse.ok) {
    console.error('❌ Login failed:', loginResponse.status, loginResponse.statusText);
    const error = await loginResponse.text();
    console.error('   Error:', error);
    return;
  }

  const loginData = await loginResponse.json();
  const token = loginData.token || loginData.access_token;

  if (!token) {
    console.error('❌ No token in login response');
    console.log('   Response:', loginData);
    return;
  }

  console.log('✅ Login successful');
  console.log(`   Token length: ${token.length}`);
  console.log(`   Token prefix: ${token.substring(0, 20)}...`);
  console.log(`   User: ${loginData.user?.email}`);
  console.log('');

  // Step 2: Use token to access protected endpoint
  console.log('Step 2: Accessing /api/portal/me with Bearer token...');
  const meResponse = await fetch(`${BASE_URL}/api/portal/me`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  console.log(`   Status: ${meResponse.status} ${meResponse.statusText}`);

  if (meResponse.ok) {
    const meData = await meResponse.json();
    console.log('✅ Bearer token authentication WORKS!');
    console.log(`   User: ${meData.user?.email}`);
    console.log(`   Company: ${meData.company?.name}`);
    console.log(`   Apartments: ${meData.apartmentsCount}`);
  } else {
    const errorData = await meResponse.json();
    console.error('❌ Bearer token authentication FAILED');
    console.error('   Error:', errorData);
  }

  console.log('\n📊 Check server logs for detailed trace');
}

testBearerAuth().catch(console.error);
