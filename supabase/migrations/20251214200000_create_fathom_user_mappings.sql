-- ============================================================================
-- Migration: Create fathom_user_mappings table
-- Purpose: Map Fathom users (by email) to Sixty users for correct meeting ownership
-- Pattern: Mirrors slack_user_mappings table structure
-- ============================================================================

-- ============================================================================
-- Table: fathom_user_mappings
-- Map Fathom users (identified by email) to Sixty users
-- Used to correctly assign meeting ownership during sync
-- ============================================================================
CREATE TABLE IF NOT EXISTS fathom_user_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fathom_user_email TEXT NOT NULL,           -- Normalized/lowercased email from Fathom
  fathom_user_name TEXT,                     -- Display name from Fathom (optional)
  sixty_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- Mapped Sixty user
  is_auto_matched BOOLEAN DEFAULT false,     -- Whether matched automatically by email
  last_seen_at TIMESTAMPTZ DEFAULT now(),    -- Last time this Fathom user was seen in a meeting
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, fathom_user_email)
);

-- Add comment for documentation
COMMENT ON TABLE fathom_user_mappings IS 'Maps Fathom users (by email) to Sixty users for meeting ownership attribution';
COMMENT ON COLUMN fathom_user_mappings.fathom_user_email IS 'Lowercased email from Fathom (recorded_by.email, host_email, etc.)';
COMMENT ON COLUMN fathom_user_mappings.sixty_user_id IS 'The Sixty user this Fathom user maps to. NULL if not yet mapped.';
COMMENT ON COLUMN fathom_user_mappings.is_auto_matched IS 'True if mapping was created automatically because emails matched';
COMMENT ON COLUMN fathom_user_mappings.last_seen_at IS 'Updated each time a meeting is synced with this Fathom user';

-- ============================================================================
-- Indexes for efficient lookups
-- ============================================================================

-- Primary lookup: find mapping by org + email (for sync resolution)
CREATE INDEX IF NOT EXISTS idx_fathom_user_mappings_org_email
  ON fathom_user_mappings(org_id, fathom_user_email);

-- Lookup by Sixty user (for user settings page)
CREATE INDEX IF NOT EXISTS idx_fathom_user_mappings_sixty_user
  ON fathom_user_mappings(sixty_user_id);

-- Find unmapped users for admin UI
CREATE INDEX IF NOT EXISTS idx_fathom_user_mappings_unmapped
  ON fathom_user_mappings(org_id) WHERE sixty_user_id IS NULL;

-- ============================================================================
-- Enable Row Level Security
-- ============================================================================
ALTER TABLE fathom_user_mappings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Policy: Org members can view all mappings in their org
DROP POLICY IF EXISTS "org_members_view_fathom_user_mappings" ON fathom_user_mappings;
CREATE POLICY "org_members_view_fathom_user_mappings" ON fathom_user_mappings
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT om.org_id FROM organization_memberships om WHERE om.user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );

-- Policy: Users can update their own mapping (self-map)
-- This allows a user to claim a Fathom email as their own
DROP POLICY IF EXISTS "users_self_map_fathom" ON fathom_user_mappings;
CREATE POLICY "users_self_map_fathom" ON fathom_user_mappings
  FOR UPDATE
  TO authenticated
  USING (
    -- User must be in the org
    org_id IN (
      SELECT om.org_id FROM organization_memberships om WHERE om.user_id = auth.uid()
    )
    -- And either the row is unmapped OR already mapped to this user
    AND (sixty_user_id IS NULL OR sixty_user_id = auth.uid())
  )
  WITH CHECK (
    -- Can only map to self
    sixty_user_id = auth.uid()
    AND org_id IN (
      SELECT om.org_id FROM organization_memberships om WHERE om.user_id = auth.uid()
    )
  );

-- Policy: Org admins can manage all mappings (insert, update, delete)
DROP POLICY IF EXISTS "org_admins_manage_fathom_user_mappings" ON fathom_user_mappings;
CREATE POLICY "org_admins_manage_fathom_user_mappings" ON fathom_user_mappings
  FOR ALL
  TO authenticated
  USING (
    org_id IN (
      SELECT om.org_id FROM organization_memberships om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    org_id IN (
      SELECT om.org_id FROM organization_memberships om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
    OR auth.role() = 'service_role'
  );

-- Policy: Service role can insert (for sync operations)
DROP POLICY IF EXISTS "service_role_insert_fathom_user_mappings" ON fathom_user_mappings;
CREATE POLICY "service_role_insert_fathom_user_mappings" ON fathom_user_mappings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.role() = 'service_role'
    OR org_id IN (
      SELECT om.org_id FROM organization_memberships om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- Trigger: Auto-update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_fathom_user_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_fathom_user_mappings_updated_at ON fathom_user_mappings;
CREATE TRIGGER trigger_fathom_user_mappings_updated_at
  BEFORE UPDATE ON fathom_user_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_fathom_user_mappings_updated_at();

-- ============================================================================
-- Helper function: Resolve Fathom user email to Sixty user ID
-- Used by fathom-sync to determine meeting ownership
-- ============================================================================
CREATE OR REPLACE FUNCTION resolve_fathom_user_to_sixty(
  p_org_id UUID,
  p_fathom_email TEXT
)
RETURNS UUID AS $$
DECLARE
  v_sixty_user_id UUID;
BEGIN
  -- Normalize email to lowercase
  SELECT sixty_user_id INTO v_sixty_user_id
  FROM fathom_user_mappings
  WHERE org_id = p_org_id
    AND fathom_user_email = LOWER(TRIM(p_fathom_email))
    AND sixty_user_id IS NOT NULL;
  
  RETURN v_sixty_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION resolve_fathom_user_to_sixty(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_fathom_user_to_sixty(UUID, TEXT) TO service_role;





