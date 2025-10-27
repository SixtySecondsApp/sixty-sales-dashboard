-- Migration: Setup Cron Jobs for Task Notifications
-- Description: Schedule automated notifications for tasks from meetings (upcoming deadlines and overdue tasks)
-- Author: Claude
-- Date: 2025-10-27
-- Dependencies: 20251025201000_task_notification_system.sql, pg_cron extension

-- ============================================================================
-- PHASE 1: Verify pg_cron Extension
-- ============================================================================

-- Ensure pg_cron extension is enabled (should be enabled by Supabase admin)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- PHASE 2: Remove Existing Cron Jobs (if any)
-- ============================================================================

-- Clean up any existing task notification cron jobs
SELECT cron.unschedule('notify-upcoming-task-deadlines') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'notify-upcoming-task-deadlines'
);

SELECT cron.unschedule('notify-overdue-tasks-morning') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'notify-overdue-tasks-morning'
);

SELECT cron.unschedule('notify-overdue-tasks-evening') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'notify-overdue-tasks-evening'
);

-- ============================================================================
-- PHASE 3: Schedule Upcoming Task Deadline Notifications
-- ============================================================================

-- Run every day at 9:00 AM (server timezone)
-- Notifies users of tasks due in the next 24 hours
SELECT cron.schedule(
  'notify-upcoming-task-deadlines',
  '0 9 * * *',  -- Every day at 9:00 AM
  $$SELECT notify_upcoming_task_deadlines()$$
);

COMMENT ON EXTENSION pg_cron IS 'Cron job: notify-upcoming-task-deadlines runs daily at 9:00 AM to send notifications for tasks due in 24 hours';

-- ============================================================================
-- PHASE 4: Schedule Overdue Task Notifications (Morning)
-- ============================================================================

-- Run every day at 9:00 AM (server timezone)
-- Notifies users of overdue tasks in the morning
SELECT cron.schedule(
  'notify-overdue-tasks-morning',
  '0 9 * * *',  -- Every day at 9:00 AM
  $$SELECT notify_overdue_tasks()$$
);

COMMENT ON EXTENSION pg_cron IS 'Cron job: notify-overdue-tasks-morning runs daily at 9:00 AM to send notifications for overdue tasks';

-- ============================================================================
-- PHASE 5: Schedule Overdue Task Notifications (Evening)
-- ============================================================================

-- Run every day at 5:00 PM (server timezone)
-- Notifies users of overdue tasks in the evening as a reminder
SELECT cron.schedule(
  'notify-overdue-tasks-evening',
  '0 17 * * *',  -- Every day at 5:00 PM
  $$SELECT notify_overdue_tasks()$$
);

COMMENT ON EXTENSION pg_cron IS 'Cron job: notify-overdue-tasks-evening runs daily at 5:00 PM to send follow-up notifications for overdue tasks';

-- ============================================================================
-- PHASE 6: Verify Cron Job Installation
-- ============================================================================

-- Query to view all task notification cron jobs
-- Run this to verify the jobs were scheduled correctly:
-- SELECT * FROM cron.job WHERE jobname LIKE '%task%';

-- ============================================================================
-- PHASE 7: Add Helper Function to List Task Notification Jobs
-- ============================================================================

CREATE OR REPLACE FUNCTION get_task_notification_cron_jobs()
RETURNS TABLE (
  jobid BIGINT,
  schedule TEXT,
  command TEXT,
  nodename TEXT,
  nodeport INTEGER,
  database TEXT,
  username TEXT,
  active BOOLEAN,
  jobname TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.jobid,
    j.schedule,
    j.command,
    j.nodename,
    j.nodeport,
    j.database,
    j.username,
    j.active,
    j.jobname
  FROM cron.job j
  WHERE j.jobname IN (
    'notify-upcoming-task-deadlines',
    'notify-overdue-tasks-morning',
    'notify-overdue-tasks-evening'
  )
  ORDER BY j.jobname;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_task_notification_cron_jobs IS 'Returns list of all task notification cron jobs for monitoring';

-- Grant execution to service role only (admin function)
GRANT EXECUTE ON FUNCTION get_task_notification_cron_jobs TO service_role;

-- ============================================================================
-- PHASE 8: Add Helper Function to Manually Trigger Cron Jobs
-- ============================================================================

-- Useful for testing - manually run all task notifications
CREATE OR REPLACE FUNCTION run_task_notifications_now()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Execute the trigger function that runs all notifications
  SELECT trigger_all_task_notifications() INTO result;

  RETURN json_build_object(
    'success', true,
    'message', 'Task notifications executed manually',
    'results', result,
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION run_task_notifications_now IS 'Manually trigger all task notification checks (for testing or immediate execution)';

-- Grant execution to authenticated users and service role
GRANT EXECUTE ON FUNCTION run_task_notifications_now TO authenticated, service_role;

-- ============================================================================
-- NOTES AND DOCUMENTATION
-- ============================================================================

/*
CRON JOB SCHEDULE SUMMARY:
==========================

1. notify-upcoming-task-deadlines
   - Schedule: Daily at 9:00 AM
   - Purpose: Notify users of tasks due in the next 24 hours
   - Function: notify_upcoming_task_deadlines()

2. notify-overdue-tasks-morning
   - Schedule: Daily at 9:00 AM
   - Purpose: Morning reminder for overdue tasks
   - Function: notify_overdue_tasks()

3. notify-overdue-tasks-evening
   - Schedule: Daily at 5:00 PM
   - Purpose: Evening follow-up for overdue tasks
   - Function: notify_overdue_tasks()

MANUAL TESTING:
==============
To manually trigger all task notifications:
  SELECT run_task_notifications_now();

To view scheduled cron jobs:
  SELECT * FROM get_task_notification_cron_jobs();

To view all cron jobs:
  SELECT * FROM cron.job;

To view cron job execution history:
  SELECT * FROM cron.job_run_details
  WHERE jobid IN (
    SELECT jobid FROM cron.job
    WHERE jobname LIKE '%task%'
  )
  ORDER BY start_time DESC
  LIMIT 20;

TIMEZONE CONSIDERATIONS:
=======================
- Cron jobs run in the server's timezone
- Adjust the schedule times based on your deployment timezone
- Times are in 24-hour format (0-23)
- Default times: 9:00 AM (09:00) and 5:00 PM (17:00)

CUSTOMIZATION:
=============
To change notification times, update the cron schedule:
  '0 9 * * *'    => 9:00 AM daily
  '0 17 * * *'   => 5:00 PM daily
  '0 (star)/6 * * *'  => Every 6 hours (replace (star) with *)
  '0 9 * * 1-5'  => 9 AM on weekdays only

For more cron schedule syntax:
  https://crontab.guru/
*/
