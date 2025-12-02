-- =====================================================
-- DEBUG AND FIX RLS POLICIES
-- =====================================================
-- Run this to diagnose and fix the 403 error

-- Step 1: Check current policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'organizations'
ORDER BY policyname;

-- Step 2: Check if the current user can see the organizations table
SELECT COUNT(*) as org_count FROM organizations;

-- Step 3: Test direct insert (this will show the actual error)
-- First, let's check the current user
SELECT auth.uid() as current_user_id;

-- Step 4: The issue is likely the "FOR ALL" policy conflicting
-- Let's drop the conflicting policy and recreate properly

-- Drop all existing organization policies
DROP POLICY IF EXISTS "org_select_policy" ON organizations;
DROP POLICY IF EXISTS "org_insert_authenticated" ON organizations;
DROP POLICY IF EXISTS "org_update_owner" ON organizations;
DROP POLICY IF EXISTS "org_all_admin" ON organizations;
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON organizations;
DROP POLICY IF EXISTS "Super admins can manage all organizations" ON organizations;

-- Recreate with PERMISSIVE policies (they OR together)

-- SELECT: Users can see orgs they're members of OR super admins
CREATE POLICY "org_select" ON organizations
FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR id IN (SELECT org_id FROM organization_memberships WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- INSERT: Any authenticated user can create an org
CREATE POLICY "org_insert" ON organizations
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

-- UPDATE: Owner or super admin
CREATE POLICY "org_update" ON organizations
FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM organization_memberships WHERE org_id = id AND user_id = auth.uid() AND role = 'owner')
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- DELETE: Only super admin
CREATE POLICY "org_delete" ON organizations
FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Verify
SELECT
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE tablename = 'organizations'
ORDER BY policyname;

SELECT 'Policies recreated!' as status;
