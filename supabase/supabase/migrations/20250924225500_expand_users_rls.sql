DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users read self') THEN
    DROP POLICY "users read self" ON users;
  END IF;
END $$;

CREATE POLICY "users read self" ON users
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "users roster visibility" ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users AS me
      WHERE me.id = auth.uid()
        AND me.company_id = users.company_id
        AND me.role IN ('admin', 'manager')
    )
  );
