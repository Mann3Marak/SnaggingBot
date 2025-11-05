-- Add report-related columns to inspection_sessions table
-- This allows storing direct URLs to generated reports and photo packages

ALTER TABLE inspection_sessions
ADD COLUMN IF NOT EXISTS report_url_pt TEXT,
ADD COLUMN IF NOT EXISTS report_url_en TEXT,
ADD COLUMN IF NOT EXISTS photo_package_url TEXT,
ADD COLUMN IF NOT EXISTS report_generated_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN inspection_sessions.report_url_pt IS 'URL to the Portuguese language inspection report PDF';
COMMENT ON COLUMN inspection_sessions.report_url_en IS 'URL to the English language inspection report PDF';
COMMENT ON COLUMN inspection_sessions.photo_package_url IS 'URL to the ZIP file containing all inspection photos';
COMMENT ON COLUMN inspection_sessions.report_generated_at IS 'Timestamp when the reports were last generated';

-- Create index for faster lookups of sessions with generated reports
CREATE INDEX IF NOT EXISTS idx_inspection_sessions_report_generated
ON inspection_sessions(report_generated_at DESC)
WHERE report_generated_at IS NOT NULL;
