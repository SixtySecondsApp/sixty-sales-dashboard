-- Migration: Notetaker User Settings
-- Purpose: Per-user configuration for 60 Notetaker integration
-- Date: 2026-01-04

-- =============================================================================
-- 1. notetaker_user_settings - Per-user notetaker configuration
-- =============================================================================
CREATE TABLE IF NOT EXISTS notetaker_user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- User-level feature toggle
  is_enabled BOOLEAN DEFAULT false,

  -- Recording preferences
  auto_record_external BOOLEAN DEFAULT true,  -- Record meetings with external participants
  auto_record_internal BOOLEAN DEFAULT false, -- Record internal meetings

  -- Notification preferences
  notify_before_join BOOLEAN DEFAULT true,
  notify_minutes_before INTEGER DEFAULT 5 CHECK (notify_minutes_before >= 1 AND notify_minutes_before <= 30),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one settings record per user per org
  UNIQUE(user_id, org_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notetaker_user_settings_user ON notetaker_user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_notetaker_user_settings_org ON notetaker_user_settings(org_id);
CREATE INDEX IF NOT EXISTS idx_notetaker_user_settings_enabled ON notetaker_user_settings(org_id, is_enabled);

-- =============================================================================
-- 2. Add notetaker_enabled to organizations if not exists
-- =============================================================================
-- The recording_settings JSONB already has 'recordings_enabled', but we want a
-- clearer 'notetaker_enabled' flag at org level.

DO $$
BEGIN
  -- Check if notetaker_enabled field exists in recording_settings
  -- If not, organizations using this feature will need to have it enabled
  -- For now, we'll read recordings_enabled from the JSONB as the org-level flag
  NULL;
END $$;

-- =============================================================================
-- 3. RLS Policies
-- =============================================================================
ALTER TABLE notetaker_user_settings ENABLE ROW LEVEL SECURITY;

-- Users can view their own settings
CREATE POLICY "Users can view their own notetaker settings"
  ON notetaker_user_settings FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own settings
CREATE POLICY "Users can create their own notetaker settings"
  ON notetaker_user_settings FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own settings
CREATE POLICY "Users can update their own notetaker settings"
  ON notetaker_user_settings FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own settings
CREATE POLICY "Users can delete their own notetaker settings"
  ON notetaker_user_settings FOR DELETE
  USING (user_id = auth.uid());

-- Admins can view org member settings
CREATE POLICY "Admins can view org notetaker settings"
  ON notetaker_user_settings FOR SELECT
  USING (
    org_id IN (
      SELECT om.org_id FROM organization_memberships om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

-- =============================================================================
-- 4. Trigger for updated_at
-- =============================================================================
DROP TRIGGER IF EXISTS update_notetaker_user_settings_updated_at ON notetaker_user_settings;
CREATE TRIGGER update_notetaker_user_settings_updated_at
  BEFORE UPDATE ON notetaker_user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
