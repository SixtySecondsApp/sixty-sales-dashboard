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
SELECT cron.schedule(
  'fathom-hourly-sync',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ygdpgliavpxeugaajgrb.supabase.co/functions/v1/fathom-cron-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnZHBnbGlhdnB4ZXVnYWFqZ3JiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTE4OTQ2MSwiZXhwIjoyMDgwNzY1NDYxfQ.n9MVawseoWgWSu7H48-lgpvl3dUFMqofI7lWlbqmEfI'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================================
-- NOTES:
-- - SavvyCal: Runs every 15 min, checks last 2 hours of events
-- - Fathom: Runs hourly, syncs all active user integrations
-- - Both functions handle deduplication internally
-- - Monitor via: SELECT * FROM cron.job_run_details ORDER BY start_time DESC;
-- ============================================================================
