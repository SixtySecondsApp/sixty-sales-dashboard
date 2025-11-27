-- =====================================================
-- MULTI-TENANT SETUP - Complete Setup Script
-- =====================================================
-- Run this in the Supabase SQL Editor to enable multi-tenant support
-- This creates all necessary tables, functions, and triggers

-- =====================================================
-- PART 1: Enable extensions
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- =====================================================
-- PART 2: Create organization tables
-- =====================================================

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,

  -- Constraints
  CONSTRAINT organizations_name_not_empty CHECK (length(trim(name)) > 0)
);

-- Organization memberships table
CREATE TABLE IF NOT EXISTS organization_memberships (
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'readonly')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (org_id, user_id)
);

-- Organization invitations table
CREATE TABLE IF NOT EXISTS organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'readonly')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON organizations(created_by);
CREATE INDEX IF NOT EXISTS idx_organizations_is_active ON organizations(is_active);
CREATE INDEX IF NOT EXISTS idx_organization_memberships_user_id ON organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_memberships_org_id ON organization_memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_org_id ON organization_invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_email ON organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_token ON organization_invitations(token);

-- =====================================================
-- PART 3: Helper functions
-- =====================================================

-- Check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = p_user_id AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's role in organization
CREATE OR REPLACE FUNCTION get_org_role(p_user_id UUID, p_org_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role
    FROM organization_memberships
    WHERE user_id = p_user_id AND org_id = p_org_id
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is member of organization
CREATE OR REPLACE FUNCTION is_org_member(p_user_id UUID, p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM organization_memberships
    WHERE user_id = p_user_id AND org_id = p_org_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PART 4: Enable RLS
-- =====================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON organizations;
DROP POLICY IF EXISTS "Super admins can manage all organizations" ON organizations;
DROP POLICY IF EXISTS "Users can view memberships in their organizations" ON organization_memberships;
DROP POLICY IF EXISTS "Owners and admins can add members" ON organization_memberships;
DROP POLICY IF EXISTS "Owners and admins can update members" ON organization_memberships;
DROP POLICY IF EXISTS "Owners and admins can remove members" ON organization_memberships;
DROP POLICY IF EXISTS "Users can view invitations in their organizations" ON organization_invitations;
DROP POLICY IF EXISTS "Owners and admins can create invitations" ON organization_invitations;
DROP POLICY IF EXISTS "Owners and admins can update invitations" ON organization_invitations;
DROP POLICY IF EXISTS "Owners and admins can delete invitations" ON organization_invitations;
DROP POLICY IF EXISTS "Users can view their own pending invitations" ON organization_invitations;

-- Organizations policies
CREATE POLICY "Users can view organizations they belong to"
  ON organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE org_id = organizations.id
      AND user_id = auth.uid()
    )
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Super admins can manage all organizations"
  ON organizations FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Memberships policies
CREATE POLICY "Users can view memberships in their organizations"
  ON organization_memberships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships om
      WHERE om.org_id = organization_memberships.org_id
      AND om.user_id = auth.uid()
    )
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Owners and admins can add members"
  ON organization_memberships FOR INSERT
  WITH CHECK (
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Owners and admins can update members"
  ON organization_memberships FOR UPDATE
  USING (
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Owners and admins can remove members"
  ON organization_memberships FOR DELETE
  USING (
    (get_org_role(auth.uid(), org_id) IN ('owner', 'admin') AND user_id != auth.uid())
    OR is_super_admin(auth.uid())
  );

-- Invitations policies
CREATE POLICY "Users can view invitations in their organizations"
  ON organization_invitations FOR SELECT
  USING (
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Owners and admins can create invitations"
  ON organization_invitations FOR INSERT
  WITH CHECK (
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Owners and admins can update invitations"
  ON organization_invitations FOR UPDATE
  USING (
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Owners and admins can delete invitations"
  ON organization_invitations FOR DELETE
  USING (
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Users can view their own pending invitations"
  ON organization_invitations FOR SELECT
  USING (
    LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
    AND accepted_at IS NULL
    AND expires_at > NOW()
  );

-- =====================================================
-- PART 5: Auto-create organization on signup
-- =====================================================

CREATE OR REPLACE FUNCTION auto_create_org_for_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
  v_org_name TEXT;
  v_user_email TEXT;
BEGIN
  -- Check if user already has an organization membership
  IF EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE user_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Get user's email from auth.users
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = NEW.id;

  -- Generate org name from full_name or email domain
  IF NEW.full_name IS NOT NULL AND LENGTH(TRIM(NEW.full_name)) > 0 THEN
    v_org_name := TRIM(NEW.full_name) || '''s Organization';
  ELSIF v_user_email IS NOT NULL AND v_user_email LIKE '%@%' THEN
    v_org_name := INITCAP(SPLIT_PART(SPLIT_PART(v_user_email, '@', 2), '.', 1));
  ELSE
    v_org_name := 'My Organization';
  END IF;

  -- Create the organization
  INSERT INTO organizations (name, created_by, is_active, created_at, updated_at)
  VALUES (v_org_name, NEW.id, true, NOW(), NOW())
  RETURNING id INTO v_org_id;

  -- Add user as owner of the organization
  INSERT INTO organization_memberships (org_id, user_id, role, created_at, updated_at)
  VALUES (v_org_id, NEW.id, 'owner', NOW(), NOW());

  RAISE NOTICE 'Created organization "%" (id: %) for user %', v_org_name, v_org_id, NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to create organization for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old triggers
DROP TRIGGER IF EXISTS trigger_auto_org_membership_on_profile ON profiles;
DROP TRIGGER IF EXISTS trigger_auto_org_for_new_user ON profiles;

-- Create new trigger
CREATE TRIGGER trigger_auto_org_for_new_user
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_org_for_new_user();

-- =====================================================
-- PART 6: Rename organization function
-- =====================================================

CREATE OR REPLACE FUNCTION rename_user_organization(p_new_name TEXT)
RETURNS TABLE(
  success BOOLEAN,
  org_id UUID,
  org_name TEXT,
  error_message TEXT
) AS $$
DECLARE
  v_org_id UUID;
  v_clean_name TEXT;
BEGIN
  SELECT om.org_id INTO v_org_id
  FROM organization_memberships om
  WHERE om.user_id = auth.uid()
    AND om.role = 'owner'
  ORDER BY om.created_at ASC
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN QUERY SELECT
      false,
      NULL::UUID,
      NULL::TEXT,
      'No organization found where you are the owner'::TEXT;
    RETURN;
  END IF;

  v_clean_name := TRIM(p_new_name);

  IF LENGTH(v_clean_name) < 1 THEN
    RETURN QUERY SELECT
      false,
      v_org_id,
      NULL::TEXT,
      'Organization name cannot be empty'::TEXT;
    RETURN;
  END IF;

  IF LENGTH(v_clean_name) > 100 THEN
    RETURN QUERY SELECT
      false,
      v_org_id,
      NULL::TEXT,
      'Organization name too long (max 100 characters)'::TEXT;
    RETURN;
  END IF;

  UPDATE organizations
  SET name = v_clean_name, updated_at = NOW()
  WHERE id = v_org_id;

  RETURN QUERY SELECT
    true,
    v_org_id,
    v_clean_name,
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION rename_user_organization(TEXT) TO authenticated;

-- =====================================================
-- PART 7: Accept invitation function
-- =====================================================

CREATE OR REPLACE FUNCTION accept_org_invitation(p_token TEXT)
RETURNS TABLE(
  success BOOLEAN,
  org_id UUID,
  org_name TEXT,
  role TEXT,
  error_message TEXT
) AS $$
DECLARE
  v_invitation RECORD;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT
      false,
      NULL::UUID,
      NULL::TEXT,
      NULL::TEXT,
      'You must be logged in to accept an invitation'::TEXT;
    RETURN;
  END IF;

  SELECT i.*, o.name as org_name
  INTO v_invitation
  FROM organization_invitations i
  JOIN organizations o ON o.id = i.org_id
  WHERE i.token = p_token
    AND i.accepted_at IS NULL
    AND i.expires_at > NOW();

  IF v_invitation IS NULL THEN
    RETURN QUERY SELECT
      false,
      NULL::UUID,
      NULL::TEXT,
      NULL::TEXT,
      'Invitation not found or has expired'::TEXT;
    RETURN;
  END IF;

  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE org_id = v_invitation.org_id AND user_id = v_user_id
  ) THEN
    RETURN QUERY SELECT
      false,
      v_invitation.org_id,
      v_invitation.org_name,
      NULL::TEXT,
      'You are already a member of this organization'::TEXT;
    RETURN;
  END IF;

  -- Add user to organization
  INSERT INTO organization_memberships (org_id, user_id, role, created_at, updated_at)
  VALUES (v_invitation.org_id, v_user_id, v_invitation.role, NOW(), NOW());

  -- Mark invitation as accepted
  UPDATE organization_invitations
  SET accepted_at = NOW()
  WHERE id = v_invitation.id;

  RETURN QUERY SELECT
    true,
    v_invitation.org_id,
    v_invitation.org_name,
    v_invitation.role,
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION accept_org_invitation(TEXT) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT 'Multi-tenant setup completed successfully!' as status,
       (SELECT COUNT(*) FROM organizations) as organizations_count,
       (SELECT COUNT(*) FROM organization_memberships) as memberships_count;
