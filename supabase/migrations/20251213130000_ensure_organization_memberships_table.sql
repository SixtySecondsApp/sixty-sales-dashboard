-- ============================================================================
-- Migration: Ensure organization_memberships Table Exists
-- ============================================================================
-- Issue: The rename_user_organization function fails with:
--   "relation organization_memberships does not exist"
--
-- This migration ensures the organization_memberships table exists.
-- It mirrors the original definition from 20250113180730_create_multi_tenant_tables.sql
-- Using IF NOT EXISTS to be idempotent.
-- ============================================================================

-- Organizations table (prerequisite)
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

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_organization_memberships_user_id 
  ON organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_memberships_org_id 
  ON organization_memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_organization_memberships_role 
  ON organization_memberships(role);

-- Enable RLS on the table
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies for organization_memberships
-- ============================================================================

-- Select: Users can see memberships for orgs they belong to
DROP POLICY IF EXISTS "organization_memberships_select" ON organization_memberships;
CREATE POLICY "organization_memberships_select" ON organization_memberships FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM organization_memberships om
      WHERE om.org_id = organization_memberships.org_id
        AND om.user_id = (SELECT auth.uid())
    )
  );

-- Insert: Allow users to join orgs or create owner memberships for orgs they created
DROP POLICY IF EXISTS "organization_memberships_insert" ON organization_memberships;
CREATE POLICY "organization_memberships_insert" ON organization_memberships FOR INSERT
  WITH CHECK (
    -- Service role always allowed
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    -- User adding themselves as owner to org they created
    OR (
      user_id = (SELECT auth.uid())
      AND role = 'owner'
      AND EXISTS (
        SELECT 1 FROM organizations
        WHERE id = org_id
        AND created_by = (SELECT auth.uid())
      )
    )
    -- User joining as member
    OR (
      user_id = (SELECT auth.uid())
      AND role = 'member'
    )
    -- Org owners/admins can add members
    OR EXISTS (
      SELECT 1 FROM organization_memberships om
      WHERE om.org_id = organization_memberships.org_id
        AND om.user_id = (SELECT auth.uid())
        AND om.role IN ('owner', 'admin')
    )
  );

-- Update: Only owners/admins can update memberships
DROP POLICY IF EXISTS "organization_memberships_update" ON organization_memberships;
CREATE POLICY "organization_memberships_update" ON organization_memberships FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships om
      WHERE om.org_id = organization_memberships.org_id
        AND om.user_id = (SELECT auth.uid())
        AND om.role IN ('owner', 'admin')
    )
  );

-- Delete: Only owners/admins can remove members, or users can remove themselves
DROP POLICY IF EXISTS "organization_memberships_delete" ON organization_memberships;
CREATE POLICY "organization_memberships_delete" ON organization_memberships FOR DELETE
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM organization_memberships om
      WHERE om.org_id = organization_memberships.org_id
        AND om.user_id = (SELECT auth.uid())
        AND om.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- Recreate rename_user_organization function with proper search_path
-- ============================================================================

CREATE OR REPLACE FUNCTION rename_user_organization(p_new_name TEXT)
RETURNS TABLE(
  success BOOLEAN,
  org_id UUID,
  org_name TEXT,
  error_message TEXT
) 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_clean_name TEXT;
BEGIN
  -- Get user's organization where they are owner
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

  -- Clean the name
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

  -- Update the organization name
  UPDATE organizations
  SET name = v_clean_name, updated_at = NOW()
  WHERE id = v_org_id;

  RETURN QUERY SELECT
    true,
    v_org_id,
    v_clean_name,
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION rename_user_organization(TEXT) IS
  'Renames the organization where the current user is an owner';

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION rename_user_organization(TEXT) TO authenticated;

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
DECLARE
  table_exists BOOLEAN;
  func_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'organization_memberships'
  ) INTO table_exists;
  
  SELECT EXISTS (
    SELECT FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'rename_user_organization'
  ) INTO func_exists;
  
  RAISE NOTICE 'organization_memberships table exists: %', table_exists;
  RAISE NOTICE 'rename_user_organization function exists: %', func_exists;
END $$;






