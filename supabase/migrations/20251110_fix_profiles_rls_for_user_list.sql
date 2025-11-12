-- Fix profiles RLS to allow authenticated users to read all profiles
-- This is needed for user dropdowns, filters, and the Deal Health dashboard

-- Drop the restrictive policy that only allows users to read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;

-- Create a new policy that allows authenticated users to read all profiles
-- This is safe because profile information (names, emails) should be visible to team members
CREATE POLICY "Authenticated users can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Keep the update policy restrictive (users can only update their own profile)
-- This policy should already exist, but we'll recreate it to be sure
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
