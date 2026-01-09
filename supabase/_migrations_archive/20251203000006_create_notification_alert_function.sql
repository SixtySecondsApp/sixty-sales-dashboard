-- ============================================================================
-- Notification Flood Detection Function
-- ============================================================================
-- Purpose: Programmatic function to detect notification floods and return alerts
-- Date: 2025-12-03
-- Part of: Notification flood prevention system (Phase 4.4)
-- ============================================================================

-- Step 1: Create function to check for notification floods
CREATE OR REPLACE FUNCTION check_notification_floods(
  p_alert_threshold TEXT DEFAULT 'MEDIUM'
)
RETURNS JSON AS $$
DECLARE
  flood_result JSON;
  critical_count INTEGER;
  high_count INTEGER;
  medium_count INTEGER;
  low_count INTEGER;
  total_affected_users INTEGER;
  flood_details JSONB;
BEGIN
  -- Count alerts by level
  SELECT
    COUNT(*) FILTER (WHERE alert_level = 'CRITICAL'),
    COUNT(*) FILTER (WHERE alert_level = 'HIGH'),
    COUNT(*) FILTER (WHERE alert_level = 'MEDIUM'),
    COUNT(*) FILTER (WHERE alert_level = 'LOW'),
    COUNT(*)
  INTO
    critical_count,
    high_count,
    medium_count,
    low_count,
    total_affected_users
  FROM notification_flood_alerts
  WHERE alert_level != 'NORMAL';

  -- Get detailed flood information
  SELECT jsonb_agg(flood_data)
  INTO flood_details
  FROM (
    SELECT jsonb_build_object(
      'user_id', user_id,
      'user_email', user_email,
      'alert_level', alert_level,
      'total_notifications', total_notifications,
      'unread_notifications', unread_notifications,
      'error_notifications', error_notifications,
      'last_hour', last_hour,
      'last_24_hours', last_24_hours,
      'alert_reason', alert_reason,
      'recommended_action', recommended_action
    ) as flood_data
    FROM notification_flood_alerts
    WHERE
      CASE p_alert_threshold
        WHEN 'CRITICAL' THEN alert_level = 'CRITICAL'
        WHEN 'HIGH' THEN alert_level IN ('CRITICAL', 'HIGH')
        WHEN 'MEDIUM' THEN alert_level IN ('CRITICAL', 'HIGH', 'MEDIUM')
        WHEN 'LOW' THEN alert_level IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')
        ELSE FALSE
      END
    ORDER BY
      CASE alert_level
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MEDIUM' THEN 3
        WHEN 'LOW' THEN 4
      END,
      last_24_hours DESC
  ) ordered_floods;

  -- Build result
  flood_result := json_build_object(
    'has_floods', (critical_count > 0 OR high_count > 0 OR medium_count > 0 OR low_count > 0),
    'flood_detected', critical_count > 0,
    'timestamp', NOW(),
    'summary', json_build_object(
      'critical_alerts', critical_count,
      'high_alerts', high_count,
      'medium_alerts', medium_count,
      'low_alerts', low_count,
      'total_affected_users', total_affected_users
    ),
    'severity', CASE
      WHEN critical_count > 0 THEN 'CRITICAL'
      WHEN high_count > 0 THEN 'HIGH'
      WHEN medium_count > 0 THEN 'MEDIUM'
      WHEN low_count > 0 THEN 'LOW'
      ELSE 'NORMAL'
    END,
    'requires_immediate_action', (critical_count > 0),
    'flood_details', COALESCE(flood_details, '[]'::jsonb),
    'recommended_actions', CASE
      WHEN critical_count > 0 THEN jsonb_build_array(
        'URGENT: Review notification_flood_alerts view immediately',
        'Investigate users with CRITICAL alert levels',
        'Check notification_type_breakdown for problematic notification types',
        'Consider emergency cleanup if flood is ongoing',
        'Review recent_notification_activity for patterns'
      )
      WHEN high_count > 0 THEN jsonb_build_array(
        'Review notification_flood_alerts for HIGH severity users',
        'Investigate notification patterns and sources',
        'Verify rate limiting is functioning correctly',
        'Monitor notification_rate_limit_status'
      )
      WHEN medium_count > 0 THEN jsonb_build_array(
        'Monitor users with MEDIUM alert levels',
        'Review notification_type_breakdown for common patterns',
        'Check if rate limits need adjustment'
      )
      WHEN low_count > 0 THEN jsonb_build_array(
        'Review users with LOW alert levels',
        'Monitor trends over time'
      )
      ELSE jsonb_build_array('No action needed - notification levels normal')
    END
  );

  RETURN flood_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_notification_floods IS
  'Programmatically detect notification floods and return actionable alerts. Parameters: p_alert_threshold (CRITICAL|HIGH|MEDIUM|LOW) - minimum alert level to include in details. Returns: JSON with flood status, severity, affected users, and recommended actions.';

-- ============================================================================
-- Step 2: Create convenience function for quick flood check
-- ============================================================================
CREATE OR REPLACE FUNCTION has_notification_flood()
RETURNS BOOLEAN AS $$
DECLARE
  flood_check JSON;
  has_flood BOOLEAN;
BEGIN
  SELECT check_notification_floods('CRITICAL') INTO flood_check;
  has_flood := (flood_check->>'flood_detected')::BOOLEAN;
  RETURN has_flood;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION has_notification_flood IS
  'Quick boolean check for critical notification floods. Returns TRUE if any CRITICAL level floods detected, FALSE otherwise.';

-- ============================================================================
-- Step 3: Create function to get notification health summary
-- ============================================================================
CREATE OR REPLACE FUNCTION get_notification_health_summary()
RETURNS JSON AS $$
DECLARE
  health_summary JSON;
  sum_total_notifications INTEGER;
  total_users_with_notifications INTEGER;
  avg_notifications_per_user NUMERIC;
  rate_limit_reached_count INTEGER;
  top_notification_types JSONB;
BEGIN
  -- Get total notification counts
  SELECT
    SUM(total_notifications),
    COUNT(*),
    ROUND(AVG(total_notifications), 1)
  INTO
    sum_total_notifications,
    total_users_with_notifications,
    avg_notifications_per_user
  FROM notification_counts_by_user;

  -- Get rate limit status
  SELECT COUNT(*)
  INTO rate_limit_reached_count
  FROM notification_rate_limit_status
  WHERE limit_status IN ('HOURLY_LIMIT_REACHED', 'DAILY_LIMIT_REACHED');

  -- Get top notification types
  SELECT jsonb_agg(
    jsonb_build_object(
      'type', notification_type,
      'category', category,
      'count', total_count,
      'affected_users', affected_users
    )
  )
  INTO top_notification_types
  FROM (
    SELECT *
    FROM notification_type_breakdown
    ORDER BY total_count DESC
    LIMIT 5
  ) top_types;

  -- Build health summary
  health_summary := json_build_object(
    'timestamp', NOW(),
    'overall_health', CASE
      WHEN EXISTS (SELECT 1 FROM notification_flood_alerts WHERE alert_level = 'CRITICAL') THEN 'CRITICAL'
      WHEN EXISTS (SELECT 1 FROM notification_flood_alerts WHERE alert_level = 'HIGH') THEN 'DEGRADED'
      WHEN EXISTS (SELECT 1 FROM notification_flood_alerts WHERE alert_level = 'MEDIUM') THEN 'WARNING'
      ELSE 'HEALTHY'
    END,
    'statistics', json_build_object(
      'total_notifications', COALESCE(sum_total_notifications, 0),
      'users_with_notifications', COALESCE(total_users_with_notifications, 0),
      'avg_notifications_per_user', COALESCE(avg_notifications_per_user, 0),
      'users_at_rate_limit', COALESCE(rate_limit_reached_count, 0)
    ),
    'top_notification_types', COALESCE(top_notification_types, '[]'::jsonb),
    'flood_check', check_notification_floods('MEDIUM')
  );

  RETURN health_summary;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_notification_health_summary IS
  'Get comprehensive notification system health summary. Returns: Overall health status, statistics, top notification types, and flood check results.';

-- ============================================================================
-- Step 4: Grant permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION check_notification_floods TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION has_notification_flood TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_notification_health_summary TO authenticated, service_role;

-- ============================================================================
-- Step 5: Verification and testing
-- ============================================================================
DO $$
DECLARE
  flood_check JSON;
  health_summary JSON;
  has_flood BOOLEAN;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Testing Notification Flood Detection:';
  RAISE NOTICE '========================================';

  -- Test 1: Check for floods
  SELECT check_notification_floods('MEDIUM') INTO flood_check;
  RAISE NOTICE 'Flood Detection Result:';
  RAISE NOTICE '  Has Floods: %', (flood_check->>'has_floods')::BOOLEAN;
  RAISE NOTICE '  Severity: %', flood_check->>'severity';
  RAISE NOTICE '  Critical Alerts: %', (flood_check->'summary'->>'critical_alerts')::INTEGER;
  RAISE NOTICE '  High Alerts: %', (flood_check->'summary'->>'high_alerts')::INTEGER;
  RAISE NOTICE '  Medium Alerts: %', (flood_check->'summary'->>'medium_alerts')::INTEGER;
  RAISE NOTICE '  Requires Immediate Action: %', (flood_check->>'requires_immediate_action')::BOOLEAN;

  -- Test 2: Quick flood check
  SELECT has_notification_flood() INTO has_flood;
  IF has_flood THEN
    RAISE WARNING '⚠️  CRITICAL FLOOD DETECTED!';
  ELSE
    RAISE NOTICE '✅ No critical floods detected';
  END IF;

  -- Test 3: Health summary
  SELECT get_notification_health_summary() INTO health_summary;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Notification System Health:';
  RAISE NOTICE '  Overall Health: %', health_summary->>'overall_health';
  RAISE NOTICE '  Total Notifications: %', (health_summary->'statistics'->>'total_notifications')::INTEGER;
  RAISE NOTICE '  Users with Notifications: %', (health_summary->'statistics'->>'users_with_notifications')::INTEGER;
  RAISE NOTICE '  Avg per User: %', (health_summary->'statistics'->>'avg_notifications_per_user')::NUMERIC;
  RAISE NOTICE '  Users at Rate Limit: %', (health_summary->'statistics'->>'users_at_rate_limit')::INTEGER;

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ All flood detection functions working';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- Step 6: Usage examples and documentation
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Notification Flood Detection Functions';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage Examples:';
  RAISE NOTICE '';
  RAISE NOTICE '1. Check for floods (all levels):';
  RAISE NOTICE '   SELECT check_notification_floods(''LOW'');';
  RAISE NOTICE '';
  RAISE NOTICE '2. Check for critical floods only:';
  RAISE NOTICE '   SELECT check_notification_floods(''CRITICAL'');';
  RAISE NOTICE '';
  RAISE NOTICE '3. Quick flood check (boolean):';
  RAISE NOTICE '   SELECT has_notification_flood();';
  RAISE NOTICE '';
  RAISE NOTICE '4. Get health summary:';
  RAISE NOTICE '   SELECT get_notification_health_summary();';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Alert Thresholds:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CRITICAL: >100/hour OR >1000/day';
  RAISE NOTICE 'HIGH: >50/hour OR >500/day OR >500 errors';
  RAISE NOTICE 'MEDIUM: >20/hour OR >200/day OR >100 errors';
  RAISE NOTICE 'LOW: >10/hour OR >100/day OR >50 errors';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Recommended Monitoring Schedule:';
  RAISE NOTICE '  - Run has_notification_flood() every 5 minutes';
  RAISE NOTICE '  - Run check_notification_floods(''HIGH'') every 15 minutes';
  RAISE NOTICE '  - Run get_notification_health_summary() every hour';
  RAISE NOTICE '  - Alert on CRITICAL floods immediately';
  RAISE NOTICE '========================================';
END $$;
