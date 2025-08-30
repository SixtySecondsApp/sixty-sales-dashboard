-- ============================================================================
-- Comprehensive Security Fixes for Sixty Sales Dashboard
-- ============================================================================
-- This script addresses the critical 403 Forbidden errors and authentication issues
-- identified in the contacts table and ensures proper RLS policies across the system.

-- Step 1: Check current authentication state and table structure
SELECT 
  'Current user session check' as check_type,
  auth.uid() as current_user_id,
  auth.role() as current_role;

-- Step 2: Check current RLS status for contacts table
SELECT 
  'Contacts table RLS status' as info,
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  hasrls as has_rls_enforced
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relname = 'contacts';

-- Step 3: Show current policies on contacts table
SELECT 
  'Current contacts policies' as info,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'contacts'
ORDER BY policyname;

-- Step 4: Fix Contacts Table RLS Policies
-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can view contacts" ON contacts;
DROP POLICY IF EXISTS "Users can insert contacts" ON contacts;  
DROP POLICY IF EXISTS "Users can update contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete contacts" ON contacts;
DROP POLICY IF EXISTS "Enable contacts read access for owners and admins" ON contacts;
DROP POLICY IF EXISTS "Enable contacts insert access for authenticated users" ON contacts;
DROP POLICY IF EXISTS "Enable contacts update access for owners and admins" ON contacts;
DROP POLICY IF EXISTS "Enable contacts delete access for owners and admins" ON contacts;
DROP POLICY IF EXISTS "contacts_select_policy" ON contacts;
DROP POLICY IF EXISTS "contacts_insert_policy" ON contacts;
DROP POLICY IF EXISTS "contacts_update_policy" ON contacts;
DROP POLICY IF EXISTS "contacts_delete_policy" ON contacts;

-- Ensure RLS is enabled
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Create comprehensive RLS policies with proper admin override
-- Policy 1: SELECT - Allow users to read their own contacts + admin override
CREATE POLICY "contacts_select_comprehensive_policy"
  ON contacts FOR SELECT
  TO authenticated
  USING (
    -- Allow if user owns the contact
    owner_id = auth.uid() 
    OR 
    -- Allow if user is admin (with null safety checks)
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
        AND p.is_admin = true
    )
    OR
    -- Allow service role (for Edge Functions)
    auth.role() = 'service_role'
  );

-- Policy 2: INSERT - Allow authenticated users to create contacts with proper owner_id
CREATE POLICY "contacts_insert_comprehensive_policy"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Ensure authenticated user exists
    auth.uid() IS NOT NULL 
    AND
    -- Ensure owner_id matches current user (prevents privilege escalation)
    (
      owner_id = auth.uid()
      OR
      -- Allow admins to create contacts for other users
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.is_admin = true
      )
    )
  );

-- Policy 3: UPDATE - Allow owners and admins to update contacts
CREATE POLICY "contacts_update_comprehensive_policy"
  ON contacts FOR UPDATE
  TO authenticated
  USING (
    -- Allow if user owns the contact
    owner_id = auth.uid() 
    OR 
    -- Allow if user is admin
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
    OR
    -- Allow service role
    auth.role() = 'service_role'
  )
  WITH CHECK (
    -- Ensure owner_id doesn't change unless admin
    (
      owner_id = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.is_admin = true
      )
    )
  );

-- Policy 4: DELETE - Allow owners and admins to delete contacts
CREATE POLICY "contacts_delete_comprehensive_policy"
  ON contacts FOR DELETE
  TO authenticated
  USING (
    -- Allow if user owns the contact
    owner_id = auth.uid() 
    OR 
    -- Allow if user is admin
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
    OR
    -- Allow service role
    auth.role() = 'service_role'
  );

-- Step 5: Grant proper table permissions
-- Revoke public access and grant to authenticated role
REVOKE ALL ON contacts FROM public;
GRANT SELECT, INSERT, UPDATE, DELETE ON contacts TO authenticated;
GRANT ALL ON contacts TO service_role;

-- Step 6: Ensure profiles table has proper admin field
-- Check if profiles table exists and has is_admin column
DO $$ 
BEGIN
  -- Check if is_admin column exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN DEFAULT false;
    COMMENT ON COLUMN profiles.is_admin IS 'Admin flag for elevated permissions';
  END IF;
END $$;

-- Step 7: Create admin check function for better performance
-- This function can be reused across policies
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$;

-- Step 8: Update profiles table policies to ensure admin access works
-- Drop existing profiles policies that might be restrictive
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "enable_read_access_for_users" ON profiles;
DROP POLICY IF EXISTS "enable_update_access_for_users" ON profiles;

-- Create comprehensive profiles policies
CREATE POLICY "profiles_select_policy"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    -- Users can see their own profile
    id = auth.uid()
    OR
    -- Admins can see all profiles
    auth.is_admin()
    OR
    -- Service role can access all
    auth.role() = 'service_role'
  );

CREATE POLICY "profiles_update_policy"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    -- Users can update their own profile
    id = auth.uid()
    OR
    -- Admins can update any profile
    auth.is_admin()
    OR
    -- Service role can update all
    auth.role() = 'service_role'
  );

-- Ensure profiles RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Step 9: Check and fix any other tables that might have similar issues
-- Activities table - ensure admin override
DO $$
BEGIN
  -- Check if activities table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activities') THEN
    -- Drop restrictive policies
    DROP POLICY IF EXISTS "Users can view own activities" ON activities;
    DROP POLICY IF EXISTS "activities_select_policy" ON activities;
    
    -- Create admin-aware policy
    CREATE POLICY "activities_select_with_admin_policy"
      ON activities FOR SELECT
      TO authenticated
      USING (
        user_id = auth.uid()
        OR
        auth.is_admin()
        OR
        auth.role() = 'service_role'
      );
  END IF;
END $$;

-- Step 10: Companies table - ensure admin override
DO $$
BEGIN
  -- Check if companies table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies') THEN
    -- Drop restrictive policies if they exist
    DROP POLICY IF EXISTS "Users can view companies" ON companies;
    DROP POLICY IF EXISTS "companies_select_policy" ON companies;
    
    -- Create admin-aware policy
    CREATE POLICY "companies_select_with_admin_policy"
      ON companies FOR SELECT
      TO authenticated
      USING (
        owner_id = auth.uid()
        OR
        auth.is_admin()
        OR
        auth.role() = 'service_role'
      );
  END IF;
END $$;

-- Step 11: Add helpful comments and metadata
COMMENT ON TABLE contacts IS 'Contacts table with comprehensive RLS policies - supports owner access, admin override, and service role access';
COMMENT ON FUNCTION auth.is_admin IS 'Helper function to check if current user is admin - used in RLS policies for performance';

-- Step 12: Create a comprehensive RLS status check query
CREATE OR REPLACE VIEW rls_status_check AS
SELECT 
  t.schemaname,
  t.tablename,
  t.rowsecurity as rls_enabled,
  COUNT(p.policyname) as policy_count,
  STRING_AGG(p.policyname, ', ' ORDER BY p.policyname) as policies
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public' 
  AND t.tablename IN ('contacts', 'profiles', 'activities', 'companies', 'deals')
GROUP BY t.schemaname, t.tablename, t.rowsecurity
ORDER BY t.tablename;

-- Step 13: Final verification - show updated policies
SELECT 
  '=== FINAL VERIFICATION ===' as section,
  'Contacts table policies after fix' as description;

SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%auth.is_admin%' OR qual LIKE '%is_admin = true%' THEN 'HAS_ADMIN_OVERRIDE'
    WHEN qual LIKE '%service_role%' THEN 'HAS_SERVICE_ROLE_ACCESS'
    WHEN qual LIKE '%owner_id = auth.uid%' THEN 'HAS_OWNER_ACCESS'
    ELSE 'OTHER'
  END as policy_type
FROM pg_policies 
WHERE tablename = 'contacts'
ORDER BY cmd, policyname;

-- Step 14: Test the admin function
SELECT 
  'Testing admin function' as test,
  auth.uid() as current_user,
  auth.is_admin() as is_current_user_admin;

-- Success message
SELECT '🔐 Comprehensive security fixes applied successfully!' as result,
       'Contacts table now has proper RLS with admin override capabilities' as details;