-- ============================================================================
-- ENCHARGE SCHEDULED EMAILS CRON JOB SETUP
-- Runs every hour to send trial reminders, expired notifications, and re-engagement emails
-- ============================================================================

-- First, ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing job if it exists (for idempotency)
SELECT cron.unschedule('scheduled-encharge-emails') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'scheduled-encharge-emails'
);

-- Get the project URL and service role key from environment
-- Note: These are automatically available in Supabase
DO $$
DECLARE
  v_project_url TEXT;
  v_service_role_key TEXT;
BEGIN
  -- Get project URL from current_database() or use the project ref
  -- For Supabase, we can construct it from the project ref
  -- Project ref: ygdpgliavpxeugaajgrb (from deployment output)
  v_project_url := 'https://ygdpgliavpxeugaajgrb.supabase.co';
  
  -- Service role key needs to be retrieved from vault or set manually
  -- For now, we'll use a placeholder that needs to be replaced
  -- You can get this from: Supabase Dashboard > Settings > API > service_role key
  v_service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- If not set, we'll need to set it manually or use a function
  -- For now, create the cron job with a function that will get the key
  NULL; -- Placeholder - will be set below
END $$;

-- Create a function to get the service role key from vault
-- This is a secure way to store and retrieve the key
CREATE OR REPLACE FUNCTION get_service_role_key()
RETURNS TEXT AS $$
BEGIN
  -- Try to get from vault (Supabase's secure storage)
  -- If not available, return NULL and the cron job will need manual setup
  RETURN current_setting('app.settings.service_role_key', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule the cron job
-- Note: You'll need to replace YOUR_SERVICE_ROLE_KEY with your actual service role key
-- Get it from: Supabase Dashboard > Settings > API > service_role (secret)
SELECT cron.schedule(
  'scheduled-encharge-emails',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
      url := 'https://ygdpgliavpxeugaajgrb.supabase.co/functions/v1/scheduled-encharge-emails',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Alternative: If the above doesn't work due to vault access, use this version
-- that requires manual service role key setup:
/*
SELECT cron.schedule(
  'scheduled-encharge-emails',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://ygdpgliavpxeugaajgrb.supabase.co/functions/v1/scheduled-encharge-emails',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY_HERE'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
*/

-- Verify the cron job was created
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job 
WHERE jobname = 'scheduled-encharge-emails';

-- ============================================================================
-- Manual Setup Instructions (if automatic setup fails)
-- ============================================================================
-- 1. Get your service role key from Supabase Dashboard:
--    Settings > API > service_role (secret) - copy this value
--
-- 2. Run this SQL in the Supabase SQL Editor, replacing YOUR_SERVICE_ROLE_KEY:
--
-- SELECT cron.schedule(
--   'scheduled-encharge-emails',
--   '0 * * * *',
--   $$
--   SELECT
--     net.http_post(
--       url := 'https://ygdpgliavpxeugaajgrb.supabase.co/functions/v1/scheduled-encharge-emails',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY_HERE'
--       ),
--       body := '{}'::jsonb
--     ) AS request_id;
--   $$
-- );
--
-- 3. Verify it's scheduled:
-- SELECT * FROM cron.job WHERE jobname = 'scheduled-encharge-emails';
-- ============================================================================
