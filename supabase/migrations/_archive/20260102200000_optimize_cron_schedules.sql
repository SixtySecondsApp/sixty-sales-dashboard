-- Migration: Optimize Cron Schedules for Reduced REST Requests
-- Purpose: Reduce cron job frequency to minimize API overhead
-- Date: 2026-01-02
--
-- Changes:
-- 1. SavvyCal: Every 15 minutes → Every 4 hours (6x/day instead of 96x/day)
-- 2. Fathom: Every hour → Working hours only (8am-3pm weekdays, 8 calls/day instead of 24x/day)

-- ============================================================================
-- 1. UPDATE SAVVYCAL CRON (every 4 hours instead of every 15 minutes)
-- ============================================================================

-- Unschedule existing job
SELECT cron.unschedule('sync-savvycal-events-backup') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sync-savvycal-events-backup'
);

-- Schedule new job: Every 4 hours at minute 0 (00:00, 04:00, 08:00, 12:00, 16:00, 20:00)
-- Using 5-hour lookback window to ensure overlap and catch any missed webhook events
SELECT cron.schedule(
  'sync-savvycal-events-backup',
  '0 */4 * * *', -- Every 4 hours at minute 0
  $$
  SELECT net.http_post(
    url := 'https://ygdpgliavpxeugaajgrb.supabase.co/functions/v1/sync-savvycal-events?since_hours=5',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================================
-- 2. UPDATE FATHOM CRON (working hours only: 8am-3pm weekdays)
-- ============================================================================

-- Unschedule existing job
SELECT cron.unschedule('fathom-hourly-sync') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'fathom-hourly-sync'
);

-- Schedule new job: Hourly during working hours (8am-3pm, Monday-Friday)
-- This runs at: 8am, 9am, 10am, 11am, 12pm, 1pm, 2pm, 3pm = 8 calls/day
SELECT cron.schedule(
  'fathom-hourly-sync',
  '0 8-15 * * 1-5', -- Minute 0, hours 8-15 (8am-3pm), any day/month, Monday-Friday
  $$SELECT trigger_fathom_hourly_sync();$$
);

-- ============================================================================
-- 3. Update cron job monitoring settings (if table exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cron_job_settings') THEN
    UPDATE cron_job_settings
    SET 
      description = 'Syncs SavvyCal booking events every 4 hours (backup to webhook)'
    WHERE job_name = 'sync-savvycal-events-backup';

    UPDATE cron_job_settings
    SET 
      description = 'Syncs Fathom meeting recordings hourly during working hours (8am-3pm weekdays)'
    WHERE job_name = 'fathom-hourly-sync';
  END IF;
END $$;

-- ============================================================================
-- Migration Complete
-- ============================================================================

COMMENT ON FUNCTION trigger_fathom_hourly_sync() IS 'Triggers hourly incremental sync for all active Fathom integrations during working hours (8am-3pm weekdays)';
