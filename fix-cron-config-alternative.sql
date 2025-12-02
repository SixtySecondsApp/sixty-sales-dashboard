-- Alternative Fix for Cron Configuration
-- Since we can't set database parameters in managed Supabase,
-- we'll modify the cron function to use a configuration table instead

-- Step 1: Create configuration table
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write (Edge Functions)
CREATE POLICY "Service role full access" ON system_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Step 2: Insert your configuration values
-- REPLACE THESE WITH YOUR ACTUAL VALUES!
INSERT INTO system_config (key, value, description)
VALUES
  (
    'supabase_url',
    'https://your-project.supabase.co',  -- REPLACE THIS
    'Supabase project URL for Edge Function calls'
  ),
  (
    'supabase_service_role_key',
    'your-service-role-key-here',  -- REPLACE THIS
    'Service role key for Edge Function authentication'
  )
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = NOW();

-- Step 3: Update the trigger function to read from table
CREATE OR REPLACE FUNCTION trigger_fathom_hourly_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  integration_record RECORD;
  total_synced INTEGER := 0;
  total_failed INTEGER := 0;
  supabase_url TEXT;
  service_role_key TEXT;
  http_status INTEGER;
  http_response TEXT;
  job_id UUID := gen_random_uuid();
  request_body TEXT;
  error_details TEXT := NULL;
BEGIN
  -- Get configuration from table instead of database parameters
  SELECT value INTO supabase_url
  FROM system_config
  WHERE key = 'supabase_url';

  SELECT value INTO service_role_key
  FROM system_config
  WHERE key = 'supabase_service_role_key';

  -- Validate configuration
  IF supabase_url IS NULL OR service_role_key IS NULL THEN
    INSERT INTO cron_job_logs (
      job_name,
      status,
      message,
      error_details,
      job_id
    ) VALUES (
      'fathom-hourly-sync',
      'error',
      'Configuration missing',
      'supabase_url or service_role_key not found in system_config table. Run fix-cron-config-alternative.sql to set values.',
      job_id
    );
    RETURN;
  END IF;

  -- Log job start
  INSERT INTO cron_job_logs (
    job_name,
    status,
    message,
    job_id
  ) VALUES (
    'fathom-hourly-sync',
    'started',
    'Starting incremental sync for all active Fathom integrations',
    job_id
  );

  -- Loop through all active integrations
  FOR integration_record IN
    SELECT
      user_id,
      fathom_user_email,
      is_active
    FROM fathom_integrations
    WHERE is_active = true
  LOOP
    BEGIN
      -- Build request body
      request_body := json_build_object(
        'sync_type', 'incremental',
        'user_id', integration_record.user_id
      )::TEXT;

      -- Call fathom-sync Edge Function
      SELECT status, content INTO http_status, http_response
      FROM http((
        'POST',
        supabase_url || '/functions/v1/fathom-sync',
        ARRAY[
          http_header('Authorization', 'Bearer ' || service_role_key),
          http_header('Content-Type', 'application/json')
        ],
        'application/json',
        request_body
      ));

      -- Check response
      IF http_status = 200 THEN
        total_synced := total_synced + 1;
      ELSE
        total_failed := total_failed + 1;
        error_details := COALESCE(error_details, '') ||
          format('User %s failed: HTTP %s - %s; ',
            integration_record.fathom_user_email,
            http_status,
            http_response
          );
      END IF;

    EXCEPTION WHEN OTHERS THEN
      total_failed := total_failed + 1;
      error_details := COALESCE(error_details, '') ||
        format('User %s error: %s; ',
          integration_record.fathom_user_email,
          SQLERRM
        );
    END;
  END LOOP;

  -- Log completion
  INSERT INTO cron_job_logs (
    job_name,
    status,
    message,
    error_details,
    job_id
  ) VALUES (
    'fathom-hourly-sync',
    CASE WHEN total_failed = 0 THEN 'success' ELSE 'partial_success' END,
    format('Synced %s users, %s failed', total_synced, total_failed),
    CASE WHEN error_details IS NOT NULL THEN error_details ELSE NULL END,
    job_id
  );

EXCEPTION WHEN OTHERS THEN
  -- Log fatal error
  INSERT INTO cron_job_logs (
    job_name,
    status,
    message,
    error_details,
    job_id
  ) VALUES (
    'fathom-hourly-sync',
    'error',
    'Fatal error in cron job',
    format('Error: %s, Detail: %s', SQLERRM, SQLSTATE),
    job_id
  );
END;
$$;

-- Step 4: Verify the fix
SELECT
  key,
  value,
  description
FROM system_config
WHERE key IN ('supabase_url', 'supabase_service_role_key');

-- Step 5: Test the function manually (optional)
SELECT trigger_fathom_hourly_sync();

-- Step 6: Check the logs
SELECT
  job_name,
  status,
  message,
  error_details,
  created_at
FROM cron_job_logs
ORDER BY created_at DESC
LIMIT 5;

-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard > Settings > API
-- 2. Copy your Project URL (e.g., https://abcdefg.supabase.co)
-- 3. Copy your service_role key (it's marked as secret)
-- 4. Replace the placeholder values in Step 2 above
-- 5. Run this entire SQL file in the SQL Editor
-- 6. The cron job will now work on its next hourly run
