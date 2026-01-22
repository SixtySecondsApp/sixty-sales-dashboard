-- Migration: Setup Fathom Cron Sync v2 (Robust Polling)
-- Purpose: Configure automated 15-minute sync for all active Fathom integrations
-- Date: 2026-01-22
--
-- This migration sets up a reliable polling mechanism as a fallback for webhooks.
-- Key improvements:
-- 1. Runs every 15 minutes (vs hourly in v1)
-- 2. Uses pg_net for async HTTP calls to edge function
-- 3. Proper error handling and logging
--
-- ⚠️ IMPORTANT: Database settings must be configured for the cron to work!
-- Run these commands in the Supabase SQL Editor after applying this migration:
--
--   ALTER DATABASE postgres SET app.supabase_url = 'https://YOUR_PROJECT_REF.supabase.co';
--   ALTER DATABASE postgres SET app.supabase_service_role_key = 'YOUR_SERVICE_ROLE_KEY';
--
-- You can find these values in Supabase Dashboard > Settings > API

-- ============================================================================
-- 1. Enable required extensions
-- ============================================================================

-- pg_cron for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- pg_net for async HTTP calls (should already exist in Supabase)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================================
-- 2. Create cron_job_logs table if not exists
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cron_job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('triggered', 'success', 'error', 'skipped')),
  message TEXT,
  error_details TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_cron_job_logs_job_name ON public.cron_job_logs(job_name);
CREATE INDEX IF NOT EXISTS idx_cron_job_logs_user_id ON public.cron_job_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_cron_job_logs_created_at ON public.cron_job_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_job_logs_status ON public.cron_job_logs(status);

-- Enable RLS
ALTER TABLE public.cron_job_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own cron logs" ON public.cron_job_logs;
DROP POLICY IF EXISTS "Service role can manage cron logs" ON public.cron_job_logs;
DROP POLICY IF EXISTS "cron_job_logs_service_role" ON public.cron_job_logs;

-- Service role has full access
CREATE POLICY "cron_job_logs_service_role" ON public.cron_job_logs
  FOR ALL
  USING (public.is_service_role());

-- Users can view their own logs
CREATE POLICY "Users can view own cron logs" ON public.cron_job_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- 3. Create function to trigger Fathom sync via HTTP
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_fathom_cron_sync_v2()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_role_key TEXT;
  v_request_id BIGINT;
BEGIN
  -- Get Supabase URL and service role key from database settings
  -- These must be configured in production via:
  --   ALTER DATABASE postgres SET app.supabase_url = 'https://YOUR_PROJECT.supabase.co';
  --   ALTER DATABASE postgres SET app.supabase_service_role_key = 'YOUR_SERVICE_ROLE_KEY';
  v_supabase_url := current_setting('app.supabase_url', true);
  v_service_role_key := current_setting('app.supabase_service_role_key', true);

  -- If still not configured, log warning and exit
  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE WARNING '[fathom-cron-sync-v2] Supabase configuration not set for cron sync';

    INSERT INTO public.cron_job_logs (
      job_name,
      status,
      message,
      created_at
    ) VALUES (
      'fathom_cron_sync_v2',
      'error',
      'Supabase configuration missing (supabase_url or service_role_key not set)',
      NOW()
    );

    RETURN;
  END IF;

  -- Use pg_net to make async HTTP call to the edge function
  BEGIN
    SELECT net.http_post(
      url := v_supabase_url || '/functions/v1/fathom-cron-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000  -- 55 second timeout (cron runs every minute)
    ) INTO v_request_id;

    -- Log the trigger
    INSERT INTO public.cron_job_logs (
      job_name,
      status,
      message,
      metadata,
      created_at
    ) VALUES (
      'fathom_cron_sync_v2',
      'triggered',
      'Cron sync edge function invoked via pg_net',
      jsonb_build_object('request_id', v_request_id),
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
      'fathom_cron_sync_v2',
      'error',
      'Failed to invoke edge function',
      SQLERRM,
      NOW()
    );

    RAISE WARNING '[fathom-cron-sync-v2] Failed to trigger sync: %', SQLERRM;
  END;
END;
$$;

COMMENT ON FUNCTION public.trigger_fathom_cron_sync_v2 IS
  'Triggers the fathom-cron-sync edge function via pg_net for reliable meeting sync fallback';

-- ============================================================================
-- 4. Create cleanup function for old logs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_cron_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete logs older than 30 days
  DELETE FROM public.cron_job_logs
  WHERE created_at < NOW() - INTERVAL '30 days';

  RAISE NOTICE 'Cleaned up cron logs older than 30 days';
END;
$$;

-- ============================================================================
-- 5. Schedule cron jobs
-- ============================================================================

-- Remove existing fathom sync jobs if they exist
DO $$
BEGIN
  -- Try to unschedule old jobs (ignore errors if they don't exist)
  PERFORM cron.unschedule('fathom-hourly-sync');
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore if job doesn't exist
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('fathom-cron-sync-v2');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- Schedule new job: Run every 15 minutes (at minutes 0, 15, 30, 45)
-- This provides 4x faster detection of missed webhooks compared to hourly
SELECT cron.schedule(
  'fathom-cron-sync-v2',
  '*/15 * * * *',  -- Every 15 minutes
  $$SELECT public.trigger_fathom_cron_sync_v2();$$
);

-- Schedule cleanup: Run daily at 3 AM UTC
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-cron-logs');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

SELECT cron.schedule(
  'cleanup-cron-logs',
  '0 3 * * *',  -- Daily at 3 AM UTC
  $$SELECT public.cleanup_old_cron_logs();$$
);

-- ============================================================================
-- 6. Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.trigger_fathom_cron_sync_v2() TO postgres;
GRANT EXECUTE ON FUNCTION public.cleanup_old_cron_logs() TO postgres;

-- ============================================================================
-- 7. Add metadata column to fathom_sync_state if not exists
-- ============================================================================

DO $$
BEGIN
  -- Add last_cron_sync_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'fathom_sync_state'
    AND column_name = 'last_cron_sync_at'
  ) THEN
    ALTER TABLE public.fathom_sync_state
    ADD COLUMN last_cron_sync_at TIMESTAMPTZ;

    COMMENT ON COLUMN public.fathom_sync_state.last_cron_sync_at IS
      'Timestamp of the last cron-triggered sync for this user';
  END IF;
END;
$$;

-- ============================================================================
-- Migration Complete
-- ============================================================================

COMMENT ON FUNCTION public.trigger_fathom_cron_sync_v2 IS
  'Triggers hourly incremental sync for all active Fathom integrations (v2 with improved reliability)';

-- Log that migration completed
DO $$
BEGIN
  INSERT INTO public.cron_job_logs (
    job_name,
    status,
    message,
    created_at
  ) VALUES (
    'migration',
    'success',
    'fathom-cron-sync-v2 migration applied successfully',
    NOW()
  );
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore if table doesn't exist yet in fresh installs
END;
$$;
