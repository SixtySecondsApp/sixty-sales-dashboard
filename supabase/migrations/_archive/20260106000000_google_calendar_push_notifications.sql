-- Migration: Google Calendar Push Notifications (Webhooks)
-- Purpose: Enable real-time calendar sync via Google's push notification API
-- Date: 2026-01-06
--
-- This migration creates infrastructure for Google Calendar webhooks,
-- allowing us to receive notifications when calendar events change
-- instead of polling the API.

-- =============================================================================
-- 1. Create table to track webhook channels
-- =============================================================================

CREATE TABLE IF NOT EXISTS google_calendar_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Google channel details
  channel_id TEXT NOT NULL UNIQUE, -- UUID we generate for this channel
  resource_id TEXT NOT NULL, -- Google's resource identifier
  calendar_id TEXT NOT NULL DEFAULT 'primary', -- Which calendar (usually 'primary')

  -- Webhook configuration
  webhook_url TEXT NOT NULL, -- Our endpoint URL
  expiration_time TIMESTAMPTZ NOT NULL, -- When channel expires (max 7 days for Calendar API)

  -- Status tracking
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_notification_at TIMESTAMPTZ,
  notification_count INTEGER NOT NULL DEFAULT 0,

  -- Sync tokens for incremental sync
  sync_token TEXT, -- Latest sync token from Google

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 2. Create indexes for performance
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_calendar_channels_user
  ON google_calendar_channels(user_id);

CREATE INDEX IF NOT EXISTS idx_calendar_channels_org
  ON google_calendar_channels(org_id);

CREATE INDEX IF NOT EXISTS idx_calendar_channels_channel_id
  ON google_calendar_channels(channel_id);

CREATE INDEX IF NOT EXISTS idx_calendar_channels_active
  ON google_calendar_channels(is_active, expiration_time)
  WHERE is_active = true;

-- =============================================================================
-- 3. Create RLS policies
-- =============================================================================

ALTER TABLE google_calendar_channels ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own calendar channels" ON google_calendar_channels;
DROP POLICY IF EXISTS "Users can create own calendar channels" ON google_calendar_channels;
DROP POLICY IF EXISTS "Users can update own calendar channels" ON google_calendar_channels;
DROP POLICY IF EXISTS "Users can delete own calendar channels" ON google_calendar_channels;
DROP POLICY IF EXISTS "Service role has full access to calendar channels" ON google_calendar_channels;

-- Users can view their own channels
CREATE POLICY "Users can view own calendar channels"
  ON google_calendar_channels
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND org_id IN (
      SELECT org_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Users can create their own channels
CREATE POLICY "Users can create own calendar channels"
  ON google_calendar_channels
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND org_id IN (
      SELECT org_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Users can update their own channels
CREATE POLICY "Users can update own calendar channels"
  ON google_calendar_channels
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND org_id IN (
      SELECT org_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Users can delete their own channels
CREATE POLICY "Users can delete own calendar channels"
  ON google_calendar_channels
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND org_id IN (
      SELECT org_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Service role can do anything (for webhooks and cron jobs)
CREATE POLICY "Service role has full access to calendar channels"
  ON google_calendar_channels
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- 4. Add org_id column to calendar_events if not exists
-- =============================================================================

DO $$
BEGIN
  -- Check if org_id column exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'calendar_events'
    AND column_name = 'org_id'
  ) THEN
    -- Add org_id column
    ALTER TABLE calendar_events
    ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

    -- Create index
    CREATE INDEX idx_calendar_events_org
      ON calendar_events(org_id);

    -- Backfill org_id from user's current organization
    -- This assumes users have a default org in organization_memberships
    UPDATE calendar_events ce
    SET org_id = (
      SELECT om.org_id
      FROM organization_memberships om
      WHERE om.user_id = ce.user_id
      LIMIT 1
    )
    WHERE org_id IS NULL;
  END IF;
END $$;

-- =============================================================================
-- 5. Create function to cleanup expired channels
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_calendar_channels()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  -- Mark expired channels as inactive
  UPDATE google_calendar_channels
  SET is_active = false,
      updated_at = NOW()
  WHERE is_active = true
    AND expiration_time < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;

  RETURN expired_count;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_calendar_channels IS
  'Marks expired Google Calendar webhook channels as inactive';

-- =============================================================================
-- 6. Create cron job to cleanup expired channels daily
-- =============================================================================

-- This runs at 2 AM every day to cleanup expired channels
SELECT cron.schedule(
  'cleanup-expired-calendar-channels',
  '0 2 * * *', -- Daily at 2 AM
  $$
  SELECT cleanup_expired_calendar_channels();
  $$
);

COMMENT ON TABLE google_calendar_channels IS
  'Tracks Google Calendar push notification webhook subscriptions for real-time calendar sync';
