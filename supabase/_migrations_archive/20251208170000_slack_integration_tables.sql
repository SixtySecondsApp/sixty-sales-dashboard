-- ============================================================================
-- Migration: Slack Integration Tables
-- ============================================================================
-- Purpose: Create tables for Slack integration including org settings,
-- notification preferences, user mappings, deal rooms, and tracking.
-- ============================================================================

-- ============================================================================
-- Table 1: slack_org_settings
-- Stores org-level Slack workspace connection details
-- ============================================================================
CREATE TABLE IF NOT EXISTS slack_org_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  slack_team_id TEXT,                     -- Slack workspace ID
  slack_team_name TEXT,                   -- Slack workspace name
  bot_access_token TEXT,                  -- Encrypted bot token
  bot_user_id TEXT,                       -- Bot's Slack user ID
  is_connected BOOLEAN DEFAULT false,
  connected_at TIMESTAMPTZ,
  connected_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for quick org lookups
CREATE INDEX IF NOT EXISTS idx_slack_org_settings_org_id ON slack_org_settings(org_id);
CREATE INDEX IF NOT EXISTS idx_slack_org_settings_slack_team_id ON slack_org_settings(slack_team_id);

-- ============================================================================
-- Table 2: slack_notification_settings
-- Feature-level notification settings (controlled by team admin)
-- ============================================================================
CREATE TABLE IF NOT EXISTS slack_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,                  -- 'meeting_debrief', 'daily_digest', 'meeting_prep', 'deal_rooms'
  is_enabled BOOLEAN DEFAULT true,
  delivery_method TEXT DEFAULT 'channel', -- 'channel' or 'dm'
  channel_id TEXT,                        -- Slack channel ID (if delivery_method = 'channel')
  channel_name TEXT,                      -- For display
  schedule_time TIME,                     -- For daily_digest (e.g., '08:00')
  schedule_timezone TEXT DEFAULT 'UTC',   -- For daily_digest
  -- Deal room specific settings
  deal_value_threshold NUMERIC,           -- Minimum deal value to create room
  deal_stage_trigger TEXT,                -- Stage that triggers room creation
  stakeholder_slack_ids TEXT[],           -- Additional Slack user IDs to invite
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, feature)
);

-- Index for quick feature lookups
CREATE INDEX IF NOT EXISTS idx_slack_notification_settings_org_feature
  ON slack_notification_settings(org_id, feature);

-- ============================================================================
-- Table 3: slack_notifications_sent
-- Track sent notifications to avoid duplicates
-- ============================================================================
CREATE TABLE IF NOT EXISTS slack_notifications_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,                  -- 'meeting_debrief', 'daily_digest', 'meeting_prep'
  entity_type TEXT,                       -- 'meeting', 'digest', 'prep'
  entity_id UUID,                         -- meeting_id, etc.
  recipient_type TEXT,                    -- 'channel' or 'user'
  recipient_id TEXT,                      -- channel_id or slack_user_id
  slack_ts TEXT,                          -- Slack message timestamp (for threading)
  slack_channel_id TEXT,                  -- Channel where message was sent
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for duplicate detection and lookups
CREATE INDEX IF NOT EXISTS idx_slack_notifications_sent_lookup
  ON slack_notifications_sent(org_id, feature, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_slack_notifications_sent_channel
  ON slack_notifications_sent(slack_channel_id, slack_ts);

-- ============================================================================
-- Table 4: slack_user_mappings
-- Map Slack users to Sixty users for @mentions and DMs
-- ============================================================================
CREATE TABLE IF NOT EXISTS slack_user_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  slack_user_id TEXT NOT NULL,
  slack_username TEXT,
  slack_display_name TEXT,
  slack_email TEXT,                       -- For auto-matching
  slack_avatar_url TEXT,
  sixty_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_auto_matched BOOLEAN DEFAULT false,  -- Whether matched automatically by email
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, slack_user_id)
);

-- Indexes for user lookups
CREATE INDEX IF NOT EXISTS idx_slack_user_mappings_org_slack
  ON slack_user_mappings(org_id, slack_user_id);
CREATE INDEX IF NOT EXISTS idx_slack_user_mappings_sixty_user
  ON slack_user_mappings(sixty_user_id);
CREATE INDEX IF NOT EXISTS idx_slack_user_mappings_email
  ON slack_user_mappings(org_id, slack_email);

-- ============================================================================
-- Table 5: slack_deal_rooms
-- Track deal room channels
-- NOTE: Conditional on deals table existing (staging compatibility)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deals') THEN
    -- Create table only if deals table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'slack_deal_rooms') THEN
      CREATE TABLE slack_deal_rooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        deal_id UUID REFERENCES deals(id) ON DELETE CASCADE UNIQUE,
        slack_channel_id TEXT NOT NULL,
        slack_channel_name TEXT NOT NULL,
        is_archived BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT now(),
        archived_at TIMESTAMPTZ,
        -- Track who was invited
        invited_slack_user_ids TEXT[]
      );
    END IF;

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_slack_deal_rooms_org ON slack_deal_rooms(org_id);
    CREATE INDEX IF NOT EXISTS idx_slack_deal_rooms_deal ON slack_deal_rooms(deal_id);
    CREATE INDEX IF NOT EXISTS idx_slack_deal_rooms_channel ON slack_deal_rooms(slack_channel_id);
  ELSE
    RAISE NOTICE 'Skipping slack_deal_rooms table - deals table does not exist';
  END IF;
END $$;

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE slack_org_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_notifications_sent ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_user_mappings ENABLE ROW LEVEL SECURITY;

-- Enable RLS on slack_deal_rooms only if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'slack_deal_rooms') THEN
    ALTER TABLE slack_deal_rooms ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- slack_org_settings policies (drop first to make idempotent)
DROP POLICY IF EXISTS "org_admins_manage_slack_settings" ON slack_org_settings;
CREATE POLICY "org_admins_manage_slack_settings" ON slack_org_settings
  FOR ALL
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR auth.role() = 'service_role'
  );

-- slack_notification_settings policies (drop first to make idempotent)
DROP POLICY IF EXISTS "org_admins_manage_notification_settings" ON slack_notification_settings;
CREATE POLICY "org_admins_manage_notification_settings" ON slack_notification_settings
  FOR ALL
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR auth.role() = 'service_role'
  );

-- slack_notifications_sent policies (drop first to make idempotent)
DROP POLICY IF EXISTS "org_members_view_sent_notifications" ON slack_notifications_sent;
CREATE POLICY "org_members_view_sent_notifications" ON slack_notifications_sent
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM organization_memberships WHERE user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "service_role_insert_notifications" ON slack_notifications_sent;
CREATE POLICY "service_role_insert_notifications" ON slack_notifications_sent
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'service_role');

-- slack_user_mappings policies (drop first to make idempotent)
DROP POLICY IF EXISTS "org_members_view_user_mappings" ON slack_user_mappings;
CREATE POLICY "org_members_view_user_mappings" ON slack_user_mappings
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM organization_memberships WHERE user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "org_admins_manage_user_mappings" ON slack_user_mappings;
CREATE POLICY "org_admins_manage_user_mappings" ON slack_user_mappings
  FOR ALL
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR auth.role() = 'service_role'
  );

-- slack_deal_rooms policies (conditional on table existing)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'slack_deal_rooms') THEN
    DROP POLICY IF EXISTS "org_members_view_deal_rooms" ON slack_deal_rooms;
    CREATE POLICY "org_members_view_deal_rooms" ON slack_deal_rooms
      FOR SELECT
      TO authenticated
      USING (
        org_id IN (
          SELECT org_id FROM organization_memberships WHERE user_id = auth.uid()
        )
        OR auth.role() = 'service_role'
      );

    DROP POLICY IF EXISTS "service_role_manage_deal_rooms" ON slack_deal_rooms;
    CREATE POLICY "service_role_manage_deal_rooms" ON slack_deal_rooms
      FOR ALL
      TO authenticated
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- ============================================================================
-- Updated_at trigger function (if not exists)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_slack_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_slack_org_settings_updated_at ON slack_org_settings;
CREATE TRIGGER update_slack_org_settings_updated_at
  BEFORE UPDATE ON slack_org_settings
  FOR EACH ROW EXECUTE FUNCTION update_slack_updated_at();

DROP TRIGGER IF EXISTS update_slack_notification_settings_updated_at ON slack_notification_settings;
CREATE TRIGGER update_slack_notification_settings_updated_at
  BEFORE UPDATE ON slack_notification_settings
  FOR EACH ROW EXECUTE FUNCTION update_slack_updated_at();

DROP TRIGGER IF EXISTS update_slack_user_mappings_updated_at ON slack_user_mappings;
CREATE TRIGGER update_slack_user_mappings_updated_at
  BEFORE UPDATE ON slack_user_mappings
  FOR EACH ROW EXECUTE FUNCTION update_slack_updated_at();

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
DECLARE
  table_count INT;
  expected_count INT;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'slack_org_settings',
      'slack_notification_settings',
      'slack_notifications_sent',
      'slack_user_mappings',
      'slack_deal_rooms'
    );

  -- Expected count depends on whether deals table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deals') THEN
    expected_count := 5;
  ELSE
    expected_count := 4;
    RAISE NOTICE 'Note: slack_deal_rooms table skipped (deals table not present)';
  END IF;

  RAISE NOTICE 'Slack integration tables created: %/%', table_count, expected_count;
  RAISE NOTICE 'Slack integration migration completed ✓';
END;
$$;
