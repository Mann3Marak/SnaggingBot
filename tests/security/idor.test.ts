/**
 * IDOR (Insecure Direct Object Reference) Test Suite
 *
 * Tests verify that users cannot access resources belonging to other companies
 * by tampering with IDs in API requests.
 *
 * Security layers tested:
 * 1. RLS policies enforce company isolation
 * 2. Explicit ownership checks in API routes
 * 3. Information leakage prevention (404 instead of 403)
 *
 * Run with: npm run test:security:idor
 */

import { describe, test, expect, beforeAll } from '@jest/globals';

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

// Mock user credentials for two different companies
const COMPANY_A_USER = {
  email: process.env.TEST_COMPANY_A_EMAIL || 'inspector-a@company-a.com',
  password: process.env.TEST_COMPANY_A_PASSWORD || 'test-password',
  token: '', // Will be populated during setup
};

const COMPANY_B_USER = {
  email: process.env.TEST_COMPANY_B_EMAIL || 'inspector-b@company-b.com',
  password: process.env.TEST_COMPANY_B_PASSWORD || 'test-password',
  token: '', // Will be populated during setup
};

// Test resource IDs (will be populated during setup)
let COMPANY_A_APARTMENT_ID = '';
let COMPANY_B_APARTMENT_ID = '';
let COMPANY_A_SESSION_ID = '';
let COMPANY_B_SESSION_ID = '';

/**
 * Helper: Authenticate user and get token
 */
async function authenticate(email: string, password: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`Authentication failed for ${email}: ${response.statusText}`);
  }

  const data = await response.json();
  return data.token || data.access_token || '';
}

/**
 * Helper: Make authenticated API request
 */
async function authenticatedRequest(
  path: string,
  token: string,
  method: string = 'GET'
): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Setup: Authenticate test users and fetch resource IDs
 */
beforeAll(async () => {
  console.log('🔧 Setting up IDOR test suite...');

  // Authenticate both users
  COMPANY_A_USER.token = await authenticate(COMPANY_A_USER.email, COMPANY_A_USER.password);
  COMPANY_B_USER.token = await authenticate(COMPANY_B_USER.email, COMPANY_B_USER.password);

  console.log('✅ Users authenticated');

  // Fetch Company A's first apartment
  const companyAProfile = await authenticatedRequest('/api/portal/me', COMPANY_A_USER.token);
  const companyAData = await companyAProfile.json();
  COMPANY_A_APARTMENT_ID = companyAData.apartments?.[0]?.id || '';

  // Fetch Company B's first apartment
  const companyBProfile = await authenticatedRequest('/api/portal/me', COMPANY_B_USER.token);
  const companyBData = await companyBProfile.json();
  COMPANY_B_APARTMENT_ID = companyBData.apartments?.[0]?.id || '';

  console.log('✅ Resource IDs loaded');
  console.log(`   Company A Apartment: ${COMPANY_A_APARTMENT_ID}`);
  console.log(`   Company B Apartment: ${COMPANY_B_APARTMENT_ID}`);
}, 30000); // 30 second timeout for setup

describe('IDOR Prevention: Portal Endpoints', () => {
  test('User cannot access /api/portal/me without authentication', async () => {
    const response = await fetch(`${BASE_URL}/api/portal/me`);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  test('Company A user cannot access Company B apartment details', async () => {
    if (!COMPANY_B_APARTMENT_ID) {
      console.warn('⚠️ Skipping test: Company B apartment ID not available');
      return;
    }

    const response = await authenticatedRequest(
      `/api/portal/apartments/${COMPANY_B_APARTMENT_ID}`,
      COMPANY_A_USER.token
    );

    // Should return 404 (not 403) to avoid information leakage
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Apartment not found');
  });

  test('Company B user cannot access Company A apartment details', async () => {
    if (!COMPANY_A_APARTMENT_ID) {
      console.warn('⚠️ Skipping test: Company A apartment ID not available');
      return;
    }

    const response = await authenticatedRequest(
      `/api/portal/apartments/${COMPANY_A_APARTMENT_ID}`,
      COMPANY_B_USER.token
    );

    // Should return 404 (not 403) to avoid information leakage
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Apartment not found');
  });

  test('Invalid apartment ID returns 404', async () => {
    const invalidId = '00000000-0000-0000-0000-000000000000';

    const response = await authenticatedRequest(
      `/api/portal/apartments/${invalidId}`,
      COMPANY_A_USER.token
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Apartment not found');
  });

  test('Company A user cannot access Company B apartment snags', async () => {
    if (!COMPANY_B_APARTMENT_ID) {
      console.warn('⚠️ Skipping test: Company B apartment ID not available');
      return;
    }

    const response = await authenticatedRequest(
      `/api/portal/apartments/${COMPANY_B_APARTMENT_ID}/snags`,
      COMPANY_A_USER.token
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Apartment not found');
  });

  test('Company A user cannot access Company B apartment reports', async () => {
    if (!COMPANY_B_APARTMENT_ID) {
      console.warn('⚠️ Skipping test: Company B apartment ID not available');
      return;
    }

    const response = await authenticatedRequest(
      `/api/portal/apartments/${COMPANY_B_APARTMENT_ID}/reports`,
      COMPANY_A_USER.token
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Apartment not found');
  });

  test('Company A user can only see their own apartments in list', async () => {
    const response = await authenticatedRequest('/api/portal/apartments/list', COMPANY_A_USER.token);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.apartments).toBeDefined();
    expect(Array.isArray(data.apartments)).toBe(true);

    // Verify none of Company B's apartments appear in the list
    if (COMPANY_B_APARTMENT_ID) {
      const hasCompanyBApartment = data.apartments.some(
        (apt: any) => apt.id === COMPANY_B_APARTMENT_ID
      );
      expect(hasCompanyBApartment).toBe(false);
    }
  });

  test('Company B user can only see their own apartments in list', async () => {
    const response = await authenticatedRequest('/api/portal/apartments/list', COMPANY_B_USER.token);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.apartments).toBeDefined();
    expect(Array.isArray(data.apartments)).toBe(true);

    // Verify none of Company A's apartments appear in the list
    if (COMPANY_A_APARTMENT_ID) {
      const hasCompanyAApartment = data.apartments.some(
        (apt: any) => apt.id === COMPANY_A_APARTMENT_ID
      );
      expect(hasCompanyAApartment).toBe(false);
    }
  });
});

describe('IDOR Prevention: Internal Endpoints', () => {
  test('Unauthenticated request to /api/nhome/apartments/list returns 401', async () => {
    const response = await fetch(`${BASE_URL}/api/nhome/apartments/list`);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  test('Unauthenticated request to /api/nhome/inspections/create returns 401', async () => {
    const response = await fetch(`${BASE_URL}/api/nhome/inspections/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apartmentId: COMPANY_A_APARTMENT_ID }),
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  test('Admin-only endpoint rejects non-admin users', async () => {
    const response = await authenticatedRequest(
      '/api/nhome/fix-completed-sessions',
      COMPANY_A_USER.token,
      'POST'
    );

    // Should return 403 Forbidden if user is not admin
    expect([401, 403]).toContain(response.status);
  });
});

describe('Information Leakage Prevention', () => {
  test('All IDOR attempts return 404 (not 403) to avoid leaking resource existence', async () => {
    const testCases = [
      `/api/portal/apartments/${COMPANY_B_APARTMENT_ID}`,
      `/api/portal/apartments/${COMPANY_B_APARTMENT_ID}/snags`,
      `/api/portal/apartments/${COMPANY_B_APARTMENT_ID}/reports`,
    ];

    for (const path of testCases) {
      if (!COMPANY_B_APARTMENT_ID) continue;

      const response = await authenticatedRequest(path, COMPANY_A_USER.token);

      // Verify 404 (not 403) - this prevents attackers from discovering valid IDs
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Apartment not found');
    }
  });

  test('Malformed UUID returns 404 or 400 (not 500)', async () => {
    const malformedId = 'not-a-uuid';

    const response = await authenticatedRequest(
      `/api/portal/apartments/${malformedId}`,
      COMPANY_A_USER.token
    );

    // Should handle gracefully without exposing internal errors
    expect([400, 404]).toContain(response.status);
    expect(response.status).not.toBe(500);
  });
});

console.log('✅ IDOR test suite loaded');
console.log('📋 To run tests:');
console.log('   1. Set up test users in TEST_COMPANY_A_EMAIL and TEST_COMPANY_B_EMAIL env vars');
console.log('   2. Run: npm run test:security:idor');
console.log('   3. All tests should pass with 0 cross-tenant access');
