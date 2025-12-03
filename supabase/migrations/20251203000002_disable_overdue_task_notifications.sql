-- ============================================================================
-- Disable Problematic Notification Function
-- ============================================================================
-- Purpose: Replace notify_overdue_tasks() with safe no-op to prevent regeneration
-- Date: 2025-12-03
-- Bug: Function creates 11,990 error notifications despite 0 tasks existing
-- Status: TEMPORARILY DISABLED - Re-enable after fixing underlying bug
-- ============================================================================

-- Replace notify_overdue_tasks with a safe no-op version
-- This prevents the notification flood from regenerating while preserving function signature
CREATE OR REPLACE FUNCTION notify_overdue_tasks()
RETURNS JSON AS $$
BEGIN
  -- DISABLED: This function was creating spurious notifications
  -- Bug: Creates 11,990 error notifications despite 0 tasks existing
  -- Root cause: Unknown query issue or logic bug
  -- See migration: 20251203000002_disable_overdue_task_notifications.sql
  -- TODO: Investigate and fix the bug, then re-enable using rollback script

  -- Return success response to prevent frontend errors
  RETURN json_build_object(
    'success', true,
    'notifications_sent', 0,
    'disabled', true,
    'reason', 'Function disabled due to notification flood bug (11,990 notifications)',
    'timestamp', NOW(),
    'migration', '20251203000002_disable_overdue_task_notifications.sql'
  );
END;
$$ LANGUAGE plpgsql;

-- Update function comment to document the change
COMMENT ON FUNCTION notify_overdue_tasks IS
  'DISABLED 2025-12-03: Creating spurious notifications despite 0 tasks in database. ' ||
  'Replaced with no-op version. See migration 20251203000002. ' ||
  'Rollback script: ROLLBACK_20251203000002_re_enable_overdue_notifications.sql';

-- Verification: Test the function returns disabled response
DO $$
DECLARE
  result JSON;
  is_disabled BOOLEAN;
  notifications_sent INTEGER;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Testing notify_overdue_tasks() Function:';
  RAISE NOTICE '========================================';

  -- Call the function
  SELECT notify_overdue_tasks() INTO result;

  -- Extract values
  is_disabled := (result->>'disabled')::BOOLEAN;
  notifications_sent := (result->>'notifications_sent')::INTEGER;

  RAISE NOTICE 'Function response: %', result::TEXT;
  RAISE NOTICE '========================================';

  -- Verify it's properly disabled
  IF is_disabled = true AND notifications_sent = 0 THEN
    RAISE NOTICE '✅ SUCCESS: Function properly disabled';
    RAISE NOTICE '✅ Function will create 0 notifications';
    RAISE NOTICE '✅ Function returns success (no frontend errors)';
  ELSE
    RAISE WARNING '❌ FAIL: Function may not be properly disabled!';
    RAISE WARNING 'disabled flag: %', is_disabled;
    RAISE WARNING 'notifications_sent: %', notifications_sent;
  END IF;

  RAISE NOTICE '========================================';
END $$;

-- Document the change in a separate comment table (if it exists)
-- This helps with audit trail and debugging
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'migration_notes') THEN
    INSERT INTO migration_notes (migration_name, note, created_at)
    VALUES (
      '20251203000002_disable_overdue_task_notifications',
      'Disabled notify_overdue_tasks() due to notification flood bug. Function now returns no-op response.',
      NOW()
    );
  END IF;
END $$;
