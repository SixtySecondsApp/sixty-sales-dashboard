-- Migration: Setup Fathom Hourly Sync Cron Job
-- Purpose: Configure automated hourly sync for all active Fathom integrations
-- Date: 2025-01-24

-- ============================================================================
-- 1. Enable pg_cron extension (if not already enabled)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- ============================================================================
-- 2. Create function to trigger sync for all active integrations
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_fathom_hourly_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
  http_response JSONB;
BEGIN
  -- Get Supabase configuration from environment
  -- Note: These would be set via ALTER DATABASE SET or vault
  supabase_url := current_setting('app.supabase_url', true);
  service_role_key := current_setting('app.supabase_service_role_key', true);

  -- If not configured, log warning and exit
  IF supabase_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING 'Supabase configuration not set for cron sync';

    INSERT INTO public.cron_job_logs (
      job_name,
      status,
      message,
      created_at
    ) VALUES (
      'fathom_hourly_sync',
      'error',
      'Supabase configuration missing',
      NOW()
    );

    RETURN;
  END IF;

  -- Call the Edge Function using HTTP extension (requires http extension)
  -- Note: Install with: CREATE EXTENSION IF NOT EXISTS http;
  -- For now, we'll use a simpler approach with pg_net (Supabase's async HTTP)

  BEGIN
    -- Use pg_net.http_post to call the Edge Function asynchronously
    -- This requires pg_net extension (available in Supabase)
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/fathom-cron-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := '{}'::jsonb
    );

    -- Log the trigger
    INSERT INTO public.cron_job_logs (
      job_name,
      status,
      message,
      created_at
    ) VALUES (
      'fathom_hourly_sync',
      'triggered',
      'Cron sync Edge Function invoked',
      NOW()
    );

  EXCEPTION WHEN OTHERS THEN
    -- Log error
    INSERT INTO public.cron_job_logs (
      job_name,
      status,
      message,
      error_details,
      created_at
    ) VALUES (
      'fathom_hourly_sync',
      'error',
      'Failed to invoke Edge Function',
      SQLERRM,
      NOW()
    );
  END;

  RAISE NOTICE 'Fathom cron sync Edge Function invoked';
END;
$$;

-- ============================================================================
-- 3. Create cron job logs table
-- ============================================================================

CREATE TABLE IF NOT EXISTS cron_job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('triggered', 'success', 'error')),
  message TEXT,
  error_details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cron_job_logs_job_name ON cron_job_logs(job_name);
CREATE INDEX IF NOT EXISTS idx_cron_job_logs_user_id ON cron_job_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_cron_job_logs_created_at ON cron_job_logs(created_at DESC);

-- ============================================================================
-- 4. Enable Row Level Security on cron_job_logs
-- ============================================================================

ALTER TABLE cron_job_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own logs
CREATE POLICY "Users can view own cron logs"
  ON cron_job_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all logs
CREATE POLICY "Service role can manage cron logs"
  ON cron_job_logs
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- 5. Schedule cron job to run every hour
-- ============================================================================

-- Remove existing job if it exists
SELECT cron.unschedule('fathom-hourly-sync') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'fathom-hourly-sync'
);

-- Schedule new job (runs at minute 0 of every hour)
SELECT cron.schedule(
  'fathom-hourly-sync',
  '0 * * * *', -- Every hour at minute 0
  $$SELECT trigger_fathom_hourly_sync();$$
);

-- ============================================================================
-- 6. Create cleanup function for old logs
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_cron_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete logs older than 30 days
  DELETE FROM cron_job_logs
  WHERE created_at < NOW() - INTERVAL '30 days';

  RAISE NOTICE 'Cleaned up cron logs older than 30 days';
END;
$$;

-- Schedule cleanup to run daily at 2 AM
SELECT cron.unschedule('cleanup-cron-logs') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-cron-logs'
);

SELECT cron.schedule(
  'cleanup-cron-logs',
  '0 2 * * *', -- Daily at 2 AM
  $$SELECT cleanup_old_cron_logs();$$
);

-- ============================================================================
-- 7. Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION trigger_fathom_hourly_sync() TO postgres;
GRANT EXECUTE ON FUNCTION cleanup_old_cron_logs() TO postgres;

-- ============================================================================
-- Migration Complete
-- ============================================================================

COMMENT ON FUNCTION trigger_fathom_hourly_sync IS 'Triggers hourly incremental sync for all active Fathom integrations';
COMMENT ON FUNCTION cleanup_old_cron_logs IS 'Removes cron job logs older than 30 days';
COMMENT ON TABLE cron_job_logs IS 'Audit trail for cron job executions';

-- Note: In production, you would modify trigger_fathom_hourly_sync() to actually
-- call the Edge Function using Supabase's HTTP invoke or direct HTTP request
