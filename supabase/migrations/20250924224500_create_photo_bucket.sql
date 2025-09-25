INSERT INTO storage.buckets (id, name, public)
VALUES ('nhome-inspection-photos', 'nhome-inspection-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;
