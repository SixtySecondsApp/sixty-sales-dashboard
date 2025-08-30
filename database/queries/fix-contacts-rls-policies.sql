/*
  # Fix Contacts RLS Policies - Critical 403 Forbidden Error Resolution
  
  ## Issue
  The contacts table has basic RLS policies that only check `auth.uid() IS NOT NULL`,
  but this doesn't work with:
  1. Mock users in development
  2. Proper user ownership patterns like other tables
  3. Admin access patterns
  
  ## Solution
  Create comprehensive RLS policies that match the pattern used by other tables
  (profiles, activities) with proper admin access and owner-based permissions.
*/

-- Drop existing basic policies that are causing 403 errors
DROP POLICY IF EXISTS "Users can view contacts" ON contacts;
DROP POLICY IF EXISTS "Users can insert contacts" ON contacts;  
DROP POLICY IF EXISTS "Users can update contacts" ON contacts;

-- Create comprehensive RLS policies matching other tables pattern
-- Reading contacts: owner or admin can read
CREATE POLICY "Enable contacts read access for owners and admins"
  ON contacts FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- Creating contacts: authenticated users can create with proper owner_id
CREATE POLICY "Enable contacts insert access for authenticated users"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL AND 
    owner_id = auth.uid()
  );

-- Updating contacts: owner or admin can update
CREATE POLICY "Enable contacts update access for owners and admins"
  ON contacts FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- Deleting contacts: owner or admin can delete
CREATE POLICY "Enable contacts delete access for owners and admins"
  ON contacts FOR DELETE
  TO authenticated
  USING (
    owner_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- Ensure RLS is properly enabled
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Grant proper permissions to authenticated users
REVOKE ALL ON contacts FROM public;
GRANT ALL ON contacts TO authenticated;

-- Add helpful comment
COMMENT ON TABLE contacts IS 'Contacts table with owner-based RLS and admin override - Fixed 403 Forbidden error';

-- Verify the policies are created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'contacts'
ORDER BY policyname;