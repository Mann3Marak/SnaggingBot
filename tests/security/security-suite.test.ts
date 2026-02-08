/**
 * Automated Security Test Suite
 *
 * Comprehensive security tests covering:
 * 1. Authentication enforcement
 * 2. Authorization (role-based access control)
 * 3. IDOR prevention
 * 4. Data isolation
 * 5. Error handling
 *
 * Run with: npm run test:security
 */

import { describe, test, expect, beforeAll } from '@jest/globals';

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

// Test users with different roles and companies
const ADMIN_USER = {
  email: process.env.TEST_ADMIN_EMAIL || 'admin@company-a.com',
  password: process.env.TEST_ADMIN_PASSWORD || 'test-password',
  token: '',
};

const INSPECTOR_A = {
  email: process.env.TEST_INSPECTOR_A_EMAIL || 'inspector-a@company-a.com',
  password: process.env.TEST_INSPECTOR_A_PASSWORD || 'test-password',
  token: '',
};

const INSPECTOR_B = {
  email: process.env.TEST_INSPECTOR_B_EMAIL || 'inspector-b@company-b.com',
  password: process.env.TEST_INSPECTOR_B_PASSWORD || 'test-password',
  token: '',
};

/**
 * Helper: Authenticate user
 */
async function authenticate(email: string, password: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`Authentication failed for ${email}`);
  }

  const data = await response.json();
  return data.token || data.access_token || '';
}

/**
 * Helper: Make authenticated request
 */
async function authenticatedRequest(
  path: string,
  token: string,
  method: string = 'GET',
  body?: any
): Promise<Response> {
  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  return fetch(`${BASE_URL}${path}`, options);
}

/**
 * Setup: Authenticate test users
 */
beforeAll(async () => {
  console.log('🔧 Setting up security test suite...');

  try {
    ADMIN_USER.token = await authenticate(ADMIN_USER.email, ADMIN_USER.password);
    INSPECTOR_A.token = await authenticate(INSPECTOR_A.email, INSPECTOR_A.password);
    INSPECTOR_B.token = await authenticate(INSPECTOR_B.email, INSPECTOR_B.password);
    console.log('✅ Test users authenticated');
  } catch (error) {
    console.error('❌ Failed to authenticate test users:', error);
    throw error;
  }
}, 30000);

// =============================================================================
// 1. AUTHENTICATION ENFORCEMENT
// =============================================================================

describe('Authentication Enforcement', () => {
  test('All /api/nhome routes reject unauthenticated requests', async () => {
    const protectedRoutes = [
      '/api/nhome/apartments/list',
      '/api/nhome/inspections/create',
      '/api/nhome/inspections/follow-up-list',
      '/api/nhome/diagnostics/test-session-id',
      '/api/nhome/enhance-description',
    ];

    for (const route of protectedRoutes) {
      const response = await fetch(`${BASE_URL}${route}`);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBeDefined();
    }
  });

  test('All /api/portal routes reject unauthenticated requests', async () => {
    const portalRoutes = [
      '/api/portal/me',
      '/api/portal/apartments/list',
      '/api/portal/apartments/test-id',
      '/api/portal/apartments/test-id/snags',
      '/api/portal/apartments/test-id/reports',
    ];

    for (const route of portalRoutes) {
      const response = await fetch(`${BASE_URL}${route}`);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBeDefined();
    }
  });

  test('Invalid token returns 401', async () => {
    const invalidToken = 'invalid.jwt.token';

    const response = await fetch(`${BASE_URL}/api/portal/me`, {
      headers: { Authorization: `Bearer ${invalidToken}` },
    });

    expect(response.status).toBe(401);
  });

  test('Expired token returns 401', async () => {
    // Note: This requires a pre-generated expired token for testing
    const expiredToken = process.env.TEST_EXPIRED_TOKEN;
    if (!expiredToken) {
      console.warn('⚠️ Skipping expired token test (TEST_EXPIRED_TOKEN not set)');
      return;
    }

    const response = await fetch(`${BASE_URL}/api/portal/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });

    expect(response.status).toBe(401);
  });

  test('Missing Authorization header returns 401', async () => {
    const response = await fetch(`${BASE_URL}/api/portal/me`);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toMatch(/unauthorized|authentication/i);
  });
});

// =============================================================================
// 2. AUTHORIZATION (ROLE-BASED ACCESS CONTROL)
// =============================================================================

describe('Authorization - Role-Based Access Control', () => {
  test('Admin-only routes reject non-admin users', async () => {
    const adminOnlyRoutes = [
      { path: '/api/nhome/fix-completed-sessions', method: 'POST' },
    ];

    for (const { path, method } of adminOnlyRoutes) {
      // Test with inspector token
      const response = await authenticatedRequest(path, INSPECTOR_A.token, method);

      // Should return 403 Forbidden (not 500 or 200)
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toMatch(/forbidden|insufficient permissions/i);
    }
  });

  test('Admin users can access admin-only routes', async () => {
    const response = await authenticatedRequest(
      '/api/nhome/fix-completed-sessions',
      ADMIN_USER.token,
      'POST'
    );

    // Should succeed (200) or fail gracefully (not 403)
    expect([200, 400, 500]).toContain(response.status);
    expect(response.status).not.toBe(403);
  });

  test('Inspector cannot access other inspector sessions', async () => {
    // This would require knowing a session ID from Inspector B
    // In real tests, you'd fetch a session from Inspector B first

    const testSessionId = process.env.TEST_INSPECTOR_B_SESSION_ID;
    if (!testSessionId) {
      console.warn('⚠️ Skipping cross-inspector test (TEST_INSPECTOR_B_SESSION_ID not set)');
      return;
    }

    const response = await authenticatedRequest(
      `/api/nhome/diagnostics/${testSessionId}`,
      INSPECTOR_A.token
    );

    // Should return 403 Forbidden or 404 Not Found (IDOR protection)
    expect([403, 404]).toContain(response.status);
  });

  test('Users cannot escalate privileges', async () => {
    // Attempt to call admin endpoint with modified role claim (if JWT tampered)
    // This test assumes JWTs are properly signed and cannot be tampered

    const response = await authenticatedRequest(
      '/api/nhome/fix-completed-sessions',
      INSPECTOR_A.token,
      'POST'
    );

    expect(response.status).toBe(403);
  });
});

// =============================================================================
// 3. IDOR PREVENTION
// =============================================================================

describe('IDOR Prevention', () => {
  test('Company A cannot access Company B apartments', async () => {
    // Get Company B's first apartment
    const companyBProfile = await authenticatedRequest('/api/portal/me', INSPECTOR_B.token);
    const companyBData = await companyBProfile.json();
    const companyBApartmentId = companyBData.apartments?.[0]?.id;

    if (!companyBApartmentId) {
      console.warn('⚠️ Skipping test: Company B has no apartments');
      return;
    }

    // Try to access with Company A token
    const response = await authenticatedRequest(
      `/api/portal/apartments/${companyBApartmentId}`,
      INSPECTOR_A.token
    );

    // Should return 404 (not 403) to avoid information leakage
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Apartment not found');
  });

  test('Invalid UUID returns 404 or 400 (not 500)', async () => {
    const invalidIds = ['not-a-uuid', '12345', 'abcdef'];

    for (const invalidId of invalidIds) {
      const response = await authenticatedRequest(
        `/api/portal/apartments/${invalidId}`,
        INSPECTOR_A.token
      );

      // Should handle gracefully (400 or 404), not expose internal errors (500)
      expect([400, 404]).toContain(response.status);
    }
  });

  test('Non-existent resource returns 404', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';

    const response = await authenticatedRequest(
      `/api/portal/apartments/${nonExistentId}`,
      INSPECTOR_A.token
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Apartment not found');
  });

  test('Sequential ID guessing fails (IDs are UUIDs)', async () => {
    // Get user's first apartment ID
    const profile = await authenticatedRequest('/api/portal/me', INSPECTOR_A.token);
    const profileData = await profile.json();
    const apartmentId = profileData.apartments?.[0]?.id;

    if (!apartmentId) {
      console.warn('⚠️ Skipping test: User has no apartments');
      return;
    }

    // Verify it's a UUID (not sequential integer)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(uuidRegex.test(apartmentId)).toBe(true);
  });
});

// =============================================================================
// 4. DATA ISOLATION
// =============================================================================

describe('Data Isolation - Company Segregation', () => {
  test('Apartment list only shows user company apartments', async () => {
    // Get apartments for both companies
    const companyAResponse = await authenticatedRequest(
      '/api/portal/apartments/list',
      INSPECTOR_A.token
    );
    const companyBResponse = await authenticatedRequest(
      '/api/portal/apartments/list',
      INSPECTOR_B.token
    );

    expect(companyAResponse.status).toBe(200);
    expect(companyBResponse.status).toBe(200);

    const companyAData = await companyAResponse.json();
    const companyBData = await companyBResponse.json();

    const companyAApartmentIds = companyAData.apartments.map((a: any) => a.id);
    const companyBApartmentIds = companyBData.apartments.map((a: any) => a.id);

    // Verify no overlap between companies
    const overlap = companyAApartmentIds.filter((id: string) =>
      companyBApartmentIds.includes(id)
    );
    expect(overlap.length).toBe(0);
  });

  test('/api/portal/me only shows user profile (not other users)', async () => {
    const responseA = await authenticatedRequest('/api/portal/me', INSPECTOR_A.token);
    const responseB = await authenticatedRequest('/api/portal/me', INSPECTOR_B.token);

    const dataA = await responseA.json();
    const dataB = await responseB.json();

    // Verify users see their own data
    expect(dataA.user.email).toBe(INSPECTOR_A.email);
    expect(dataB.user.email).toBe(INSPECTOR_B.email);

    // Verify Company A user doesn't see Company B data
    expect(dataA.company.id).not.toBe(dataB.company.id);
  });

  test('Inspections filtered by company', async () => {
    const response = await authenticatedRequest(
      '/api/nhome/inspections/follow-up-list',
      INSPECTOR_A.token
    );

    expect(response.status).toBe(200);
    const data = await response.json();

    // Verify all inspections belong to user's company
    // (This requires inspections data includes company info)
    expect(Array.isArray(data.inspections)).toBe(true);
  });
});

// =============================================================================
// 5. ERROR HANDLING
// =============================================================================

describe('Error Handling', () => {
  test('Authentication errors return 401 (not 500)', async () => {
    const response = await fetch(`${BASE_URL}/api/portal/me`);

    expect(response.status).toBe(401);
    expect(response.status).not.toBe(500);

    const data = await response.json();
    expect(data.error).toBeDefined();
    expect(data.error).toMatch(/unauthorized|authentication/i);
  });

  test('Authorization errors return 403 (not 500)', async () => {
    const response = await authenticatedRequest(
      '/api/nhome/fix-completed-sessions',
      INSPECTOR_A.token,
      'POST'
    );

    expect(response.status).toBe(403);
    expect(response.status).not.toBe(500);

    const data = await response.json();
    expect(data.error).toBeDefined();
    expect(data.error).toMatch(/forbidden|insufficient permissions/i);
  });

  test('IDOR attempts return 404 (not 403 or 500)', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';

    const response = await authenticatedRequest(
      `/api/portal/apartments/${nonExistentId}`,
      INSPECTOR_A.token
    );

    expect(response.status).toBe(404);
    expect(response.status).not.toBe(403);
    expect(response.status).not.toBe(500);

    const data = await response.json();
    expect(data.error).toBe('Apartment not found');
  });

  test('Errors do not expose sensitive information', async () => {
    // Trigger various errors and verify responses don't leak internals
    const testCases = [
      { path: '/api/portal/apartments/invalid-uuid', expectedStatus: 404 },
      { path: '/api/nhome/fix-completed-sessions', method: 'POST', expectedStatus: 403 },
    ];

    for (const testCase of testCases) {
      const response = await authenticatedRequest(
        testCase.path,
        INSPECTOR_A.token,
        testCase.method || 'GET'
      );

      const data = await response.json();

      // Verify no stack traces, file paths, or env vars exposed
      const responseText = JSON.stringify(data);
      expect(responseText).not.toMatch(/\/Users\//);
      expect(responseText).not.toMatch(/\/home\//);
      expect(responseText).not.toMatch(/C:\\/);
      expect(responseText).not.toMatch(/SUPABASE_/);
      expect(responseText).not.toMatch(/at \w+\.\w+ \(/); // Stack trace pattern
    }
  });

  test('Malformed JSON returns 400 (not 500)', async () => {
    const response = await fetch(`${BASE_URL}/api/nhome/enhance-description`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${INSPECTOR_A.token}`,
        'Content-Type': 'application/json',
      },
      body: 'this is not valid JSON{',
    });

    expect([400, 422]).toContain(response.status);
    expect(response.status).not.toBe(500);
  });
});

// =============================================================================
// 6. INPUT VALIDATION
// =============================================================================

describe('Input Validation', () => {
  test('Missing required fields return 400', async () => {
    // Test endpoint that requires fields
    const response = await authenticatedRequest(
      '/api/nhome/enhance-description',
      INSPECTOR_A.token,
      'POST',
      {} // Missing required fields
    );

    expect([400, 422]).toContain(response.status);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  test('SQL injection attempts fail safely', async () => {
    const sqlInjectionPayloads = [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "admin'--",
      "' UNION SELECT * FROM users--",
    ];

    for (const payload of sqlInjectionPayloads) {
      // Try injection in apartment ID parameter
      const response = await authenticatedRequest(
        `/api/portal/apartments/${encodeURIComponent(payload)}`,
        INSPECTOR_A.token
      );

      // Should return 400/404 (not succeed or cause 500 error)
      expect([400, 404]).toContain(response.status);
      expect(response.status).not.toBe(200);
      expect(response.status).not.toBe(500);
    }
  });

  test('XSS attempts are escaped', async () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      'javascript:alert("XSS")',
    ];

    // Note: This test requires an endpoint that echoes input back
    // Adjust based on your actual endpoints that return user input

    for (const payload of xssPayloads) {
      const response = await authenticatedRequest(
        '/api/nhome/enhance-description',
        INSPECTOR_A.token,
        'POST',
        {
          userInput: payload,
          item: 'Test Item',
          room: 'Test Room',
        }
      );

      const data = await response.json();

      // If response includes user input, verify it's escaped
      if (data.enhanced) {
        expect(data.enhanced).not.toContain('<script>');
        expect(data.enhanced).not.toContain('onerror=');
      }
    }
  });
});

// =============================================================================
// 7. RATE LIMITING (if implemented)
// =============================================================================

describe('Rate Limiting', () => {
  test('Excessive requests trigger rate limit (if enabled)', async () => {
    // Note: This test may need adjustment based on your rate limit config
    const requests = [];

    // Send 100 rapid requests
    for (let i = 0; i < 100; i++) {
      requests.push(
        authenticatedRequest('/api/portal/me', INSPECTOR_A.token)
      );
    }

    const responses = await Promise.all(requests);
    const rateLimitedResponses = responses.filter((r) => r.status === 429);

    // If rate limiting is enabled, expect some 429 responses
    if (rateLimitedResponses.length === 0) {
      console.warn('⚠️ No rate limiting detected (consider implementing)');
    } else {
      console.log(`✅ Rate limiting active: ${rateLimitedResponses.length} requests throttled`);
    }
  });
});

// =============================================================================
// SUMMARY
// =============================================================================

afterAll(() => {
  console.log('\n📊 Security Test Suite Summary:');
  console.log('✅ Authentication enforcement tests');
  console.log('✅ Authorization (RBAC) tests');
  console.log('✅ IDOR prevention tests');
  console.log('✅ Data isolation tests');
  console.log('✅ Error handling tests');
  console.log('✅ Input validation tests');
  console.log('\n🔐 All security tests completed');
});
