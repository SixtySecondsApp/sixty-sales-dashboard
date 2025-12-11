-- ============================================================================
-- MANUAL ENCHARGE CRON JOB SETUP
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Step 1: Ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Step 2: Remove existing job if it exists
SELECT cron.unschedule('scheduled-encharge-emails') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'scheduled-encharge-emails'
);

-- Step 3: Schedule the cron job
-- IMPORTANT: Replace YOUR_SERVICE_ROLE_KEY with your actual service role key
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
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY_HERE'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Step 4: Verify the cron job was created
SELECT 
  jobid,
  schedule,
  command,
  active,
  jobname
FROM cron.job 
WHERE jobname = 'scheduled-encharge-emails';

-- ============================================================================
-- Instructions:
-- ============================================================================
-- 1. Copy this entire file
-- 2. Go to Supabase Dashboard > SQL Editor
-- 3. Replace YOUR_SERVICE_ROLE_KEY_HERE with your actual service role key:
--    - Go to Settings > API
--    - Find "service_role" key (it's secret, click to reveal)
--    - Copy the entire key
--    - Replace YOUR_SERVICE_ROLE_KEY_HERE in the SQL above
-- 4. Run the SQL
-- 5. Verify the job is scheduled (the SELECT at the end should show 1 row)
-- ============================================================================
