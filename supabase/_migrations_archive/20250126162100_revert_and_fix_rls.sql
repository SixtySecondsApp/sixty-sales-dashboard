/*
  # Revert strict RLS and implement better access control

  1. Changes
    - Revert previous strict policies
    - Implement proper user-level access while maintaining functionality
    - Keep admin access for management purposes

  2. Security
    - Users can see and modify their own data
    - Admins retain necessary access
    - Activities visible to their creators
*/

-- Add avatar_url column to activities table
ALTER TABLE activities ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Drop strict policies
DROP POLICY IF EXISTS "Users can only read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can only update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can only read own activities" ON activities;
DROP POLICY IF EXISTS "Users can only create own activities" ON activities;
DROP POLICY IF EXISTS "Users can only update own activities" ON activities;
DROP POLICY IF EXISTS "Users can only delete own activities" ON activities;
DROP POLICY IF EXISTS "Users can only read own targets" ON targets;
DROP POLICY IF EXISTS "Users can only create own targets" ON targets;
DROP POLICY IF EXISTS "Users can only update own targets" ON targets;

-- Recreate balanced access policies
CREATE POLICY "Enable read access for own profile and admins"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Enable update access for own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- Activities policies
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

-- Targets policies
CREATE POLICY "Enable read access for own targets"
  ON targets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Enable create access for own targets"
  ON targets FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Enable update access for own targets"
  ON targets FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Ensure RLS is enabled with proper defaults
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE targets ENABLE ROW LEVEL SECURITY; 