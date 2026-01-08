-- ============================================================================
-- BILLING RECONCILIATION CRON JOB
-- Daily reconciliation to sync Stripe subscription state with database
-- Runs at 3:00 AM UTC daily (off-peak hours)
-- ============================================================================

-- Create function to call the reconciliation edge function
CREATE OR REPLACE FUNCTION reconcile_billing_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Get Supabase configuration from environment/system config
  -- Try system_config first, then fallback to app settings
  BEGIN
    SELECT value INTO supabase_url FROM system_config WHERE key = 'supabase_url' LIMIT 1;
    SELECT value INTO service_role_key FROM system_config WHERE key = 'service_role_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback to app settings if system_config doesn't exist
    supabase_url := current_setting('app.supabase_url', true);
    service_role_key := current_setting('app.supabase_service_role_key', true);
  END;

  -- If not configured, log warning and exit
  IF supabase_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING 'Supabase configuration not set for billing reconciliation';
    RETURN;
  END IF;

  -- Call the reconciliation edge function using pg_net
  BEGIN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/reconcile-billing',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := '{}'::jsonb
    );

    RAISE NOTICE 'Billing reconciliation triggered';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to invoke billing reconciliation Edge Function: %', SQLERRM;
  END;
END;
$$;

-- Schedule cron job to run daily at 3 AM UTC
SELECT cron.schedule(
  'reconcile-billing-daily',
  '0 3 * * *', -- 3:00 AM UTC daily
  $$
  SELECT reconcile_billing_subscriptions();
  $$
);

-- Grant permissions
GRANT EXECUTE ON FUNCTION reconcile_billing_subscriptions() TO postgres;

-- Add metadata for cron-admin UI (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cron_job_settings') THEN
    INSERT INTO cron_job_settings (job_name, display_name, description, category, is_monitored, alert_on_failure)
    VALUES (
      'reconcile-billing-daily',
      'Billing Reconciliation',
      'Daily reconciliation of Stripe subscription state with database. Checks for status mismatches and missing subscriptions.',
      'billing',
      true,
      true
    )
    ON CONFLICT (job_name) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      description = EXCLUDED.description,
      category = EXCLUDED.category,
      is_monitored = EXCLUDED.is_monitored,
      alert_on_failure = EXCLUDED.alert_on_failure;
  END IF;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION reconcile_billing_subscriptions IS
  'Triggers daily reconciliation of Stripe subscriptions with database state';
