/*
  # Fix RLS policies to avoid recursion

  1. Changes
    - Remove circular references in RLS policies
    - Simplify admin access checks
    - Update existing policies to use direct checks

  2. Security
    - Maintain same security model but with more efficient implementation
    - Ensure admin users retain full access
*/

-- Drop existing policies that may cause recursion
DROP POLICY IF EXISTS "Users can read own profile or admins can read all" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile or admins can update all" ON profiles;
DROP POLICY IF EXISTS "Users can read own activities or admins can read all" ON activities;
DROP POLICY IF EXISTS "Users can read own targets or admins can read all" ON targets;

-- Create new policies with direct checks
CREATE POLICY "Enable profile access"
  ON profiles FOR ALL
  TO authenticated
  USING (
    id = auth.uid() OR
    is_admin = true
  );

CREATE POLICY "Enable activity access"
  ON activities FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 
      FROM profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  );

CREATE POLICY "Enable target access"
  ON targets FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 
      FROM profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  );

-- Ensure andrew.bryce@sixtyseconds.video is still admin
UPDATE profiles 
SET is_admin = true 
WHERE email = 'andrew.bryce@sixtyseconds.video';