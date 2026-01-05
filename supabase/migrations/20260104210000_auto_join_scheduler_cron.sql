-- Migration: Set up cron job for auto-join scheduler
-- Purpose: Automatically deploy bots to upcoming meetings every 15 minutes
-- Date: 2026-01-04
--
-- This migration sets up a pg_cron job that calls the auto-join-scheduler
-- edge function to check for upcoming meetings that need recording.
--
-- SETUP REQUIRED:
-- Before this works, you must add the service role key to Supabase vault:
--   1. Go to Supabase Dashboard > Settings > Vault
--   2. Create a new secret with name: 'service_role_key'
--   3. Set the value to your project's service role key
--
-- Alternative: Use Supabase Dashboard > Edge Functions > auto-join-scheduler > Schedule
--              to set up scheduling through the UI instead.

-- =============================================================================
-- 1. Enable required extensions
-- =============================================================================

-- pg_net allows making HTTP requests from PostgreSQL
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- =============================================================================
-- 2. Create helper function to call the auto-join scheduler
-- =============================================================================

CREATE OR REPLACE FUNCTION call_auto_join_scheduler()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
  request_id bigint;
BEGIN
  -- Get the Supabase URL from project settings
  -- This uses the project reference from the current database name
  -- Format: postgres_<project_ref>
  supabase_url := 'https://' ||
    regexp_replace(current_database(), '^postgres_', '') ||
    '.supabase.co';

  -- Try to get service role key from vault (recommended secure approach)
  BEGIN
    SELECT decrypted_secret INTO service_role_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    -- Vault might not be set up yet
    service_role_key := NULL;
  END;

  -- If no service role key, log warning and return
  IF service_role_key IS NULL THEN
    RAISE WARNING 'Auto-join scheduler: service_role_key not found in vault. Please add it via Supabase Dashboard > Settings > Vault';
    RETURN;
  END IF;

  -- Make HTTP request to edge function
  SELECT extensions.http_post(
    url := supabase_url || '/functions/v1/auto-join-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := '{}'::jsonb
  ) INTO request_id;

  RAISE LOG 'Auto-join scheduler called successfully, request_id: %', request_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Auto-join scheduler failed: %', SQLERRM;
END;
$$;

-- =============================================================================
-- 3. Schedule the cron job to run every 15 minutes
-- =============================================================================

-- Remove existing jobs if they exist (idempotent migration)
DO $$
BEGIN
  PERFORM cron.unschedule('auto-join-scheduler-hourly');
EXCEPTION WHEN OTHERS THEN
  -- Job doesn't exist, ignore
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('auto-join-scheduler-frequent');
EXCEPTION WHEN OTHERS THEN
  -- Job doesn't exist, ignore
END;
$$;

-- Schedule to run every 15 minutes for responsive auto-join
-- Cron expression: '*/15 * * * *' = at minute 0, 15, 30, 45 of every hour
SELECT cron.schedule(
  'auto-join-scheduler',
  '*/15 * * * *',
  $$SELECT call_auto_join_scheduler()$$
);

-- =============================================================================
-- 4. Grant necessary permissions
-- =============================================================================

GRANT EXECUTE ON FUNCTION call_auto_join_scheduler() TO postgres;
GRANT USAGE ON SCHEMA vault TO postgres;

-- =============================================================================
-- 5. Documentation
-- =============================================================================

COMMENT ON FUNCTION call_auto_join_scheduler() IS
'Calls the auto-join-scheduler edge function to deploy bots to upcoming meetings.
Scheduled to run every 15 minutes via pg_cron.

SETUP REQUIRED:
Add service_role_key to vault: Dashboard > Settings > Vault > New Secret
  Name: service_role_key
  Value: <your project service role key>

See: supabase/functions/auto-join-scheduler/index.ts';
