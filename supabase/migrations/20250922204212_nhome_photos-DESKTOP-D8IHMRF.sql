-- NHome photos and sharing tables
CREATE TABLE IF NOT EXISTS nhome_inspection_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES inspection_sessions(id) ON DELETE CASCADE,
  item_id UUID REFERENCES checklist_templates(id),
  file_name TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  folder_path TEXT NOT NULL,
  metadata JSONB NOT NULL,
  company TEXT DEFAULT 'NHome Property Setup & Management',
  location TEXT DEFAULT 'Algarve, Portugal',
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  file_size INTEGER,
  image_dimensions TEXT,
  professional_watermark BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS nhome_sharing_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES inspection_sessions(id),
  client_email TEXT,
  share_url TEXT NOT NULL,
  shared_at TIMESTAMPTZ DEFAULT NOW(),
  shared_by TEXT NOT NULL,
  access_count INTEGER DEFAULT 0
);

ALTER TABLE nhome_inspection_photos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "NHome team can access photos" ON nhome_inspection_photos FOR ALL USING (
    EXISTS (
      SELECT 1 FROM inspection_sessions 
      WHERE inspection_sessions.id = nhome_inspection_photos.session_id 
        AND (
          inspection_sessions.inspector_id = auth.uid() OR 
          EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','manager')
          )
        )
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
