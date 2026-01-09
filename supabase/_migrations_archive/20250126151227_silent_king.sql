/*
  # Add admin user

  1. Changes
    - Set andrew.bryce@sixtyseconds.video as an admin user
    - Add is_admin column if it doesn't exist
    - Update RLS policies to allow admin access

  2. Security
    - Enable RLS on profiles table
    - Add policies for admin access
*/

-- Add is_admin column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_admin boolean DEFAULT false;
  END IF;
END $$;

-- Set andrew.bryce@sixtyseconds.video as admin
UPDATE profiles 
SET is_admin = true 
WHERE email = 'andrew.bryce@sixtyseconds.video';

-- Update RLS policies to allow admin access
DROP POLICY IF EXISTS "Enable read access for own profile" ON profiles;
DROP POLICY IF EXISTS "Enable update access for own profile" ON profiles;

-- Create new policies that include admin access
CREATE POLICY "Users can read own profile or admins can read all"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Users can update own profile or admins can update all"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Add admin policies for activities
DROP POLICY IF EXISTS "Users can read own activities" ON activities;
CREATE POLICY "Users can read own activities or admins can read all"
  ON activities FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Add admin policies for targets
DROP POLICY IF EXISTS "Users can read own targets" ON targets;
CREATE POLICY "Users can read own targets or admins can read all"
  ON targets FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );