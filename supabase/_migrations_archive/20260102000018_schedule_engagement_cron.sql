-- Schedule compute-engagement Edge Function as daily cron job
-- Runs at 2:00 AM UTC daily to compute engagement scores and user segments

-- ============================================================================
-- COMPUTE ENGAGEMENT CRON JOB (Daily at 2 AM UTC)
-- Computes user engagement scores, segments, and optimal notification timing
-- ============================================================================

SELECT cron.schedule(
  'compute-engagement-daily',
  '0 2 * * *',  -- 2:00 AM UTC daily
  $$
  SELECT net.http_post(
    url := 'https://ygdpgliavpxeugaajgrb.supabase.co/functions/v1/compute-engagement',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================================
-- Add to cron job settings for monitoring
-- ============================================================================
INSERT INTO cron_job_settings (job_name, display_name, description, category, is_monitored, alert_on_failure)
VALUES (
  'compute-engagement-daily',
  'Compute User Engagement',
  'Daily computation of user engagement scores, segments, and notification preferences for the Smart Engagement Algorithm',
  'engagement',
  true,
  true
)
ON CONFLICT (job_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_monitored = EXCLUDED.is_monitored,
  alert_on_failure = EXCLUDED.alert_on_failure;

-- ============================================================================
-- NOTES:
-- - Runs daily at 2 AM UTC (off-peak hours)
-- - Processes all users with engagement metrics records
-- - Computes: app_engagement_score, slack_engagement_score, notification_engagement_score
-- - Updates user segments: power_user, regular, casual, at_risk, dormant, churned
-- - Calculates optimal notification timing based on activity patterns
-- - Monitor via: SELECT * FROM cron.job_run_details WHERE jobname = 'compute-engagement-daily';
-- ============================================================================
