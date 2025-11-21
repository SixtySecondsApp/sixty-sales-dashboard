-- Migration: Setup Transcript Retry Cron Job
-- Purpose: Configure automated retry processor to run every 5 minutes
-- Date: 2025-01-25

-- ============================================================================
-- 1. Create function to trigger transcript retry Edge Function
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_transcript_retry_processor()
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
    RAISE WARNING 'Supabase configuration not set for transcript retry cron';
    RETURN;
  END IF;

  -- Call the Edge Function using pg_net (Supabase's async HTTP)
  BEGIN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/fathom-transcript-retry',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := '{}'::jsonb
    );

    RAISE NOTICE 'Transcript retry processor Edge Function invoked';

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to invoke transcript retry Edge Function: %', SQLERRM;
  END;
END;
$$;

-- ============================================================================
-- 2. Schedule cron job to run every 5 minutes
-- ============================================================================

-- Remove existing job if it exists
SELECT cron.unschedule('fathom-transcript-retry') 
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'fathom-transcript-retry'
);

-- Schedule new job (runs every 5 minutes)
SELECT cron.schedule(
  'fathom-transcript-retry',
  '*/5 * * * *', -- Every 5 minutes
  $$SELECT trigger_transcript_retry_processor();$$
);

-- ============================================================================
-- 3. Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION trigger_transcript_retry_processor() TO postgres;

-- ============================================================================
-- 4. Comments
-- ============================================================================

COMMENT ON FUNCTION trigger_transcript_retry_processor IS 'Triggers transcript retry processor Edge Function every 5 minutes';

-- ============================================================================
-- Migration Complete
-- ============================================================================

