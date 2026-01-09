-- Cron Job Monitoring and Notification System
-- Adds tables for monitoring cron jobs and sending failure notifications

-- ============================================================================
-- 1. CRON NOTIFICATION SUBSCRIBERS
-- Email addresses that receive alerts when cron jobs fail
-- ============================================================================
CREATE TABLE IF NOT EXISTS cron_notification_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notify_on_failure BOOLEAN NOT NULL DEFAULT true,
  notify_on_success BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  CONSTRAINT cron_notification_subscribers_email_unique UNIQUE (email)
);

-- Enable RLS
ALTER TABLE cron_notification_subscribers ENABLE ROW LEVEL SECURITY;

-- Only admins can manage subscribers
CREATE POLICY "Admins can manage cron notification subscribers"
  ON cron_notification_subscribers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ============================================================================
-- 2. CRON JOB NOTIFICATIONS LOG
-- Log of all notifications sent for cron job events
-- ============================================================================
CREATE TABLE IF NOT EXISTS cron_notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  job_id BIGINT,
  run_id BIGINT,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('failure', 'success', 'warning')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  recipients TEXT[] NOT NULL,
  subject TEXT,
  message TEXT,
  error_details TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying recent notifications
CREATE INDEX idx_cron_notifications_log_created_at ON cron_notifications_log(created_at DESC);
CREATE INDEX idx_cron_notifications_log_job_name ON cron_notifications_log(job_name);

-- Enable RLS
ALTER TABLE cron_notifications_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view notification logs
CREATE POLICY "Admins can view cron notification logs"
  ON cron_notifications_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ============================================================================
-- 3. CRON JOB SETTINGS
-- Per-job configuration for monitoring and alerts
-- ============================================================================
CREATE TABLE IF NOT EXISTS cron_job_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL UNIQUE,
  display_name TEXT,
  description TEXT,
  category TEXT DEFAULT 'general',
  is_monitored BOOLEAN NOT NULL DEFAULT true,
  alert_on_failure BOOLEAN NOT NULL DEFAULT true,
  alert_after_consecutive_failures INTEGER DEFAULT 1,
  max_runtime_seconds INTEGER DEFAULT 300,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE cron_job_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage job settings
CREATE POLICY "Admins can manage cron job settings"
  ON cron_job_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Insert default settings for our cron jobs
INSERT INTO cron_job_settings (job_name, display_name, description, category) VALUES
  ('sync-savvycal-events-backup', 'SavvyCal Sync', 'Syncs SavvyCal booking events every 15 minutes', 'integrations'),
  ('fathom-hourly-sync', 'Fathom Sync', 'Syncs Fathom meeting recordings hourly for all users', 'integrations')
ON CONFLICT (job_name) DO NOTHING;

-- ============================================================================
-- 4. VIEW FOR CRON JOB STATUS
-- Combines cron.job with run details and settings
-- ============================================================================
CREATE OR REPLACE VIEW cron_jobs_status AS
SELECT
  j.jobid,
  j.jobname,
  j.schedule,
  j.active,
  j.nodename,
  s.display_name,
  s.description,
  s.category,
  s.is_monitored,
  s.alert_on_failure,
  (
    SELECT jsonb_build_object(
      'runid', rd.runid,
      'status', rd.status,
      'start_time', rd.start_time,
      'end_time', rd.end_time,
      'return_message', rd.return_message
    )
    FROM cron.job_run_details rd
    WHERE rd.jobid = j.jobid
    ORDER BY rd.start_time DESC
    LIMIT 1
  ) as last_run,
  (
    SELECT COUNT(*)::int
    FROM cron.job_run_details rd
    WHERE rd.jobid = j.jobid
      AND rd.status = 'failed'
      AND rd.start_time > now() - interval '24 hours'
  ) as failures_last_24h,
  (
    SELECT COUNT(*)::int
    FROM cron.job_run_details rd
    WHERE rd.jobid = j.jobid
      AND rd.start_time > now() - interval '24 hours'
  ) as runs_last_24h
FROM cron.job j
LEFT JOIN cron_job_settings s ON s.job_name = j.jobname;

-- Grant access to the view
GRANT SELECT ON cron_jobs_status TO authenticated;

-- ============================================================================
-- 5. FUNCTION TO CHECK AND NOTIFY ON CRON FAILURES
-- Called after each cron run to check for failures and send notifications
-- ============================================================================
CREATE OR REPLACE FUNCTION check_cron_failures_and_notify()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_failed_jobs RECORD;
  v_subscribers TEXT[];
  v_subject TEXT;
  v_message TEXT;
BEGIN
  -- Get active subscribers
  SELECT array_agg(email) INTO v_subscribers
  FROM cron_notification_subscribers
  WHERE is_active = true AND notify_on_failure = true;

  IF v_subscribers IS NULL OR array_length(v_subscribers, 1) = 0 THEN
    RETURN; -- No subscribers
  END IF;

  -- Check for recent failures (last 5 minutes)
  FOR v_failed_jobs IN
    SELECT
      j.jobname,
      j.jobid,
      rd.runid,
      rd.status,
      rd.return_message,
      rd.start_time,
      s.display_name,
      s.alert_on_failure
    FROM cron.job_run_details rd
    JOIN cron.job j ON j.jobid = rd.jobid
    LEFT JOIN cron_job_settings s ON s.job_name = j.jobname
    WHERE rd.status = 'failed'
      AND rd.start_time > now() - interval '5 minutes'
      AND (s.alert_on_failure IS NULL OR s.alert_on_failure = true)
      AND NOT EXISTS (
        -- Don't notify if we already notified for this run
        SELECT 1 FROM cron_notifications_log nl
        WHERE nl.run_id = rd.runid AND nl.job_name = j.jobname
      )
  LOOP
    v_subject := format('⚠️ Cron Job Failed: %s', COALESCE(v_failed_jobs.display_name, v_failed_jobs.jobname));
    v_message := format(
      'Cron job "%s" failed at %s\n\nError: %s',
      COALESCE(v_failed_jobs.display_name, v_failed_jobs.jobname),
      v_failed_jobs.start_time,
      COALESCE(v_failed_jobs.return_message, 'No error message')
    );

    -- Log the notification (actual email sending done via Edge Function)
    INSERT INTO cron_notifications_log (
      job_name, job_id, run_id, notification_type, status, recipients, subject, message
    ) VALUES (
      v_failed_jobs.jobname,
      v_failed_jobs.jobid,
      v_failed_jobs.runid,
      'failure',
      'pending',
      v_subscribers,
      v_subject,
      v_message
    );
  END LOOP;
END;
$$;

-- ============================================================================
-- 6. CRON JOB TO CHECK FOR FAILURES (every 5 minutes)
-- ============================================================================
SELECT cron.schedule(
  'check-cron-failures',
  '*/5 * * * *',
  $$SELECT check_cron_failures_and_notify();$$
);

-- ============================================================================
-- 7. HELPER FUNCTION TO GET CRON JOB RUN HISTORY
-- ============================================================================
CREATE OR REPLACE FUNCTION get_cron_job_history(
  p_job_name TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  runid BIGINT,
  jobid BIGINT,
  jobname TEXT,
  status TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  return_message TEXT,
  duration_seconds NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    rd.runid,
    rd.jobid,
    j.jobname,
    rd.status,
    rd.start_time,
    rd.end_time,
    rd.return_message,
    EXTRACT(EPOCH FROM (rd.end_time - rd.start_time))::numeric as duration_seconds
  FROM cron.job_run_details rd
  JOIN cron.job j ON j.jobid = rd.jobid
  WHERE (p_job_name IS NULL OR j.jobname = p_job_name)
  ORDER BY rd.start_time DESC
  LIMIT p_limit;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_cron_job_history TO authenticated;
