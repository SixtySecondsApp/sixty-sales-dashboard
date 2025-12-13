-- Fix Fathom Cron Job Configuration
-- This migration creates a configuration table for cron jobs and updates the trigger function
-- to use this table instead of database settings (which require superuser to configure)

-- ============================================================================
-- 1. Create configuration table for cron jobs
-- ============================================================================
CREATE TABLE IF NOT EXISTS cron_job_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  is_secret BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS but allow service role to bypass
ALTER TABLE cron_job_config ENABLE ROW LEVEL SECURITY;

-- Only service role can access config (no user access)
CREATE POLICY "Service role can manage cron config"
  ON cron_job_config
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Insert the Supabase configuration
-- Note: These are the same values that are already public via the client
INSERT INTO cron_job_config (key, value, description, is_secret) VALUES
  ('supabase_url', 'https://ygdpgliavpxeugaajgrb.supabase.co', 'Supabase project URL', false)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- The service role key needs to be inserted separately for security
-- This will be done via the Edge Function or manually

-- ============================================================================
-- 2. Create function to get config value
-- ============================================================================
CREATE OR REPLACE FUNCTION get_cron_config(config_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  config_value TEXT;
BEGIN
  SELECT value INTO config_value
  FROM cron_job_config
  WHERE key = config_key;

  RETURN config_value;
END;
$$;

-- ============================================================================
-- 3. Update the Fathom sync trigger function to use config table
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_fathom_hourly_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Get configuration from table
  supabase_url := get_cron_config('supabase_url');
  service_role_key := get_cron_config('supabase_service_role_key');

  -- If not configured, log warning and exit
  IF supabase_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING 'Supabase configuration not set in cron_job_config table';

    INSERT INTO public.cron_job_logs (
      job_name,
      status,
      message,
      created_at
    ) VALUES (
      'fathom_hourly_sync',
      'error',
      'Supabase configuration missing from cron_job_config table',
      NOW()
    );

    RETURN;
  END IF;

  BEGIN
    -- Use pg_net.http_post to call the Edge Function asynchronously
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
      'Cron sync Edge Function invoked successfully',
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
-- 4. Create the fathom_transcript_retry_jobs table (was missing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fathom_transcript_retry_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  recording_id TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for retry processing
CREATE INDEX IF NOT EXISTS idx_fathom_transcript_retry_next ON fathom_transcript_retry_jobs(next_retry_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_fathom_transcript_retry_meeting ON fathom_transcript_retry_jobs(meeting_id);

-- Enable RLS
ALTER TABLE fathom_transcript_retry_jobs ENABLE ROW LEVEL SECURITY;

-- Service role can manage retry jobs
CREATE POLICY "Service role can manage transcript retry jobs"
  ON fathom_transcript_retry_jobs
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- 5. Grant permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_cron_config(TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION trigger_fathom_hourly_sync() TO postgres;

-- ============================================================================
-- Migration Complete - Next Steps:
-- ============================================================================
-- You need to insert the service role key into the config table.
-- Run this in the Supabase SQL Editor:
--
-- INSERT INTO cron_job_config (key, value, description, is_secret) VALUES
--   ('supabase_service_role_key', 'YOUR_SERVICE_ROLE_KEY_HERE', 'Service role key for Edge Function calls', true)
-- ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
--
-- ============================================================================

COMMENT ON TABLE cron_job_config IS 'Configuration values for cron jobs, stored securely without requiring database superuser access';
COMMENT ON TABLE fathom_transcript_retry_jobs IS 'Queue for retrying failed Fathom transcript fetches';
