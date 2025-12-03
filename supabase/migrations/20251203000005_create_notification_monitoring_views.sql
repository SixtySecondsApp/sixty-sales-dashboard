-- ============================================================================
-- Notification Monitoring Views
-- ============================================================================
-- Purpose: Create views for monitoring notification patterns and detecting floods
-- Date: 2025-12-03
-- Part of: Notification flood prevention system (Phase 4.3)
-- ============================================================================

-- Step 1: View for notification counts by user
-- Shows total, unread, and per-type counts for each user
CREATE OR REPLACE VIEW notification_counts_by_user AS
SELECT
  n.user_id,
  u.email as user_email,
  u.full_name as user_name,
  COUNT(*) as total_notifications,
  COUNT(*) FILTER (WHERE n.read = false) as unread_notifications,
  COUNT(*) FILTER (WHERE n.type = 'error') as error_notifications,
  COUNT(*) FILTER (WHERE n.type = 'warning') as warning_notifications,
  COUNT(*) FILTER (WHERE n.type = 'info') as info_notifications,
  COUNT(*) FILTER (WHERE n.type = 'success') as success_notifications,
  COUNT(*) FILTER (WHERE n.created_at > NOW() - INTERVAL '1 hour') as last_hour,
  COUNT(*) FILTER (WHERE n.created_at > NOW() - INTERVAL '24 hours') as last_24_hours,
  COUNT(*) FILTER (WHERE n.created_at > NOW() - INTERVAL '7 days') as last_7_days,
  MAX(n.created_at) as last_notification_at,
  MIN(n.created_at) as first_notification_at
FROM notifications n
LEFT JOIN auth.users u ON u.id = n.user_id
GROUP BY n.user_id, u.email, u.full_name;

COMMENT ON VIEW notification_counts_by_user IS
  'Shows notification counts and statistics per user for monitoring. Useful for identifying users with excessive notifications.';

-- ============================================================================
-- Step 2: View for notification flood detection alerts
-- Categorizes users by notification volume (CRITICAL/HIGH/MEDIUM/LOW)
-- ============================================================================
CREATE OR REPLACE VIEW notification_flood_alerts AS
SELECT
  user_id,
  user_email,
  user_name,
  total_notifications,
  unread_notifications,
  error_notifications,
  last_hour,
  last_24_hours,
  last_7_days,
  last_notification_at,
  -- Alert level based on thresholds
  CASE
    -- CRITICAL: More than 100 notifications in last hour OR 1000 in 24h
    WHEN last_hour > 100 OR last_24_hours > 1000 THEN 'CRITICAL'
    -- HIGH: More than 50 in last hour OR 500 in 24h OR 500+ errors
    WHEN last_hour > 50 OR last_24_hours > 500 OR error_notifications > 500 THEN 'HIGH'
    -- MEDIUM: More than 20 in last hour OR 200 in 24h OR 100+ errors
    WHEN last_hour > 20 OR last_24_hours > 200 OR error_notifications > 100 THEN 'MEDIUM'
    -- LOW: More than 10 in last hour OR 100 in 24h OR 50+ errors
    WHEN last_hour > 10 OR last_24_hours > 100 OR error_notifications > 50 THEN 'LOW'
    ELSE 'NORMAL'
  END as alert_level,
  -- Alert reason
  CASE
    WHEN last_hour > 100 THEN CONCAT('FLOOD: ', last_hour, ' notifications in last hour')
    WHEN last_24_hours > 1000 THEN CONCAT('FLOOD: ', last_24_hours, ' notifications in 24 hours')
    WHEN last_hour > 50 THEN CONCAT('HIGH: ', last_hour, ' notifications in last hour')
    WHEN last_24_hours > 500 THEN CONCAT('HIGH: ', last_24_hours, ' notifications in 24 hours')
    WHEN error_notifications > 500 THEN CONCAT('HIGH: ', error_notifications, ' error notifications')
    WHEN last_hour > 20 THEN CONCAT('MEDIUM: ', last_hour, ' notifications in last hour')
    WHEN last_24_hours > 200 THEN CONCAT('MEDIUM: ', last_24_hours, ' notifications in 24 hours')
    WHEN error_notifications > 100 THEN CONCAT('MEDIUM: ', error_notifications, ' error notifications')
    WHEN last_hour > 10 THEN CONCAT('LOW: ', last_hour, ' notifications in last hour')
    WHEN last_24_hours > 100 THEN CONCAT('LOW: ', last_24_hours, ' notifications in 24 hours')
    WHEN error_notifications > 50 THEN CONCAT('LOW: ', error_notifications, ' error notifications')
    ELSE 'Normal notification levels'
  END as alert_reason,
  -- Recommended action
  CASE
    WHEN last_hour > 100 OR last_24_hours > 1000 THEN 'URGENT: Investigate notification flood immediately'
    WHEN last_hour > 50 OR last_24_hours > 500 OR error_notifications > 500 THEN 'Investigate notification patterns and consider rate limiting'
    WHEN last_hour > 20 OR last_24_hours > 200 OR error_notifications > 100 THEN 'Monitor notification patterns'
    WHEN last_hour > 10 OR last_24_hours > 100 OR error_notifications > 50 THEN 'Review notification sources'
    ELSE 'No action needed'
  END as recommended_action
FROM notification_counts_by_user
WHERE total_notifications > 0
ORDER BY
  CASE alert_level
    WHEN 'CRITICAL' THEN 1
    WHEN 'HIGH' THEN 2
    WHEN 'MEDIUM' THEN 3
    WHEN 'LOW' THEN 4
    ELSE 5
  END,
  last_24_hours DESC;

COMMENT ON VIEW notification_flood_alerts IS
  'Detects notification floods and categorizes users by alert level. Alert Levels: CRITICAL (>100/hr or >1000/day), HIGH (>50/hr or >500/day), MEDIUM (>20/hr or >200/day), LOW (>10/hr or >100/day). Use this view to identify and respond to notification floods.';

-- ============================================================================
-- Step 3: View for notification type breakdown
-- Shows distribution of notifications by type, category, and entity
-- ============================================================================
CREATE OR REPLACE VIEW notification_type_breakdown AS
SELECT
  n.type as notification_type,
  n.category,
  n.entity_type,
  COUNT(*) as total_count,
  COUNT(DISTINCT n.user_id) as affected_users,
  COUNT(*) FILTER (WHERE n.read = false) as unread_count,
  COUNT(*) FILTER (WHERE n.created_at > NOW() - INTERVAL '1 hour') as last_hour_count,
  COUNT(*) FILTER (WHERE n.created_at > NOW() - INTERVAL '24 hours') as last_24_hours_count,
  COUNT(*) FILTER (WHERE n.created_at > NOW() - INTERVAL '7 days') as last_7_days_count,
  MAX(n.created_at) as last_created_at,
  MIN(n.created_at) as first_created_at,
  -- Sample of recent notification titles
  STRING_AGG(DISTINCT n.title, ' | ' ORDER BY n.title) FILTER (WHERE n.created_at > NOW() - INTERVAL '24 hours') as recent_titles_sample
FROM notifications n
GROUP BY n.type, n.category, n.entity_type
ORDER BY total_count DESC;

COMMENT ON VIEW notification_type_breakdown IS
  'Shows notification distribution by type, category, and entity. Useful for identifying which notification types are most common and may need optimization.';

-- ============================================================================
-- Step 4: View for recent notification activity (last 24 hours)
-- Detailed view of recent notifications for debugging
-- ============================================================================
CREATE OR REPLACE VIEW recent_notification_activity AS
SELECT
  n.id,
  n.user_id,
  u.email as user_email,
  n.title,
  n.type,
  n.category,
  n.entity_type,
  n.entity_id,
  n.read,
  n.created_at,
  -- Time since creation
  EXTRACT(EPOCH FROM (NOW() - n.created_at)) / 3600 as hours_ago,
  -- Rate limit info
  (
    SELECT COUNT(*)
    FROM notifications n2
    WHERE n2.user_id = n.user_id
      AND n2.type = n.type
      AND n2.created_at BETWEEN n.created_at - INTERVAL '1 hour' AND n.created_at
  ) as notifications_in_same_hour
FROM notifications n
LEFT JOIN auth.users u ON u.id = n.user_id
WHERE n.created_at > NOW() - INTERVAL '24 hours'
ORDER BY n.created_at DESC;

COMMENT ON VIEW recent_notification_activity IS
  'Shows detailed notification activity from the last 24 hours. Includes rate limiting context (notifications in same hour). Useful for debugging notification issues and patterns.';

-- ============================================================================
-- Step 5: View for notification rate limit status
-- Shows current rate limit usage per user
-- ============================================================================
CREATE OR REPLACE VIEW notification_rate_limit_status AS
SELECT
  nrl.user_id,
  u.email as user_email,
  nrl.notification_type,
  COUNT(*) FILTER (WHERE nrl.created_at > NOW() - INTERVAL '1 hour') as count_last_hour,
  COUNT(*) FILTER (WHERE nrl.created_at > NOW() - INTERVAL '24 hours') as count_last_24_hours,
  -- Calculate remaining capacity
  10 - COUNT(*) FILTER (WHERE nrl.created_at > NOW() - INTERVAL '1 hour') as hourly_remaining,
  50 - COUNT(*) FILTER (WHERE nrl.created_at > NOW() - INTERVAL '24 hours') as daily_remaining,
  -- Calculate percentage used
  ROUND(COUNT(*) FILTER (WHERE nrl.created_at > NOW() - INTERVAL '1 hour') * 100.0 / 10, 1) as hourly_percent_used,
  ROUND(COUNT(*) FILTER (WHERE nrl.created_at > NOW() - INTERVAL '24 hours') * 100.0 / 50, 1) as daily_percent_used,
  -- Status
  CASE
    WHEN COUNT(*) FILTER (WHERE nrl.created_at > NOW() - INTERVAL '1 hour') >= 10 THEN 'HOURLY_LIMIT_REACHED'
    WHEN COUNT(*) FILTER (WHERE nrl.created_at > NOW() - INTERVAL '24 hours') >= 50 THEN 'DAILY_LIMIT_REACHED'
    WHEN COUNT(*) FILTER (WHERE nrl.created_at > NOW() - INTERVAL '1 hour') >= 8 THEN 'HOURLY_WARNING'
    WHEN COUNT(*) FILTER (WHERE nrl.created_at > NOW() - INTERVAL '24 hours') >= 40 THEN 'DAILY_WARNING'
    ELSE 'NORMAL'
  END as limit_status,
  MAX(nrl.created_at) as last_notification_attempt
FROM notification_rate_limits nrl
LEFT JOIN auth.users u ON u.id = nrl.user_id
WHERE nrl.created_at > NOW() - INTERVAL '24 hours'
GROUP BY nrl.user_id, u.email, nrl.notification_type
ORDER BY count_last_hour DESC, count_last_24_hours DESC;

COMMENT ON VIEW notification_rate_limit_status IS
  'Shows current rate limit usage and remaining capacity per user and notification type. Limits: 10 per hour, 50 per day. Status: HOURLY_LIMIT_REACHED, DAILY_LIMIT_REACHED, HOURLY_WARNING (8+), DAILY_WARNING (40+), NORMAL.';

-- ============================================================================
-- Step 6: Grant appropriate permissions on views
-- ============================================================================

-- Users can see their own notification stats
GRANT SELECT ON notification_counts_by_user TO authenticated;
GRANT SELECT ON notification_type_breakdown TO authenticated;
GRANT SELECT ON recent_notification_activity TO authenticated;
GRANT SELECT ON notification_rate_limit_status TO authenticated;

-- Admins can see flood alerts (requires admin role or service_role)
GRANT SELECT ON notification_flood_alerts TO service_role;

-- ============================================================================
-- Step 7: Verification and sample queries
-- ============================================================================
DO $$
DECLARE
  view_count INTEGER;
  user_count INTEGER;
  flood_count INTEGER;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Monitoring Views Created Successfully';
  RAISE NOTICE '========================================';

  -- Check views exist
  SELECT COUNT(*) INTO view_count
  FROM information_schema.views
  WHERE table_name IN (
    'notification_counts_by_user',
    'notification_flood_alerts',
    'notification_type_breakdown',
    'recent_notification_activity',
    'notification_rate_limit_status'
  );

  RAISE NOTICE 'Views Created: %/5', view_count;

  IF view_count = 5 THEN
    RAISE NOTICE '✅ All monitoring views created successfully';
  ELSE
    RAISE WARNING '❌ Only % of 5 views were created', view_count;
  END IF;

  -- Sample data from views
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Sample Data:';
  RAISE NOTICE '========================================';

  -- Count users with notifications
  SELECT COUNT(DISTINCT user_id) INTO user_count
  FROM notification_counts_by_user
  WHERE total_notifications > 0;

  RAISE NOTICE 'Users with notifications: %', COALESCE(user_count, 0);

  -- Count flood alerts
  SELECT COUNT(*) INTO flood_count
  FROM notification_flood_alerts
  WHERE alert_level IN ('CRITICAL', 'HIGH');

  IF flood_count > 0 THEN
    RAISE WARNING '⚠️  % users with CRITICAL or HIGH flood alerts', flood_count;
  ELSE
    RAISE NOTICE '✅ No flood alerts detected';
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Available Monitoring Queries:';
  RAISE NOTICE '========================================';
  RAISE NOTICE '1. SELECT * FROM notification_counts_by_user ORDER BY total_notifications DESC LIMIT 10;';
  RAISE NOTICE '2. SELECT * FROM notification_flood_alerts WHERE alert_level IN (''CRITICAL'', ''HIGH'');';
  RAISE NOTICE '3. SELECT * FROM notification_type_breakdown ORDER BY total_count DESC;';
  RAISE NOTICE '4. SELECT * FROM recent_notification_activity LIMIT 20;';
  RAISE NOTICE '5. SELECT * FROM notification_rate_limit_status WHERE limit_status != ''NORMAL'';';
  RAISE NOTICE '========================================';
END $$;
