-- Add organization-level branding settings
-- This migration updates branding_settings to support per-organization logos

-- Add org_id column to branding_settings
ALTER TABLE branding_settings
ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create index for org_id lookups
CREATE INDEX IF NOT EXISTS idx_branding_settings_org_id ON branding_settings(org_id);

-- Create unique constraint - one branding record per org (nullable for legacy global record)
CREATE UNIQUE INDEX IF NOT EXISTS idx_branding_settings_org_unique
ON branding_settings(org_id) WHERE org_id IS NOT NULL;

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Anyone can read branding settings" ON branding_settings;
DROP POLICY IF EXISTS "Admins can manage branding settings" ON branding_settings;

-- New RLS Policies for organization-scoped branding

-- Policy: Users can read their org's branding settings OR the global fallback
CREATE POLICY "Users can read org or global branding settings"
  ON branding_settings FOR SELECT
  TO authenticated
  USING (
    -- Can read global settings (org_id IS NULL)
    org_id IS NULL
    OR
    -- Can read their own org's settings
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = branding_settings.org_id
      AND organization_memberships.user_id = auth.uid()
    )
  );

-- Policy: Org admins/owners can manage their org's branding settings
CREATE POLICY "Org admins can manage branding settings"
  ON branding_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    -- For org-specific settings, user must be admin/owner of that org
    org_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = branding_settings.org_id
      AND organization_memberships.user_id = auth.uid()
      AND organization_memberships.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org admins can update branding settings"
  ON branding_settings FOR UPDATE
  TO authenticated
  USING (
    -- For org-specific settings, user must be admin/owner of that org
    org_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = branding_settings.org_id
      AND organization_memberships.user_id = auth.uid()
      AND organization_memberships.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    org_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = branding_settings.org_id
      AND organization_memberships.user_id = auth.uid()
      AND organization_memberships.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org admins can delete branding settings"
  ON branding_settings FOR DELETE
  TO authenticated
  USING (
    -- For org-specific settings, user must be admin/owner of that org
    org_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = branding_settings.org_id
      AND organization_memberships.user_id = auth.uid()
      AND organization_memberships.role IN ('owner', 'admin')
    )
  );

-- Policy: Super admins (is_admin in profiles) can manage global settings
CREATE POLICY "Super admins can manage global branding"
  ON branding_settings FOR ALL
  TO authenticated
  USING (
    org_id IS NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Comment on table
COMMENT ON TABLE branding_settings IS 'Organization branding settings for logos and icons. Supports per-org branding with fallback to global defaults.';
COMMENT ON COLUMN branding_settings.org_id IS 'Organization ID for org-specific branding. NULL for global/default branding.';
