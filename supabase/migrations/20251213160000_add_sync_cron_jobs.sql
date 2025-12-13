-- Sync Cron Jobs for SavvyCal and Fathom
-- Run manually in SQL Editor due to CLI connection issues

-- ============================================================================
-- 1. SAVVYCAL SYNC (every 15 minutes)
-- Backup to webhook - catches any missed booking events
-- ============================================================================
SELECT cron.schedule(
  'sync-savvycal-events-backup',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ygdpgliavpxeugaajgrb.supabase.co/functions/v1/sync-savvycal-events?since_hours=2',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================================
-- 2. FATHOM SYNC (every hour)
-- Syncs all users with active Fathom integrations
-- No webhook dependency - polls Fathom API directly
-- ============================================================================
-- IMPORTANT (SECURITY):
-- Do NOT hardcode service role tokens in SQL.
-- Use the safer config-based trigger from `20251213190000_fix_fathom_cron_config.sql`
-- which reads the service role key from `cron_job_config` (service-role only).
--
-- If you need the hourly job, schedule the trigger function:
--   SELECT cron.schedule('fathom-hourly-sync', '0 * * * *', $$ SELECT public.trigger_fathom_hourly_sync(); $$);
--
-- Or use an external cron (Vercel, etc.) with a dedicated secret header.

-- ============================================================================
-- NOTES:
-- - SavvyCal: Runs every 15 min, checks last 2 hours of events
-- - Fathom: Runs hourly, syncs all active user integrations
-- - Both functions handle deduplication internally
-- - Monitor via: SELECT * FROM cron.job_run_details ORDER BY start_time DESC;
-- ============================================================================
