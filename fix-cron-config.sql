-- Fix Cron Job Configuration
-- Run this in Supabase SQL Editor to enable the hourly sync backup

-- Set Supabase URL (replace with your actual project URL)
ALTER DATABASE postgres SET app.supabase_url = 'https://your-project.supabase.co';

-- Set Service Role Key (replace with your actual service role key from Supabase dashboard)
-- IMPORTANT: Get this from Settings > API > service_role key (secret)
ALTER DATABASE postgres SET app.supabase_service_role_key = 'your-service-role-key-here';

-- Verify the settings were applied
SELECT
  name,
  setting
FROM pg_settings
WHERE name IN ('app.supabase_url', 'app.supabase_service_role_key');

-- Check cron job status
SELECT * FROM cron.job WHERE jobname = 'fathom-hourly-sync';

-- View recent cron logs
SELECT
  job_name,
  status,
  message,
  error_details,
  created_at
FROM cron_job_logs
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 20;

-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard > Settings > API
-- 2. Copy your Project URL (e.g., https://abcdefg.supabase.co)
-- 3. Copy your service_role key (it's marked as secret)
-- 4. Replace the placeholder values above
-- 5. Run the ALTER DATABASE statements
-- 6. Verify with the SELECT statements
