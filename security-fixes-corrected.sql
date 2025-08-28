-- ============================================================================
-- Comprehensive Security Fixes for Sixty Sales Dashboard - CORRECTED VERSION
-- ============================================================================
-- This script addresses the critical 403 Forbidden errors and authentication issues
-- identified in the contacts table and ensures proper RLS policies across the system.

-- Step 1: Check current authentication state and table structure
SELECT 
  'Current user session check' as check_type,
  auth.uid() as current_user_id,
  auth.role() as current_role;

-- Step 2: Check current RLS status for contacts table (CORRECTED QUERY)
SELECT 
  'Contacts table RLS status' as info,
  n.nspname as schemaname,
  c.relname as tablename,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as has_rls_enforced
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relname = 'contacts' AND n.nspname = 'public';

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

-- Step 4: Create helper function to check if user is admin
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE id = auth.uid()),
    false
  );
$$;

-- Step 5: Ensure RLS is enabled on contacts table
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Step 6: Drop all existing policies to start fresh
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

-- Step 7: Create new comprehensive RLS policies

-- SELECT Policy - Users can read their own contacts + Admins can read all
CREATE POLICY "contacts_select_policy" ON contacts
  FOR SELECT
  TO authenticated
  USING (
    auth.is_admin() 
    OR owner_id = auth.uid()
    OR created_by = auth.uid()
    OR auth.uid() IN (
      SELECT owner_id FROM deals WHERE deals.contact_id = contacts.id
    )
  );

-- INSERT Policy - Authenticated users can create contacts
CREATE POLICY "contacts_insert_policy" ON contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (owner_id = auth.uid() OR owner_id IS NULL)
  );

-- UPDATE Policy - Users can update their own contacts + Admins can update all
CREATE POLICY "contacts_update_policy" ON contacts
  FOR UPDATE
  TO authenticated
  USING (
    auth.is_admin()
    OR owner_id = auth.uid()
    OR created_by = auth.uid()
  )
  WITH CHECK (
    auth.is_admin()
    OR owner_id = auth.uid()
    OR created_by = auth.uid()
  );

-- DELETE Policy - Users can delete their own contacts + Admins can delete all
CREATE POLICY "contacts_delete_policy" ON contacts
  FOR DELETE
  TO authenticated
  USING (
    auth.is_admin()
    OR owner_id = auth.uid()
    OR created_by = auth.uid()
  );

-- Step 8: Grant proper permissions to service role for Edge Functions
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON contacts TO service_role;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO service_role;

-- Step 9: Fix other related tables if they exist

-- Companies table
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companies_select_policy" ON companies;
DROP POLICY IF EXISTS "companies_insert_policy" ON companies;
DROP POLICY IF EXISTS "companies_update_policy" ON companies;
DROP POLICY IF EXISTS "companies_delete_policy" ON companies;

CREATE POLICY "companies_select_policy" ON companies
  FOR SELECT TO authenticated
  USING (auth.is_admin() OR owner_id = auth.uid() OR created_by = auth.uid());

CREATE POLICY "companies_insert_policy" ON companies
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "companies_update_policy" ON companies
  FOR UPDATE TO authenticated
  USING (auth.is_admin() OR owner_id = auth.uid() OR created_by = auth.uid())
  WITH CHECK (auth.is_admin() OR owner_id = auth.uid() OR created_by = auth.uid());

CREATE POLICY "companies_delete_policy" ON companies
  FOR DELETE TO authenticated
  USING (auth.is_admin() OR owner_id = auth.uid() OR created_by = auth.uid());

-- Deals table
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deals_select_policy" ON deals;
DROP POLICY IF EXISTS "deals_insert_policy" ON deals;
DROP POLICY IF EXISTS "deals_update_policy" ON deals;
DROP POLICY IF EXISTS "deals_delete_policy" ON deals;

CREATE POLICY "deals_select_policy" ON deals
  FOR SELECT TO authenticated
  USING (auth.is_admin() OR owner_id = auth.uid());

CREATE POLICY "deals_insert_policy" ON deals
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND (owner_id = auth.uid() OR owner_id IS NULL));

CREATE POLICY "deals_update_policy" ON deals
  FOR UPDATE TO authenticated
  USING (auth.is_admin() OR owner_id = auth.uid())
  WITH CHECK (auth.is_admin() OR owner_id = auth.uid());

CREATE POLICY "deals_delete_policy" ON deals
  FOR DELETE TO authenticated
  USING (auth.is_admin() OR owner_id = auth.uid());

-- Step 10: Grant permissions to service role for all tables
GRANT ALL ON companies TO service_role;
GRANT ALL ON deals TO service_role;
GRANT ALL ON tasks TO service_role;
GRANT ALL ON meetings TO service_role;
GRANT ALL ON activities TO service_role;

-- Step 11: Verify the fixes
SELECT 
  'Verification: RLS Status' as check_type,
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_enforced
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relname IN ('contacts', 'companies', 'deals', 'tasks', 'meetings', 'activities')
  AND n.nspname = 'public'
ORDER BY c.relname;

-- Step 12: Show all policies for verification
SELECT 
  'Verification: Current Policies' as check_type,
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  roles
FROM pg_policies 
WHERE tablename IN ('contacts', 'companies', 'deals', 'tasks', 'meetings', 'activities')
ORDER BY tablename, policyname;

-- Step 13: Test contact creation (should work now)
SELECT 'Testing contact access' as test_type;

-- This should succeed for authenticated users
INSERT INTO contacts (first_name, last_name, email, owner_id, created_by)
SELECT 'Test', 'User', 'test@example.com', auth.uid(), auth.uid()
WHERE auth.uid() IS NOT NULL;

-- Clean up test data
DELETE FROM contacts WHERE email = 'test@example.com' AND first_name = 'Test';

SELECT '✅ Security fixes applied successfully!' as result;
SELECT 'Next steps: Set admin flags with: UPDATE profiles SET is_admin = true WHERE email = ''your-admin@email.com'';' as admin_setup;