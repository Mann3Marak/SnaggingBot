-- Test users for security testing
-- Run with: supabase db seed --file supabase/seeds/test-users.sql

-- Create test companies
INSERT INTO companies (id, name, created_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Test Company A', NOW()),
  ('22222222-2222-2222-2222-222222222222', 'Test Company B', NOW())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Create test projects for each company
INSERT INTO projects (id, name, location, company_id, created_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Project A', 'Algarve, Portugal', '11111111-1111-1111-1111-111111111111', NOW()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Test Project B', 'Algarve, Portugal', '22222222-2222-2222-2222-222222222222', NOW())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Create test apartments
INSERT INTO apartments (id, project_id, unit_number, apartment_type, floor, bedrooms, bathrooms, created_at) VALUES
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '101', 'T2', 1, 2, 2, NOW()),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '102', 'T3', 1, 3, 2, NOW()),
  ('b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '201', 'T2', 2, 2, 2, NOW()),
  ('b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '202', 'T3', 2, 3, 2, NOW())
ON CONFLICT (id) DO UPDATE SET unit_number = EXCLUDED.unit_number;

-- Note: Test users must be created via Supabase Auth (not directly in database)
-- Use the following credentials after creating users in Supabase Dashboard or via signup:

-- Company A Users:
-- Email: inspector-a@company-a.com
-- Password: TestPassword123!
-- Company ID: 11111111-1111-1111-1111-111111111111
-- Role: inspector

-- Email: admin@company-a.com
-- Password: TestPassword123!
-- Company ID: 11111111-1111-1111-1111-111111111111
-- Role: admin

-- Company B Users:
-- Email: inspector-b@company-b.com
-- Password: TestPassword123!
-- Company ID: 22222222-2222-2222-2222-222222222222
-- Role: inspector

-- After creating users in Supabase Auth Dashboard, update their profiles:
-- UPDATE users
-- SET company_id = '11111111-1111-1111-1111-111111111111', role = 'inspector', full_name = 'Inspector A'
-- WHERE email = 'inspector-a@company-a.com';

-- UPDATE users
-- SET company_id = '11111111-1111-1111-1111-111111111111', role = 'admin', full_name = 'Admin A'
-- WHERE email = 'admin@company-a.com';

-- UPDATE users
-- SET company_id = '22222222-2222-2222-2222-222222222222', role = 'inspector', full_name = 'Inspector B'
-- WHERE email = 'inspector-b@company-b.com';

-- Verify test data:
-- SELECT u.id, u.email, u.role, u.company_id, c.name as company_name
-- FROM users u
-- LEFT JOIN companies c ON c.id = u.company_id
-- WHERE u.email LIKE '%company-%';

-- SELECT id, unit_number, apartment_type, project_id
-- FROM apartments
-- WHERE project_id IN ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
