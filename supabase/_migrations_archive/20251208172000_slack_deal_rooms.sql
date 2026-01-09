-- ============================================================================
-- Migration: Slack Deal Rooms
-- ============================================================================
-- Purpose: Add table for tracking deal room Slack channels and update
-- notification settings for deal room configuration
-- ============================================================================

-- Create slack_deal_rooms table
CREATE TABLE IF NOT EXISTS slack_deal_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  slack_channel_id TEXT NOT NULL,
  slack_channel_name TEXT NOT NULL,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  archived_at TIMESTAMPTZ,
  UNIQUE(deal_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_slack_deal_rooms_org_id ON slack_deal_rooms(org_id);
CREATE INDEX IF NOT EXISTS idx_slack_deal_rooms_deal_id ON slack_deal_rooms(deal_id);
CREATE INDEX IF NOT EXISTS idx_slack_deal_rooms_channel_id ON slack_deal_rooms(slack_channel_id);
CREATE INDEX IF NOT EXISTS idx_slack_deal_rooms_active ON slack_deal_rooms(org_id, is_archived) WHERE is_archived = false;

-- Add deal room specific columns to slack_notification_settings
ALTER TABLE slack_notification_settings
  ADD COLUMN IF NOT EXISTS deal_value_threshold INTEGER DEFAULT 25000,
  ADD COLUMN IF NOT EXISTS deal_stage_threshold TEXT DEFAULT 'opportunity',
  ADD COLUMN IF NOT EXISTS stakeholder_slack_ids TEXT[] DEFAULT '{}';

-- Add RLS policies
ALTER TABLE slack_deal_rooms ENABLE ROW LEVEL SECURITY;

-- Org members can view their org's deal rooms
CREATE POLICY "Users can view their org's deal rooms" ON slack_deal_rooms
  FOR SELECT
  USING (
    org_id IN (
      SELECT om.org_id FROM organization_memberships om WHERE om.user_id = auth.uid()
    )
  );

-- Only admins can insert/update/delete deal rooms
CREATE POLICY "Admins can manage deal rooms" ON slack_deal_rooms
  FOR ALL
  USING (
    org_id IN (
      SELECT om.org_id FROM organization_memberships om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
    )
  );

-- Enable realtime for deal rooms
ALTER PUBLICATION supabase_realtime ADD TABLE slack_deal_rooms;

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'slack_deal_rooms') THEN
    RAISE NOTICE 'slack_deal_rooms table created successfully ✓';
  ELSE
    RAISE EXCEPTION 'Failed to create slack_deal_rooms table';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'slack_notification_settings'
    AND column_name = 'deal_value_threshold'
  ) THEN
    RAISE NOTICE 'Deal room columns added to slack_notification_settings ✓';
  ELSE
    RAISE EXCEPTION 'Failed to add deal room columns';
  END IF;

  RAISE NOTICE 'Slack deal rooms migration completed ✓';
END;
$$;
