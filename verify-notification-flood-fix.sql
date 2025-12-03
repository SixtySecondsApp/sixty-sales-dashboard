-- ============================================================================
-- Notification Flood Fix - Comprehensive Verification Queries
-- ============================================================================
-- Purpose: Verify all phases of the notification flood fix are working correctly
-- Date: 2025-12-03
-- Usage: Run these queries to verify the fix after deploying migrations
-- ============================================================================

\echo '========================================'
\echo 'NOTIFICATION FLOOD FIX VERIFICATION'
\echo '========================================'
\echo ''

-- ============================================================================
-- PHASE 1 VERIFICATION: Emergency Cleanup
-- ============================================================================
\echo '========================================'
\echo 'Phase 1: Emergency Cleanup Verification'
\echo '========================================'
\echo ''

-- Check 1.1: No "Task Overdue" notifications exist
\echo 'Check 1.1: Verifying "Task Overdue" notifications deleted...'
SELECT
  COUNT(*) as overdue_notification_count,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ PASS: All "Task Overdue" notifications deleted'
    ELSE CONCAT('❌ FAIL: ', COUNT(*), ' "Task Overdue" notifications still exist')
  END as status
FROM notifications
WHERE title = 'Task Overdue' AND type = 'error';

\echo ''

-- Check 1.2: No error notifications with "overdue" in message from today
\echo 'Check 1.2: Verifying no error notifications with "overdue" from today...'
SELECT
  COUNT(*) as error_overdue_count,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ PASS: No error "overdue" notifications from today'
    ELSE CONCAT('❌ FAIL: ', COUNT(*), ' error "overdue" notifications exist')
  END as status
FROM notifications
WHERE type = 'error'
  AND message LIKE '%overdue%'
  AND created_at > CURRENT_DATE;

\echo ''

-- Check 1.3: Show notification counts by type
\echo 'Check 1.3: Current notification breakdown by type...'
SELECT
  type as notification_type,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE read = false) as unread_count
FROM notifications
GROUP BY type
ORDER BY count DESC;

\echo ''

-- ============================================================================
-- PHASE 2 VERIFICATION: Function Disabled
-- ============================================================================
\echo '========================================'
\echo 'Phase 2: Function Disabled Verification'
\echo '========================================'
\echo ''

-- Check 2.1: Test notify_overdue_tasks() returns disabled response
\echo 'Check 2.1: Testing notify_overdue_tasks() function...'
DO $$
DECLARE
  result JSON;
  is_disabled BOOLEAN;
  notifications_sent INTEGER;
BEGIN
  SELECT notify_overdue_tasks() INTO result;
  is_disabled := (result->>'disabled')::BOOLEAN;
  notifications_sent := (result->>'notifications_sent')::INTEGER;

  RAISE NOTICE 'Function Response: %', result;

  IF is_disabled = TRUE AND notifications_sent = 0 THEN
    RAISE NOTICE '✅ PASS: Function correctly disabled';
    RAISE NOTICE '✅ Function returns disabled=true';
    RAISE NOTICE '✅ Function returns notifications_sent=0';
  ELSE
    RAISE WARNING '❌ FAIL: Function may not be properly disabled!';
    RAISE WARNING 'disabled=%', is_disabled;
    RAISE WARNING 'notifications_sent=%', notifications_sent;
  END IF;
END $$;

\echo ''

-- Check 2.2: Verify function comment updated
\echo 'Check 2.2: Checking function comment...'
SELECT
  p.proname as function_name,
  d.description as comment,
  CASE
    WHEN d.description LIKE '%DISABLED%' THEN '✅ PASS: Function comment indicates disabled status'
    ELSE '❌ FAIL: Function comment not updated'
  END as status
FROM pg_proc p
LEFT JOIN pg_description d ON d.objoid = p.oid
WHERE p.proname = 'notify_overdue_tasks';

\echo ''

-- ============================================================================
-- PHASE 3 VERIFICATION: Frontend Safety
-- ============================================================================
\echo '========================================'
\echo 'Phase 3: Frontend Safety Verification'
\echo '========================================'
\echo ''
\echo 'Manual verification required:'
\echo '1. Check src/lib/services/meetingActionItemsSyncService.ts'
\echo '2. Verify triggerTaskNotifications() returns error response'
\echo '3. Verify notifyUpcomingDeadlines() throws error'
\echo '4. Verify notifyOverdueTasks() throws error'
\echo '5. Check browser console for warning messages when methods called'
\echo ''

-- ============================================================================
-- PHASE 4 VERIFICATION: Rate Limiting & Monitoring
-- ============================================================================
\echo '========================================'
\echo 'Phase 4: Rate Limiting & Monitoring'
\echo '========================================'
\echo ''

-- Check 4.1: Verify rate limiting table exists and is empty
\echo 'Check 4.1: Verifying rate limiting infrastructure...'
SELECT
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'notification_rate_limits'
  ) as table_exists,
  (SELECT COUNT(*) FROM notification_rate_limits) as current_rate_limit_records,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_rate_limits')
    THEN '✅ PASS: Rate limiting table exists'
    ELSE '❌ FAIL: Rate limiting table missing'
  END as status;

\echo ''

-- Check 4.2: Test rate limiting function
\echo 'Check 4.2: Testing rate limiting function...'
DO $$
DECLARE
  test_user_id UUID;
  can_create BOOLEAN;
  i INTEGER;
  created_count INTEGER := 0;
  blocked_count INTEGER := 0;
BEGIN
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;

  IF test_user_id IS NULL THEN
    RAISE NOTICE '⚠️  No users found for testing';
    RETURN;
  END IF;

  -- Test creating up to 15 notifications (limit is 10)
  FOR i IN 1..15 LOOP
    can_create := should_create_notification(test_user_id, 'test_rate_limit', 10, 50);
    IF can_create THEN
      created_count := created_count + 1;
    ELSE
      blocked_count := blocked_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Created: % | Blocked: %', created_count, blocked_count;

  IF created_count = 10 AND blocked_count = 5 THEN
    RAISE NOTICE '✅ PASS: Rate limiting working correctly';
  ELSE
    RAISE WARNING '❌ FAIL: Rate limiting not working as expected';
  END IF;

  -- Cleanup
  DELETE FROM notification_rate_limits WHERE user_id = test_user_id AND notification_type = 'test_rate_limit';
END $$;

\echo ''

-- Check 4.3: Verify monitoring views exist
\echo 'Check 4.3: Verifying monitoring views...'
SELECT
  COUNT(*) as view_count,
  CASE
    WHEN COUNT(*) = 5 THEN '✅ PASS: All 5 monitoring views exist'
    ELSE CONCAT('❌ FAIL: Only ', COUNT(*), ' of 5 views exist')
  END as status
FROM information_schema.views
WHERE table_name IN (
  'notification_counts_by_user',
  'notification_flood_alerts',
  'notification_type_breakdown',
  'recent_notification_activity',
  'notification_rate_limit_status'
);

\echo ''

-- Check 4.4: List all monitoring views
\echo 'Check 4.4: Available monitoring views:'
SELECT
  table_name as view_name,
  '✅ Available' as status
FROM information_schema.views
WHERE table_name IN (
  'notification_counts_by_user',
  'notification_flood_alerts',
  'notification_type_breakdown',
  'recent_notification_activity',
  'notification_rate_limit_status'
)
ORDER BY table_name;

\echo ''

-- Check 4.5: Test flood detection functions
\echo 'Check 4.5: Testing flood detection functions...'
DO $$
DECLARE
  flood_check JSON;
  has_flood BOOLEAN;
  health_summary JSON;
BEGIN
  -- Test check_notification_floods
  SELECT check_notification_floods('MEDIUM') INTO flood_check;
  RAISE NOTICE 'Flood Check: %', flood_check->>'severity';

  -- Test has_notification_flood
  SELECT has_notification_flood() INTO has_flood;
  IF has_flood THEN
    RAISE WARNING '⚠️  CRITICAL FLOOD DETECTED!';
  ELSE
    RAISE NOTICE '✅ No critical floods';
  END IF;

  -- Test get_notification_health_summary
  SELECT get_notification_health_summary() INTO health_summary;
  RAISE NOTICE 'System Health: %', health_summary->>'overall_health';

  RAISE NOTICE '✅ PASS: All flood detection functions working';
END $$;

\echo ''

-- ============================================================================
-- CURRENT STATE SUMMARY
-- ============================================================================
\echo '========================================'
\echo 'CURRENT STATE SUMMARY'
\echo '========================================'
\echo ''

-- Summary 1: Notification counts by user (top 10)
\echo 'Top 10 users by notification count:'
SELECT
  user_email,
  total_notifications,
  unread_notifications,
  error_notifications,
  last_24_hours
FROM notification_counts_by_user
ORDER BY total_notifications DESC
LIMIT 10;

\echo ''

-- Summary 2: Flood alerts
\echo 'Active flood alerts:'
SELECT
  user_email,
  alert_level,
  total_notifications,
  last_hour,
  last_24_hours,
  alert_reason
FROM notification_flood_alerts
WHERE alert_level != 'NORMAL'
ORDER BY
  CASE alert_level
    WHEN 'CRITICAL' THEN 1
    WHEN 'HIGH' THEN 2
    WHEN 'MEDIUM' THEN 3
    WHEN 'LOW' THEN 4
  END,
  last_24_hours DESC
LIMIT 20;

\echo ''

-- Summary 3: Notification type breakdown
\echo 'Notification type breakdown:'
SELECT
  notification_type,
  category,
  total_count,
  affected_users,
  last_24_hours_count
FROM notification_type_breakdown
ORDER BY total_count DESC
LIMIT 10;

\echo ''

-- Summary 4: Rate limit status
\echo 'Users at or near rate limits:'
SELECT
  user_email,
  notification_type,
  count_last_hour,
  hourly_remaining,
  count_last_24_hours,
  daily_remaining,
  limit_status
FROM notification_rate_limit_status
WHERE limit_status != 'NORMAL'
ORDER BY count_last_hour DESC, count_last_24_hours DESC
LIMIT 10;

\echo ''

-- ============================================================================
-- 24-HOUR MONITORING QUERIES
-- ============================================================================
\echo '========================================'
\echo '24-HOUR MONITORING QUERIES'
\echo '========================================'
\echo ''
\echo 'Run these queries over the next 24 hours to verify no regeneration:'
\echo ''
\echo '1. Check for new "Task Overdue" notifications:'
\echo '   SELECT COUNT(*) FROM notifications WHERE title = ''Task Overdue'' AND created_at > NOW() - INTERVAL ''1 hour'';'
\echo ''
\echo '2. Monitor flood alerts:'
\echo '   SELECT * FROM notification_flood_alerts WHERE alert_level IN (''CRITICAL'', ''HIGH'');'
\echo ''
\echo '3. Check system health:'
\echo '   SELECT get_notification_health_summary();'
\echo ''
\echo '4. Monitor rate limiting:'
\echo '   SELECT * FROM notification_rate_limit_status WHERE limit_status != ''NORMAL'';'
\echo ''

-- ============================================================================
-- SUCCESS CRITERIA CHECKLIST
-- ============================================================================
\echo '========================================'
\echo 'SUCCESS CRITERIA CHECKLIST'
\echo '========================================'
\echo ''

DO $$
DECLARE
  overdue_count INTEGER;
  function_disabled BOOLEAN;
  rate_limit_exists BOOLEAN;
  views_count INTEGER;
  critical_floods INTEGER;
BEGIN
  -- Check 1: No "Task Overdue" notifications
  SELECT COUNT(*) INTO overdue_count
  FROM notifications
  WHERE title = 'Task Overdue' AND type = 'error';

  -- Check 2: Function disabled
  SELECT (notify_overdue_tasks()->>'disabled')::BOOLEAN INTO function_disabled;

  -- Check 3: Rate limiting infrastructure exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_rate_limits'
  ) INTO rate_limit_exists;

  -- Check 4: All monitoring views exist
  SELECT COUNT(*) INTO views_count
  FROM information_schema.views
  WHERE table_name IN (
    'notification_counts_by_user',
    'notification_flood_alerts',
    'notification_type_breakdown',
    'recent_notification_activity',
    'notification_rate_limit_status'
  );

  -- Check 5: No critical floods
  SELECT COUNT(*) INTO critical_floods
  FROM notification_flood_alerts
  WHERE alert_level = 'CRITICAL';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'SUCCESS CRITERIA:';
  RAISE NOTICE '========================================';
  RAISE NOTICE '[%] Zero "Task Overdue" notifications (Count: %)',
    CASE WHEN overdue_count = 0 THEN '✅' ELSE '❌' END, overdue_count;
  RAISE NOTICE '[%] notify_overdue_tasks() disabled',
    CASE WHEN function_disabled THEN '✅' ELSE '❌' END;
  RAISE NOTICE '[%] Rate limiting infrastructure exists',
    CASE WHEN rate_limit_exists THEN '✅' ELSE '❌' END;
  RAISE NOTICE '[%] All monitoring views created (Count: %/5)',
    CASE WHEN views_count = 5 THEN '✅' ELSE '❌' END, views_count;
  RAISE NOTICE '[%] No critical floods detected (Count: %)',
    CASE WHEN critical_floods = 0 THEN '✅' ELSE '❌' END, critical_floods;
  RAISE NOTICE '========================================';

  IF overdue_count = 0 AND function_disabled AND rate_limit_exists AND views_count = 5 AND critical_floods = 0 THEN
    RAISE NOTICE '✅ ALL SUCCESS CRITERIA MET!';
    RAISE NOTICE '✅ Notification flood fix verified successfully';
  ELSE
    RAISE WARNING '❌ Some success criteria not met - review failures above';
  END IF;
  RAISE NOTICE '========================================';
END $$;

\echo ''
\echo '========================================'
\echo 'VERIFICATION COMPLETE'
\echo '========================================'
\echo ''
\echo 'Next Steps:'
\echo '1. Monitor for 24 hours to ensure no regeneration'
\echo '2. Test that useful notifications still work:'
\echo '   - Task assignment notifications'
\echo '   - Task reassignment notifications'
\echo '   - Task from meeting action items'
\echo '3. Review rate limiting logs after 24 hours'
\echo '4. If all tests pass, consider re-enabling notify_overdue_tasks()'
\echo '   after fixing the underlying bug'
\echo ''
