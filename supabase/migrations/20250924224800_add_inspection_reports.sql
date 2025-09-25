ALTER TABLE inspection_sessions
  ADD COLUMN IF NOT EXISTS report_url_pt text,
  ADD COLUMN IF NOT EXISTS report_url_en text,
  ADD COLUMN IF NOT EXISTS photo_package_url text,
  ADD COLUMN IF NOT EXISTS report_generated_at timestamptz;
