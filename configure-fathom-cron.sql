-- ============================================================================
-- Fathom Integration: Database Configuration for Cron Sync
-- ============================================================================
-- Purpose: Configure database environment settings for hourly cron sync
-- Run this ONCE after deploying Edge Functions
-- ============================================================================

-- ============================================================================
-- 1. Configure Supabase URL (REQUIRED for cron sync)
-- ============================================================================
-- Replace 'your-project-ref' with your actual Supabase project reference
-- Example: https://abcdefghijklmnop.supabase.co

ALTER DATABASE postgres SET app.supabase_url = 'https://your-project-ref.supabase.co';

-- ============================================================================
-- 2. Configure Service Role Key (REQUIRED for cron sync)
-- ============================================================================
-- ⚠️  SECURITY WARNING: NEVER commit this file with the actual key!
-- Get your service role key from: Supabase Dashboard > Settings > API
-- The service role key should start with 'eyJ...'

-- ALTER DATABASE postgres SET app.supabase_service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE';

-- ============================================================================
-- 3. Verify Configuration
-- ============================================================================
-- Run this to check that settings are configured correctly:

SELECT
  current_setting('app.supabase_url', true) as supabase_url,
  CASE
    WHEN current_setting('app.supabase_service_role_key', true) IS NULL THEN 'NOT SET'
    ELSE 'CONFIGURED'
  END as service_role_key_status;

-- ============================================================================
-- 4. Verify Cron Jobs are Scheduled
-- ============================================================================
-- Check that hourly sync is scheduled:

SELECT
  jobid,
  jobname,
  schedule,
  active,
  jobid IN (SELECT jobid FROM cron.job_run_details ORDER BY start_time DESC LIMIT 1) as has_run
FROM cron.job
WHERE jobname IN ('fathom-hourly-sync', 'cleanup-cron-logs');

-- ============================================================================
-- 5. Test Cron Function Manually (Optional)
-- ============================================================================
-- Test the cron trigger function without waiting for scheduled execution:

-- SELECT trigger_fathom_hourly_sync();

-- ============================================================================
-- 6. View Recent Cron Job Logs
-- ============================================================================
-- Check execution history:

SELECT
  job_name,
  user_id,
  status,
  message,
  error_details,
  created_at
FROM cron_job_logs
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================================
-- 7. Check Active Fathom Integrations
-- ============================================================================
-- See which users have active Fathom connections:

SELECT
  fi.id,
  fi.user_id,
  fi.fathom_user_email,
  fi.is_active,
  fi.token_expires_at,
  fi.last_sync_at,
  fs.sync_status,
  fs.meetings_synced,
  fs.total_meetings_found,
  fs.last_sync_completed_at
FROM fathom_integrations fi
LEFT JOIN fathom_sync_state fs ON fs.integration_id = fi.id
WHERE fi.is_active = true
ORDER BY fi.created_at DESC;

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================

-- If cron sync is not working, check:
-- 1. Environment settings are configured (query in step 3)
-- 2. Edge Functions are deployed (check Supabase Dashboard)
-- 3. Service role key has correct permissions
-- 4. Check cron_job_logs for error messages

-- To manually trigger a sync for testing:
-- SELECT trigger_fathom_hourly_sync();

-- To reset sync state for a user:
-- UPDATE fathom_sync_state
-- SET sync_status = 'idle',
--     last_sync_error = NULL
-- WHERE user_id = 'YOUR_USER_ID';

-- ============================================================================
-- END OF CONFIGURATION
-- ============================================================================
