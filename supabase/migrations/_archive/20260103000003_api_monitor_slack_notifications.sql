-- Migration: Add cron job for API monitor Slack notifications
-- Notifies platform admins when high-priority API improvements are detected

-- Create function to call the edge function via pg_net
CREATE OR REPLACE FUNCTION notify_api_monitor_improvements()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Get Supabase configuration from environment
  supabase_url := current_setting('app.supabase_url', true);
  service_role_key := current_setting('app.supabase_service_role_key', true);

  -- If not configured, log warning and exit
  IF supabase_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING 'Supabase configuration not set for API monitor notifications';
    RETURN;
  END IF;

  -- Call the edge function using pg_net (Supabase's async HTTP)
  BEGIN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/api-monitor-notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := '{}'::jsonb
    );

    RAISE NOTICE 'API Monitor notification check triggered';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to invoke API monitor notification Edge Function: %', SQLERRM;
  END;
END;
$$;

-- Schedule cron job to run daily at 9 AM UTC (during working hours)
-- Only runs if there are high-priority issues detected
SELECT cron.schedule(
  'api-monitor-notify-daily',
  '0 9 * * *', -- 9 AM UTC daily
  $$
  SELECT notify_api_monitor_improvements();
  $$
);

-- Also create a more frequent check (every 6 hours) for critical issues
-- This can be enabled/disabled via cron-admin UI
SELECT cron.schedule(
  'api-monitor-notify-frequent',
  '0 */6 * * *', -- Every 6 hours
  $$
  SELECT notify_api_monitor_improvements();
  $$
);

-- Grant permissions
GRANT EXECUTE ON FUNCTION notify_api_monitor_improvements() TO postgres;

-- Add metadata for cron-admin UI (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cron_job_metadata') THEN
    INSERT INTO cron_job_metadata (job_name, display_name, description, category, is_monitored, alert_on_failure)
    VALUES
      ('api-monitor-notify-daily', 'API Monitor Daily Notifications', 'Notifies platform admins of high-priority API improvements daily', 'monitoring', true, true),
      ('api-monitor-notify-frequent', 'API Monitor Frequent Notifications', 'Notifies platform admins of high-priority API improvements every 6 hours', 'monitoring', true, true)
    ON CONFLICT (job_name) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      description = EXCLUDED.description,
      category = EXCLUDED.category,
      is_monitored = EXCLUDED.is_monitored,
      alert_on_failure = EXCLUDED.alert_on_failure;
  END IF;
END $$;

-- Comments
COMMENT ON FUNCTION notify_api_monitor_improvements() IS 'Triggers API monitor notification Edge Function to notify platform admins of high-priority API improvements';

-- ============================================================================
-- Migration Complete
-- ============================================================================
