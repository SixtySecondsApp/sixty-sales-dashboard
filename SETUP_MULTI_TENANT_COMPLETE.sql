-- =====================================================
-- COMPLETE MULTI-TENANT SETUP
-- =====================================================
-- Run this script in Supabase SQL Editor to set up
-- the complete multi-tenant architecture from scratch.
--
-- This creates:
-- 1. organizations table
-- 2. organization_memberships table
-- 3. organization_invitations table
-- 4. Helper functions (SECURITY DEFINER)
-- 5. RLS policies
-- 6. Triggers for auto-creation

-- =====================================================
-- STEP 1: Create tables
-- =====================================================

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization memberships table
CREATE TABLE IF NOT EXISTS organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'readonly')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- Organization invitations table
CREATE TABLE IF NOT EXISTS organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'readonly')),
  invited_by UUID REFERENCES auth.users(id),
  token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON organization_memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON organization_invitations(token);

-- =====================================================
-- STEP 2: Enable RLS
-- =====================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 3: Create helper functions (SECURITY DEFINER)
-- =====================================================

-- Check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get user's role in organization
CREATE OR REPLACE FUNCTION get_org_role(p_user_id UUID, p_org_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role FROM organization_memberships
    WHERE user_id = p_user_id AND org_id = p_org_id
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user is member of organization
CREATE OR REPLACE FUNCTION is_org_member(p_user_id UUID, p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE user_id = p_user_id AND org_id = p_org_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get all org IDs for a user
CREATE OR REPLACE FUNCTION get_user_org_ids(p_user_id UUID)
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY SELECT org_id FROM organization_memberships WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- STEP 4: Drop existing policies (clean slate)
-- =====================================================

DROP POLICY IF EXISTS "org_select_policy" ON organizations;
DROP POLICY IF EXISTS "org_all_admin" ON organizations;
DROP POLICY IF EXISTS "org_insert_authenticated" ON organizations;
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON organizations;
DROP POLICY IF EXISTS "Super admins can manage all organizations" ON organizations;

DROP POLICY IF EXISTS "membership_select_own" ON organization_memberships;
DROP POLICY IF EXISTS "membership_select_org" ON organization_memberships;
DROP POLICY IF EXISTS "membership_insert" ON organization_memberships;
DROP POLICY IF EXISTS "membership_update" ON organization_memberships;
DROP POLICY IF EXISTS "membership_delete" ON organization_memberships;

DROP POLICY IF EXISTS "invitation_select" ON organization_invitations;
DROP POLICY IF EXISTS "invitation_insert" ON organization_invitations;
DROP POLICY IF EXISTS "invitation_update" ON organization_invitations;
DROP POLICY IF EXISTS "invitation_delete" ON organization_invitations;

-- =====================================================
-- STEP 5: Create RLS policies
-- =====================================================

-- ORGANIZATIONS policies
-- Users can see orgs they're members of
CREATE POLICY "org_select_policy" ON organizations FOR SELECT
TO authenticated
USING (
  id IN (SELECT get_user_org_ids(auth.uid()))
  OR is_super_admin(auth.uid())
);

-- Any authenticated user can create an organization (for onboarding)
CREATE POLICY "org_insert_authenticated" ON organizations FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Owners can update their org
CREATE POLICY "org_update_owner" ON organizations FOR UPDATE
TO authenticated
USING (
  get_org_role(auth.uid(), id) = 'owner'
  OR is_super_admin(auth.uid())
);

-- Super admins can do everything
CREATE POLICY "org_all_admin" ON organizations FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- MEMBERSHIPS policies
-- Users can see their own membership
CREATE POLICY "membership_select_own" ON organization_memberships FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can see other members in their orgs
CREATE POLICY "membership_select_org" ON organization_memberships FOR SELECT
TO authenticated
USING (org_id IN (SELECT get_user_org_ids(auth.uid())));

-- Users can add themselves as owner to orgs they created, or admins can add members
CREATE POLICY "membership_insert" ON organization_memberships FOR INSERT
TO authenticated
WITH CHECK (
  -- Self-insert as owner for orgs you created
  (user_id = auth.uid() AND role = 'owner' AND EXISTS (
    SELECT 1 FROM organizations WHERE id = org_id AND created_by = auth.uid()
  ))
  -- Existing admins can add members
  OR get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  -- Super admins
  OR is_super_admin(auth.uid())
);

-- Admins can update memberships
CREATE POLICY "membership_update" ON organization_memberships FOR UPDATE
TO authenticated
USING (
  get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  OR is_super_admin(auth.uid())
);

-- Admins can delete memberships (except themselves)
CREATE POLICY "membership_delete" ON organization_memberships FOR DELETE
TO authenticated
USING (
  (get_org_role(auth.uid(), org_id) IN ('owner', 'admin') AND user_id != auth.uid())
  OR is_super_admin(auth.uid())
);

-- INVITATIONS policies
CREATE POLICY "invitation_select" ON organization_invitations FOR SELECT
TO authenticated
USING (
  get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  OR is_super_admin(auth.uid())
  OR (LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid())) AND accepted_at IS NULL)
);

CREATE POLICY "invitation_insert" ON organization_invitations FOR INSERT
TO authenticated
WITH CHECK (
  get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  OR is_super_admin(auth.uid())
);

CREATE POLICY "invitation_update" ON organization_invitations FOR UPDATE
TO authenticated
USING (
  get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  OR is_super_admin(auth.uid())
);

CREATE POLICY "invitation_delete" ON organization_invitations FOR DELETE
TO authenticated
USING (
  get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  OR is_super_admin(auth.uid())
);

-- =====================================================
-- STEP 6: Grant permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION is_super_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_org_role(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_org_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_org_ids(UUID) TO authenticated;

-- =====================================================
-- STEP 7: Verification
-- =====================================================

SELECT 'Multi-tenant setup complete!' as status;

SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN ('organizations', 'organization_memberships', 'organization_invitations')
GROUP BY tablename;
