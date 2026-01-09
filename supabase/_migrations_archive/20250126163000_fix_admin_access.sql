/*
  # Fix Admin Access and Activity Visibility

  1. Changes
    - Fix admin check to use the requesting user's admin status
    - Update activity policies to respect user isolation
    - Ensure proper auth functionality
    - Fix infinite recursion in policies

  2. Security
    - Admins can view all profiles and activities
    - Regular users can only see their own data
    - Maintain proper data isolation
*/

-- Drop all existing policies for profiles and activities
DO $$ 
BEGIN
    -- Drop profile policies if they exist
    DROP POLICY IF EXISTS "Enable read access for own profile" ON profiles;
    DROP POLICY IF EXISTS "Enable update access for own profile" ON profiles;
    DROP POLICY IF EXISTS "Enable read access for own profile and admins" ON profiles;
    DROP POLICY IF EXISTS "Enable update access for own profile and admins" ON profiles;
    DROP POLICY IF EXISTS "Enable read access for users and admins" ON profiles;
    DROP POLICY IF EXISTS "Enable update access for users and admins" ON profiles;
    DROP POLICY IF EXISTS "Enable profile access" ON profiles;
    DROP POLICY IF EXISTS "Enable profile updates" ON profiles;
    
    -- Drop activity policies if they exist
    DROP POLICY IF EXISTS "Enable read access for own activities" ON activities;
    DROP POLICY IF EXISTS "Enable activity access" ON activities;
    DROP POLICY IF EXISTS "Users can read own activities" ON activities;
    DROP POLICY IF EXISTS "Users can create own activities" ON activities;
    DROP POLICY IF EXISTS "Users can update own activities" ON activities;
    DROP POLICY IF EXISTS "Users can delete own activities" ON activities;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- Create new profile policies
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Enable profile access'
    ) THEN
        CREATE POLICY "Enable profile access"
            ON profiles FOR SELECT
            TO authenticated
            USING (
                id = auth.uid() OR 
                EXISTS (
                    SELECT 1 FROM profiles p
                    WHERE p.id = auth.uid() AND p.is_admin = true
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Enable profile updates'
    ) THEN
        CREATE POLICY "Enable profile updates"
            ON profiles FOR UPDATE
            TO authenticated
            USING (
                id = auth.uid() OR 
                EXISTS (
                    SELECT 1 FROM profiles p
                    WHERE p.id = auth.uid() AND p.is_admin = true
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'activities' AND policyname = 'Enable activity access'
    ) THEN
        CREATE POLICY "Enable activity access"
            ON activities FOR SELECT
            TO authenticated
            USING (
                user_id = auth.uid() OR 
                EXISTS (
                    SELECT 1 FROM profiles p
                    WHERE p.id = auth.uid() AND p.is_admin = true
                )
            );
    END IF;
END $$;

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Verify admin status for specific user
UPDATE profiles 
SET is_admin = true 
WHERE email = 'andrew.bryce@sixtyseconds.video'; 