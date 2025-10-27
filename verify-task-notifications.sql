-- ============================================================================
-- Task Notification System Verification Script
-- ============================================================================
-- Purpose: Verify that task notification cron jobs are properly configured
-- Usage: Run this script in Supabase SQL Editor after applying migrations
-- ============================================================================

-- Step 1: Check if pg_cron extension is enabled
SELECT
  'pg_cron Extension' as check_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    ) THEN '✓ Enabled'
    ELSE '✗ NOT ENABLED - Run: CREATE EXTENSION pg_cron;'
  END as status;

-- Step 2: List all task notification cron jobs
SELECT
  'Scheduled Cron Jobs' as check_name,
  COUNT(*) as job_count
FROM cron.job
WHERE jobname IN (
  'notify-upcoming-task-deadlines',
  'notify-overdue-tasks-morning',
  'notify-overdue-tasks-evening'
);

-- Step 3: View detailed cron job configuration
SELECT
  jobname,
  schedule,
  active,
  command,
  database
FROM cron.job
WHERE jobname IN (
  'notify-upcoming-task-deadlines',
  'notify-overdue-tasks-morning',
  'notify-overdue-tasks-evening'
)
ORDER BY jobname;

-- Step 4: Check recent cron job execution history
SELECT
  j.jobname,
  jrd.start_time,
  jrd.end_time,
  jrd.status,
  jrd.return_message,
  EXTRACT(EPOCH FROM (jrd.end_time - jrd.start_time)) as duration_seconds
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname IN (
  'notify-upcoming-task-deadlines',
  'notify-overdue-tasks-morning',
  'notify-overdue-tasks-evening'
)
ORDER BY jrd.start_time DESC
LIMIT 10;

-- Step 5: Check if notification functions exist
SELECT
  'Notification Functions' as check_name,
  string_agg(proname, ', ') as functions
FROM pg_proc
WHERE proname IN (
  'notify_upcoming_task_deadlines',
  'notify_overdue_tasks',
  'notify_task_from_meeting',
  'notify_task_reassignment',
  'trigger_all_task_notifications',
  'create_task_notification'
);

-- Step 6: Count tasks that will trigger upcoming deadline notifications (due in 24h)
SELECT
  'Tasks Due in 24h' as notification_type,
  COUNT(*) as task_count,
  array_agg(DISTINCT assigned_to) as affected_users
FROM tasks
WHERE
  completed = FALSE
  AND status NOT IN ('completed', 'cancelled')
  AND due_date IS NOT NULL
  AND due_date BETWEEN NOW() + INTERVAL '23 hours' AND NOW() + INTERVAL '25 hours';

-- Step 7: Count overdue tasks that will trigger notifications
SELECT
  'Overdue Tasks' as notification_type,
  COUNT(*) as task_count,
  array_agg(DISTINCT assigned_to) as affected_users
FROM tasks
WHERE
  completed = FALSE
  AND status NOT IN ('completed', 'cancelled')
  AND due_date IS NOT NULL
  AND due_date < NOW();

-- Step 8: Test manual notification trigger (OPTIONAL - uncomment to run)
-- This will send actual notifications to users!
-- SELECT run_task_notifications_now();

-- Step 9: Check notification triggers on tasks table
SELECT
  'Task Table Triggers' as check_name,
  string_agg(trigger_name, ', ') as triggers
FROM information_schema.triggers
WHERE event_object_table = 'tasks'
  AND trigger_name IN (
    'trigger_notify_task_from_meeting',
    'trigger_notify_task_reassignment'
  );

-- Step 10: View helper functions
SELECT
  'Helper Functions' as check_name,
  string_agg(proname, ', ') as functions
FROM pg_proc
WHERE proname IN (
  'get_task_notification_cron_jobs',
  'run_task_notifications_now'
);

-- ============================================================================
-- MANUAL TESTING COMMANDS
-- ============================================================================

/*
To manually trigger all notifications NOW (for testing):
  SELECT run_task_notifications_now();

To view all task notification cron jobs:
  SELECT * FROM get_task_notification_cron_jobs();

To temporarily disable a cron job:
  SELECT cron.unschedule('notify-upcoming-task-deadlines');

To re-enable a cron job:
  SELECT cron.schedule(
    'notify-upcoming-task-deadlines',
    '0 9 * * *',
    $$SELECT notify_upcoming_task_deadlines()$$
  );

To view cron job execution logs:
  SELECT * FROM cron.job_run_details
  WHERE jobid IN (
    SELECT jobid FROM cron.job WHERE jobname LIKE '%task%'
  )
  ORDER BY start_time DESC
  LIMIT 20;
*/

-- ============================================================================
-- EXPECTED RESULTS
-- ============================================================================

/*
EXPECTED OUTPUTS:
================

1. pg_cron Extension: ✓ Enabled
2. Scheduled Cron Jobs: 3 jobs
3. Detailed Jobs: Shows 3 active jobs with schedules
4. Recent Execution: Shows execution history (may be empty if never run)
5. Functions: Shows all 6 notification functions
6. Tasks Due in 24h: Shows count and affected users
7. Overdue Tasks: Shows count and affected users
8. Task Triggers: Shows 2 triggers
9. Helper Functions: Shows 2 helper functions

TROUBLESHOOTING:
===============

If pg_cron is not enabled:
  - Contact Supabase support or run: CREATE EXTENSION pg_cron;

If cron jobs are missing:
  - Run the migration: 20251027000000_setup_task_notification_cron_jobs.sql

If notifications are not being sent:
  - Check cron.job_run_details for errors
  - Verify functions exist and have proper permissions
  - Test manually: SELECT run_task_notifications_now();

TIMEZONE NOTES:
==============
- Cron jobs run in server timezone (usually UTC)
- Adjust schedule times if needed for your timezone
- Current schedules: 9 AM and 5 PM server time
*/
