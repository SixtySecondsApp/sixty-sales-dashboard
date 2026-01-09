/*
  # Fix RLS policies to enforce strict user-level access

  1. Changes
    - Remove admin and team-based access
    - Enforce strict user-level access for all tables
    - Update existing policies to only allow users to see their own data

  2. Security
    - Users can only see and modify their own data
    - Remove team-based access for now
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own profile or admins can read all" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile or admins can update all" ON profiles;
DROP POLICY IF EXISTS "Users can read own activities or admins can read all" ON activities;
DROP POLICY IF EXISTS "Users can read own targets or admins can read all" ON targets;
DROP POLICY IF EXISTS "Enable profile access" ON profiles;
DROP POLICY IF EXISTS "Enable activity access" ON activities;
DROP POLICY IF EXISTS "Enable target access" ON targets;

-- Create strict user-level policies for profiles
CREATE POLICY "Users can only read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can only update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- Create strict user-level policies for activities
CREATE POLICY "Users can only read own activities"
  ON activities FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can only create own activities"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can only update own activities"
  ON activities FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can only delete own activities"
  ON activities FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create strict user-level policies for targets
CREATE POLICY "Users can only read own targets"
  ON targets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can only create own targets"
  ON targets FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can only update own targets"
  ON targets FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE targets ENABLE ROW LEVEL SECURITY; 