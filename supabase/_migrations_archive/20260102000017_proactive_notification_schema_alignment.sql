-- ============================================================================
-- Migration: Proactive Notifications - Schema Alignment
-- Date: 2026-01-02
-- Purpose:
--   Align Slack proactive notification code with existing Slack integration tables.
--   Adds additive columns used by the Proactive Engine for:
--   - dedupe keys (supports non-UUID entities like email thread IDs)
--   - feature thresholds/settings payloads
--   - optional metadata storage
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1) slack_notification_settings: add flexible config fields
-- --------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'slack_notification_settings'
      AND column_name = 'thresholds'
  ) THEN
    ALTER TABLE public.slack_notification_settings
      ADD COLUMN thresholds JSONB DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'slack_notification_settings'
      AND column_name = 'schedule'
  ) THEN
    -- Optional: generic schedule string (e.g. cron expression or "08:00")
    -- Existing columns schedule_time/schedule_timezone remain canonical for daily_digest.
    ALTER TABLE public.slack_notification_settings
      ADD COLUMN schedule TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'slack_notification_settings'
      AND column_name = 'target_channel_id'
  ) THEN
    -- Optional: generic target channel (some features may use channel_id already)
    ALTER TABLE public.slack_notification_settings
      ADD COLUMN target_channel_id TEXT;
  END IF;
END;
$$;

-- --------------------------------------------------------------------------
-- 2) slack_notifications_sent: add dedupe + metadata fields
-- --------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'slack_notifications_sent'
      AND column_name = 'dedupe_key'
  ) THEN
    ALTER TABLE public.slack_notifications_sent
      ADD COLUMN dedupe_key TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'slack_notifications_sent'
      AND column_name = 'slack_message_ts'
  ) THEN
    -- New canonical name used by newer proactive code; we keep slack_ts for backwards compatibility.
    ALTER TABLE public.slack_notifications_sent
      ADD COLUMN slack_message_ts TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'slack_notifications_sent'
      AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.slack_notifications_sent
      ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'slack_notifications_sent'
      AND column_name = 'entity_key'
  ) THEN
    -- Optional non-UUID entity identifier (e.g. email thread ID).
    ALTER TABLE public.slack_notifications_sent
      ADD COLUMN entity_key TEXT;
  END IF;
END;
$$;

-- Backfill slack_message_ts from slack_ts if needed (best-effort)
UPDATE public.slack_notifications_sent
SET slack_message_ts = slack_ts
WHERE slack_message_ts IS NULL AND slack_ts IS NOT NULL;

-- Helpful indexes for dedupe lookups
CREATE INDEX IF NOT EXISTS idx_slack_notifications_sent_dedupe_key
  ON public.slack_notifications_sent(org_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL AND dedupe_key <> '';

CREATE INDEX IF NOT EXISTS idx_slack_notifications_sent_dedupe_recent
  ON public.slack_notifications_sent(dedupe_key, sent_at DESC)
  WHERE dedupe_key IS NOT NULL AND dedupe_key <> '';

-- --------------------------------------------------------------------------
-- Verification
-- --------------------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE 'Proactive notification schema alignment migration completed ✓';
END;
$$;

