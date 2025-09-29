# NHome Flow Gaps

## Inspector Journey
- [x] Landing CTA now routes to /dashboard so inspectors pass through the guided view instead of jumping directly to /inspection/start (src/app/page.tsx:62, middleware.ts:10).
- [x] Dashboard now surfaces quick actions and a zero-state CTA so inspectors can launch work instead of landing on an empty grid (src/app/dashboard/page.tsx:12, src/app/dashboard/page.tsx:44).
- [x] Inspection type selection is now stored on each session and reused downstream (new column + insert/update in src/components/inspection/NHomeInspectionStart.tsx, supabase/migrations/20250924223000_add_inspection_type_to_sessions.sql).
- [ ] Voice/photo workflows now offer in-app links to switch between modes so inspectors know where to capture extended media (`src/app/inspection/nhome/[sessionId]/page.tsx`, `src/components/inspection/NHomeVoiceInspectionWithPhotos.tsx`).
- [ ] Photo uploads now stream to Supabase storage + metadata tables, reports persist via `/api/nhome/inspections/save-reports`, and report data includes stored photos (`src/services/nhomePhotoUploadService.ts`, `src/app/api/nhome/photos/upload/route.ts`, `src/app/api/nhome/inspections/save-reports/route.ts`, `src/app/api/nhome/inspections/[sessionId]/report-data/route.ts`, `supabase/migrations/20250924224500_create_photo_bucket.sql`, `supabase/migrations/20250924224800_add_inspection_reports.sql`).

## Admin Journey
- [ ] Admin/manager roles can now read their company roster thanks to the updated RLS policy (`supabase/migrations/20250924225500_expand_users_rls.sql`).
- [ ] Admins can now invite team members via a service-backed endpoint that provisions auth users and syncs profiles (`src/app/api/admin/team/invite/route.ts`, `src/components/admin/NHomeAdminDashboard.tsx`).
- [ ] Admin dashboard metrics now derive from real inspection data (quality averages, revenue trends, satisfaction proxy) instead of placeholders (`src/components/admin/NHomeAdminDashboard.tsx`).
- [ ] Middleware now guards /admin before data loading and redirects unauthenticated visitors immediately (middleware.ts:3, middleware.ts:18).

## Client Delivery
- [ ] Final report generation now persists URLs via `/api/nhome/inspections/save-reports` and surfaces errors when the save fails (`src/components/reports/NHomeReportGenerator.tsx:102`, `src/app/api/nhome/inspections/save-reports/route.ts:3`).
- [ ] Photo package sharing now uses Supabase storage + a share endpoint so inspectors receive a real share link (`src/app/api/nhome/photos/upload/route.ts`, `src/app/api/nhome/photos/share/route.ts`, `src/services/nhomePhotoUploadService.ts`).
- [ ] Email delivery now provides loading/error feedback in the report generator and surfaces API errors back to the user (`src/components/reports/NHomeReportGenerator.tsx`).
- [ ] Client portal now lives at /inspection/share/[token], showing reports, photo packages, and visit tracking pulled from Supabase share logs (src/app/inspection/share/[token]/page.tsx:1).

## Cross-Cutting
- [x] Critical integrations now validate env upfront via a shared helper so OpenAI voice, Microsoft Graph, and SMTP fail fast with clear errors (src/lib/env.ts:1, src/app/api/voice/token/route.ts:1, src/lib/nhome-onedrive-manager.ts:1, src/app/api/nhome/send-professional-report-email/route.ts:1).
- [x] Sign-up flow now boots a Supabase `users` row via a service API so admin dashboards get data immediately (`src/app/api/auth/nhome-bootstrap-profile/route.ts:1`, `src/components/auth/NHomeAuthForm.tsx:29`).
- [x] `/reports` now lists the latest generated packages with quick links to reports, photos, and share history (`src/app/reports/page.tsx:1`, `src/app/api/nhome/reports/route.ts:1`).
- [x] Cleaned corrupted glyphs so inspector and report UIs read professionally again (`src/components/inspection/NHomeInspectionStart.tsx:120`, `src/components/reports/NHomeReportGenerator.tsx:268`, `src/components/auth/NHomeAuthForm.tsx:44`).
