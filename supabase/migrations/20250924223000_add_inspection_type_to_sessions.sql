ALTER TABLE inspection_sessions
  ADD COLUMN IF NOT EXISTS inspection_type text CHECK (inspection_type IN ('initial', 'follow_up')) DEFAULT 'initial';

UPDATE inspection_sessions
  SET inspection_type = 'initial'
  WHERE inspection_type IS NULL;

ALTER TABLE inspection_sessions
  ALTER COLUMN inspection_type SET NOT NULL;
