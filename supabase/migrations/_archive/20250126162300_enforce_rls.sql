-- First, ensure RLS is enabled
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Enable read access for own activities" ON activities;
DROP POLICY IF EXISTS "Enable create access for own activities" ON activities;
DROP POLICY IF EXISTS "Enable update access for own activities" ON activities;
DROP POLICY IF EXISTS "Enable delete access for own activities" ON activities;

-- Create strict policies for activities
CREATE POLICY "Enable read access for own activities"
  ON activities FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Enable create access for own activities"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Enable update access for own activities"
  ON activities FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Enable delete access for own activities"
  ON activities FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Verify no public access
REVOKE ALL ON activities FROM public;
GRANT ALL ON activities TO authenticated; 