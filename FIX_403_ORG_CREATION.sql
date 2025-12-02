-- =====================================================
-- FIX 403 ERROR ON ORGANIZATION CREATION
-- =====================================================
-- Run this script in Supabase SQL Editor to fix the 403 Forbidden
-- error when creating organizations during onboarding.
--
-- This script:
-- 1. Ensures the organizations table exists
-- 2. Drops ALL conflicting RLS policies
-- 3. Creates clean, working RLS policies
-- 4. Verifies the fix

-- =====================================================
-- STEP 1: Check if tables exist, create if not
-- =====================================================

-- Create organizations table if it doesn't exist
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create organization_memberships table if it doesn't exist
CREATE TABLE IF NOT EXISTS organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'readonly')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON organization_memberships(org_id);

-- =====================================================
-- STEP 2: Enable RLS on tables
-- =====================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 3: Create helper function (if not exists)
-- =====================================================

-- Simple function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND is_admin = true
  );
EXCEPTION
  WHEN undefined_table THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- STEP 4: Drop ALL existing organization policies
-- =====================================================

-- Drop every possible policy name that might exist
DROP POLICY IF EXISTS "org_select" ON organizations;
DROP POLICY IF EXISTS "org_insert" ON organizations;
DROP POLICY IF EXISTS "org_update" ON organizations;
DROP POLICY IF EXISTS "org_delete" ON organizations;
DROP POLICY IF EXISTS "org_select_policy" ON organizations;
DROP POLICY IF EXISTS "org_insert_policy" ON organizations;
DROP POLICY IF EXISTS "org_update_policy" ON organizations;
DROP POLICY IF EXISTS "org_delete_policy" ON organizations;
DROP POLICY IF EXISTS "org_insert_authenticated" ON organizations;
DROP POLICY IF EXISTS "org_update_owner" ON organizations;
DROP POLICY IF EXISTS "org_all_admin" ON organizations;
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON organizations;
DROP POLICY IF EXISTS "Super admins can manage all organizations" ON organizations;
DROP POLICY IF EXISTS "organization_select_policy" ON organizations;
DROP POLICY IF EXISTS "organization_insert_policy" ON organizations;
DROP POLICY IF EXISTS "authenticated_insert_org" ON organizations;

-- =====================================================
-- STEP 5: Create SIMPLE, working RLS policies
-- =====================================================

-- SELECT: Users can see orgs they created or are members of
CREATE POLICY "org_select" ON organizations
FOR SELECT TO authenticated
USING (
  -- User created this org
  created_by = auth.uid()
  -- OR user is a member of this org
  OR id IN (
    SELECT org_id FROM organization_memberships
    WHERE user_id = auth.uid()
  )
  -- OR user is super admin
  OR is_super_admin(auth.uid())
);

-- INSERT: ANY authenticated user can create an organization
-- This is the KEY policy for fixing the 403 error!
CREATE POLICY "org_insert" ON organizations
FOR INSERT TO authenticated
WITH CHECK (
  -- User must set themselves as the creator
  created_by = auth.uid()
);

-- UPDATE: Only creator, org owner, or super admin
CREATE POLICY "org_update" ON organizations
FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE org_id = organizations.id
    AND user_id = auth.uid()
    AND role = 'owner'
  )
  OR is_super_admin(auth.uid())
);

-- DELETE: Only super admin
CREATE POLICY "org_delete" ON organizations
FOR DELETE TO authenticated
USING (
  is_super_admin(auth.uid())
);

-- =====================================================
-- STEP 6: Drop ALL existing membership policies
-- =====================================================

DROP POLICY IF EXISTS "membership_select" ON organization_memberships;
DROP POLICY IF EXISTS "membership_insert" ON organization_memberships;
DROP POLICY IF EXISTS "membership_update" ON organization_memberships;
DROP POLICY IF EXISTS "membership_delete" ON organization_memberships;
DROP POLICY IF EXISTS "membership_select_own" ON organization_memberships;
DROP POLICY IF EXISTS "membership_select_org" ON organization_memberships;

-- =====================================================
-- STEP 7: Create membership RLS policies
-- =====================================================

-- SELECT: Users can see their own memberships and members of their orgs
CREATE POLICY "membership_select" ON organization_memberships
FOR SELECT TO authenticated
USING (
  -- Own membership
  user_id = auth.uid()
  -- OR in same org
  OR org_id IN (
    SELECT org_id FROM organization_memberships
    WHERE user_id = auth.uid()
  )
);

-- INSERT: Users can add themselves as owner to orgs they created
CREATE POLICY "membership_insert" ON organization_memberships
FOR INSERT TO authenticated
WITH CHECK (
  -- Self-insert as owner for orgs you created
  (
    user_id = auth.uid()
    AND role = 'owner'
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE id = org_id AND created_by = auth.uid()
    )
  )
  -- OR you're already an owner/admin of the org
  OR EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE org_id = organization_memberships.org_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
  -- OR super admin
  OR is_super_admin(auth.uid())
);

-- UPDATE: Only owners/admins can update memberships
CREATE POLICY "membership_update" ON organization_memberships
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_memberships om
    WHERE om.org_id = organization_memberships.org_id
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
  OR is_super_admin(auth.uid())
);

-- DELETE: Owners/admins can delete (except themselves)
CREATE POLICY "membership_delete" ON organization_memberships
FOR DELETE TO authenticated
USING (
  (
    EXISTS (
      SELECT 1 FROM organization_memberships om
      WHERE om.org_id = organization_memberships.org_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
    AND user_id != auth.uid()
  )
  OR is_super_admin(auth.uid())
);

-- =====================================================
-- STEP 8: Grant execute on helper function
-- =====================================================

GRANT EXECUTE ON FUNCTION is_super_admin(UUID) TO authenticated;

-- =====================================================
-- STEP 9: Verification
-- =====================================================

SELECT 'SUCCESS: Organization policies created!' as status;

SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('organizations', 'organization_memberships')
ORDER BY tablename, policyname;
