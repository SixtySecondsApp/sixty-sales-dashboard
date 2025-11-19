-- Multi-Tenant Architecture: Core Organization Tables
-- This migration creates the foundation for multi-tenant support

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
-- Links users to organizations with roles
CREATE TABLE IF NOT EXISTS organization_memberships (
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'readonly')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Primary key is composite
  PRIMARY KEY (org_id, user_id)
);

-- Organization invitations table
-- Manages invitations to join organizations
CREATE TABLE IF NOT EXISTS organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email CITEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'readonly')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique pending invitations per org/email
  CONSTRAINT unique_pending_invitation UNIQUE NULLS NOT DISTINCT (org_id, email, accepted_at)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON organizations(created_by);
CREATE INDEX IF NOT EXISTS idx_organizations_is_active ON organizations(is_active);
CREATE INDEX IF NOT EXISTS idx_organizations_created_at ON organizations(created_at);

CREATE INDEX IF NOT EXISTS idx_organization_memberships_user_id ON organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_memberships_org_id ON organization_memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_organization_memberships_role ON organization_memberships(role);

CREATE INDEX IF NOT EXISTS idx_organization_invitations_org_id ON organization_invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_email ON organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_token ON organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_expires_at ON organization_invitations(expires_at) WHERE accepted_at IS NULL;

-- Helper function to get organizations for a user
CREATE OR REPLACE FUNCTION current_user_orgs(p_user_id UUID)
RETURNS TABLE(org_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT om.org_id
  FROM organization_memberships om
  WHERE om.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is member of organization
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

-- Helper function to get user's role in organization
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

-- Helper function to check if user is super admin
-- Uses the existing is_admin flag from profiles table
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

-- Enable RLS on all organization tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
-- Users can view organizations they are members of
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

-- Super admins can do everything
CREATE POLICY "Super admins can manage all organizations"
  ON organizations FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- RLS Policies for organization_memberships
-- Users can view memberships for organizations they belong to
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

-- Owners and admins can add members
CREATE POLICY "Owners and admins can add members"
  ON organization_memberships FOR INSERT
  WITH CHECK (
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    OR is_super_admin(auth.uid())
  );

-- Owners and admins can update members (role changes)
CREATE POLICY "Owners and admins can update members"
  ON organization_memberships FOR UPDATE
  USING (
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    OR is_super_admin(auth.uid())
  )
  WITH CHECK (
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    OR is_super_admin(auth.uid())
  );

-- Owners can remove members (except themselves if they're the only owner)
CREATE POLICY "Owners and admins can remove members"
  ON organization_memberships FOR DELETE
  USING (
    (get_org_role(auth.uid(), org_id) IN ('owner', 'admin') AND user_id != auth.uid())
    OR is_super_admin(auth.uid())
  );

-- RLS Policies for organization_invitations
-- Users can view invitations for organizations they belong to (as owner/admin)
CREATE POLICY "Users can view invitations in their organizations"
  ON organization_invitations FOR SELECT
  USING (
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    OR is_super_admin(auth.uid())
  );

-- Owners and admins can create invitations
CREATE POLICY "Owners and admins can create invitations"
  ON organization_invitations FOR INSERT
  WITH CHECK (
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    OR is_super_admin(auth.uid())
  );

-- Owners and admins can update invitations
CREATE POLICY "Owners and admins can update invitations"
  ON organization_invitations FOR UPDATE
  USING (
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    OR is_super_admin(auth.uid())
  )
  WITH CHECK (
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    OR is_super_admin(auth.uid())
  );

-- Owners and admins can delete invitations
CREATE POLICY "Owners and admins can delete invitations"
  ON organization_invitations FOR DELETE
  USING (
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    OR is_super_admin(auth.uid())
  );

-- Anyone can view their own pending invitations (by email)
CREATE POLICY "Users can view their own pending invitations"
  ON organization_invitations FOR SELECT
  USING (
    LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
    AND accepted_at IS NULL
    AND expires_at > NOW()
  );

-- Comments for documentation
COMMENT ON TABLE organizations IS 'Organizations (tenants) in the multi-tenant system';
COMMENT ON TABLE organization_memberships IS 'Links users to organizations with roles';
COMMENT ON TABLE organization_invitations IS 'Invitations for users to join organizations';
COMMENT ON FUNCTION current_user_orgs(UUID) IS 'Returns all organization IDs for a given user';
COMMENT ON FUNCTION is_org_member(UUID, UUID) IS 'Checks if a user is a member of an organization';
COMMENT ON FUNCTION get_org_role(UUID, UUID) IS 'Gets the role of a user in an organization';
COMMENT ON FUNCTION is_super_admin(UUID) IS 'Checks if a user is a super admin (is_admin flag)';











