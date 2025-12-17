-- ============================================================================
-- Migration: Deal Room Auto-Archive Settings + Scheduling
-- ============================================================================
-- Purpose:
-- - Allow org admins to configure what happens to deal room channels when a deal
--   is marked Signed/Won or Lost:
--     - archive immediately, OR
--     - archive after a delay (configurable, e.g. 24 hours)
-- - Store a scheduled archive timestamp on each deal room so a cron job can
--   archive channels when due.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1) Org-level settings (slack_notification_settings for feature = 'deal_rooms')
-- --------------------------------------------------------------------------
ALTER TABLE slack_notification_settings
  ADD COLUMN IF NOT EXISTS deal_room_archive_mode TEXT DEFAULT 'delayed',
  ADD COLUMN IF NOT EXISTS deal_room_archive_delay_hours INTEGER DEFAULT 24;

-- Constrain values (idempotent via exception-safe DO block)
DO $$
BEGIN
  -- Mode constraint
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'slack_notification_settings_deal_room_archive_mode_chk'
  ) THEN
    ALTER TABLE slack_notification_settings
      ADD CONSTRAINT slack_notification_settings_deal_room_archive_mode_chk
      CHECK (deal_room_archive_mode IN ('immediate', 'delayed'));
  END IF;

  -- Delay range constraint (0..168 hours = up to 7 days)
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'slack_notification_settings_deal_room_archive_delay_hours_chk'
  ) THEN
    ALTER TABLE slack_notification_settings
      ADD CONSTRAINT slack_notification_settings_deal_room_archive_delay_hours_chk
      CHECK (deal_room_archive_delay_hours IS NULL OR (deal_room_archive_delay_hours >= 0 AND deal_room_archive_delay_hours <= 168));
  END IF;
END;
$$;

-- --------------------------------------------------------------------------
-- 2) Per-channel scheduling (slack_deal_rooms)
-- --------------------------------------------------------------------------
ALTER TABLE slack_deal_rooms
  ADD COLUMN IF NOT EXISTS archive_scheduled_for TIMESTAMPTZ;

-- Helpful index for cron lookups (only for due + active)
CREATE INDEX IF NOT EXISTS idx_slack_deal_rooms_archive_due
  ON slack_deal_rooms(archive_scheduled_for)
  WHERE is_archived = false AND archive_scheduled_for IS NOT NULL;

-- --------------------------------------------------------------------------
-- Verification
-- --------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'slack_notification_settings'
      AND column_name = 'deal_room_archive_mode'
  ) THEN
    RAISE NOTICE 'deal_room_archive_mode added ✓';
  ELSE
    RAISE EXCEPTION 'Failed to add deal_room_archive_mode';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'slack_notification_settings'
      AND column_name = 'deal_room_archive_delay_hours'
  ) THEN
    RAISE NOTICE 'deal_room_archive_delay_hours added ✓';
  ELSE
    RAISE EXCEPTION 'Failed to add deal_room_archive_delay_hours';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'slack_deal_rooms'
      AND column_name = 'archive_scheduled_for'
  ) THEN
    RAISE NOTICE 'slack_deal_rooms.archive_scheduled_for added ✓';
  ELSE
    RAISE EXCEPTION 'Failed to add slack_deal_rooms.archive_scheduled_for';
  END IF;

  RAISE NOTICE 'Deal room auto-archive migration completed ✓';
END;
$$;





