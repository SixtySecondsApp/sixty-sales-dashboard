-- ============================================================================
-- Emergency Cleanup: Delete Notification Flood
-- ============================================================================
-- Purpose: Remove 11,990 "Task Overdue" error notifications affecting all users
-- Date: 2025-12-03
-- Bug: notify_overdue_tasks() creating spurious notifications despite 0 tasks
-- ============================================================================

-- Step 1: Delete all "Task Overdue" notifications
DELETE FROM notifications
WHERE title = 'Task Overdue'
  AND type = 'error';

-- Step 2: Delete any other suspicious error notifications from today
DELETE FROM notifications
WHERE type = 'error'
  AND message LIKE '%overdue%'
  AND created_at > CURRENT_DATE;

-- Step 3: Verification with detailed reporting
DO $$
DECLARE
  error_count INTEGER;
  overdue_count INTEGER;
  total_count INTEGER;
BEGIN
  -- Check remaining error notifications
  SELECT COUNT(*) INTO error_count
  FROM notifications
  WHERE type = 'error';

  -- Check remaining overdue notifications
  SELECT COUNT(*) INTO overdue_count
  FROM notifications
  WHERE title = 'Task Overdue';

  -- Check total notifications
  SELECT COUNT(*) INTO total_count
  FROM notifications;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Cleanup Verification Results:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Remaining error notifications: %', error_count;
  RAISE NOTICE 'Remaining overdue notifications: %', overdue_count;
  RAISE NOTICE 'Total notifications remaining: %', total_count;
  RAISE NOTICE '========================================';

  IF overdue_count > 0 THEN
    RAISE WARNING '❌ Cleanup incomplete! % overdue notifications remain', overdue_count;
  ELSE
    RAISE NOTICE '✅ Cleanup successful! All overdue notifications removed.';
  END IF;

  IF error_count > 0 THEN
    RAISE NOTICE '⚠️  Warning: % error notifications still exist (may be legitimate)', error_count;
  END IF;
END $$;

-- Step 4: Show notification count per user (for verification)
SELECT
  'Notifications per user after cleanup' as report,
  user_id,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE read = false) as unread,
  COUNT(*) FILTER (WHERE type = 'error') as errors
FROM notifications
GROUP BY user_id
ORDER BY total DESC
LIMIT 20;
