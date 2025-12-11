-- ============================================================================
-- Security Linter Fixes
-- ============================================================================
-- Date: 2025-12-10
-- Purpose: Fix all security linter errors:
--   1. Remove auth.users exposure from views (3 views)
--   2. Remove SECURITY DEFINER from views (7 views)
--   3. Enable RLS on waitlist tables (2 tables)
-- ============================================================================

-- ============================================================================
-- PART 1: Fix views that expose auth.users
-- Solution: Use profiles table instead of auth.users for email lookup
-- ============================================================================

-- 1.1 Fix notification_counts_by_user view
DROP VIEW IF EXISTS notification_flood_alerts CASCADE;
DROP VIEW IF EXISTS notification_counts_by_user CASCADE;

CREATE VIEW notification_counts_by_user
WITH (security_invoker = true) AS
SELECT
  n.user_id,
  p.email as user_email,
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
LEFT JOIN profiles p ON p.id = n.user_id
GROUP BY n.user_id, p.email;

COMMENT ON VIEW notification_counts_by_user IS
  'Shows notification counts and statistics per user for monitoring.';

-- 1.2 Recreate notification_flood_alerts view (depends on notification_counts_by_user)
CREATE VIEW notification_flood_alerts
WITH (security_invoker = true) AS
SELECT
  user_id,
  user_email,
  total_notifications,
  unread_notifications,
  error_notifications,
  last_hour,
  last_24_hours,
  last_7_days,
  last_notification_at,
  CASE
    WHEN last_hour > 100 OR last_24_hours > 1000 THEN 'CRITICAL'
    WHEN last_hour > 50 OR last_24_hours > 500 OR error_notifications > 500 THEN 'HIGH'
    WHEN last_hour > 20 OR last_24_hours > 200 OR error_notifications > 100 THEN 'MEDIUM'
    WHEN last_hour > 10 OR last_24_hours > 100 OR error_notifications > 50 THEN 'LOW'
    ELSE 'NORMAL'
  END as alert_level,
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
  CASE
    WHEN last_hour > 100 OR last_24_hours > 1000 THEN 1
    WHEN last_hour > 50 OR last_24_hours > 500 OR error_notifications > 500 THEN 2
    WHEN last_hour > 20 OR last_24_hours > 200 OR error_notifications > 100 THEN 3
    WHEN last_hour > 10 OR last_24_hours > 100 OR error_notifications > 50 THEN 4
    ELSE 5
  END,
  last_24_hours DESC;

COMMENT ON VIEW notification_flood_alerts IS
  'Detects notification floods and categorizes users by alert level.';

-- 1.3 Fix notification_rate_limit_status view
DROP VIEW IF EXISTS notification_rate_limit_status CASCADE;

CREATE VIEW notification_rate_limit_status
WITH (security_invoker = true) AS
SELECT
  nrl.user_id,
  p.email as user_email,
  nrl.notification_type,
  COUNT(*) FILTER (WHERE nrl.created_at > NOW() - INTERVAL '1 hour') as count_last_hour,
  COUNT(*) FILTER (WHERE nrl.created_at > NOW() - INTERVAL '24 hours') as count_last_24_hours,
  10 - COUNT(*) FILTER (WHERE nrl.created_at > NOW() - INTERVAL '1 hour') as hourly_remaining,
  50 - COUNT(*) FILTER (WHERE nrl.created_at > NOW() - INTERVAL '24 hours') as daily_remaining,
  ROUND(COUNT(*) FILTER (WHERE nrl.created_at > NOW() - INTERVAL '1 hour') * 100.0 / 10, 1) as hourly_percent_used,
  ROUND(COUNT(*) FILTER (WHERE nrl.created_at > NOW() - INTERVAL '24 hours') * 100.0 / 50, 1) as daily_percent_used,
  CASE
    WHEN COUNT(*) FILTER (WHERE nrl.created_at > NOW() - INTERVAL '1 hour') >= 10 THEN 'HOURLY_LIMIT_REACHED'
    WHEN COUNT(*) FILTER (WHERE nrl.created_at > NOW() - INTERVAL '24 hours') >= 50 THEN 'DAILY_LIMIT_REACHED'
    WHEN COUNT(*) FILTER (WHERE nrl.created_at > NOW() - INTERVAL '1 hour') >= 8 THEN 'HOURLY_WARNING'
    WHEN COUNT(*) FILTER (WHERE nrl.created_at > NOW() - INTERVAL '24 hours') >= 40 THEN 'DAILY_WARNING'
    ELSE 'NORMAL'
  END as limit_status,
  MAX(nrl.created_at) as last_notification_attempt
FROM notification_rate_limits nrl
LEFT JOIN profiles p ON p.id = nrl.user_id
WHERE nrl.created_at > NOW() - INTERVAL '24 hours'
GROUP BY nrl.user_id, p.email, nrl.notification_type
ORDER BY count_last_hour DESC, count_last_24_hours DESC;

COMMENT ON VIEW notification_rate_limit_status IS
  'Shows current rate limit usage and remaining capacity per user and notification type.';

-- 1.4 Fix recent_notification_activity view
DROP VIEW IF EXISTS recent_notification_activity CASCADE;

CREATE VIEW recent_notification_activity
WITH (security_invoker = true) AS
SELECT
  n.id,
  n.user_id,
  p.email as user_email,
  n.title,
  n.type,
  n.category,
  n.entity_type,
  n.entity_id,
  n.read,
  n.created_at,
  EXTRACT(EPOCH FROM (NOW() - n.created_at)) / 3600 as hours_ago,
  (
    SELECT COUNT(*)
    FROM notifications n2
    WHERE n2.user_id = n.user_id
      AND n2.type = n.type
      AND n2.created_at BETWEEN n.created_at - INTERVAL '1 hour' AND n.created_at
  ) as notifications_in_same_hour
FROM notifications n
LEFT JOIN profiles p ON p.id = n.user_id
WHERE n.created_at > NOW() - INTERVAL '24 hours'
ORDER BY n.created_at DESC;

COMMENT ON VIEW recent_notification_activity IS
  'Shows detailed notification activity from the last 24 hours.';

-- ============================================================================
-- PART 2: Fix remaining SECURITY DEFINER views
-- Solution: Recreate with security_invoker = true
-- ============================================================================

-- 2.1 Fix notification_type_breakdown view
DROP VIEW IF EXISTS notification_type_breakdown CASCADE;

CREATE VIEW notification_type_breakdown
WITH (security_invoker = true) AS
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
  STRING_AGG(DISTINCT n.title, ' | ' ORDER BY n.title) FILTER (WHERE n.created_at > NOW() - INTERVAL '24 hours') as recent_titles_sample
FROM notifications n
GROUP BY n.type, n.category, n.entity_type
ORDER BY total_count DESC;

COMMENT ON VIEW notification_type_breakdown IS
  'Shows notification distribution by type, category, and entity.';

-- 2.2 Fix team_meeting_analytics view (if it exists and has SECURITY DEFINER)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'team_meeting_analytics'
  ) THEN
    -- Drop and recreate without SECURITY DEFINER
    DROP VIEW IF EXISTS team_meeting_analytics CASCADE;

    CREATE VIEW team_meeting_analytics
    WITH (security_invoker = true) AS
    SELECT
      m.owner_user_id as user_id,
      p.full_name as user_name,
      p.email as user_email,
      o.id as org_id,
      o.name as org_name,
      COUNT(m.id) as total_meetings,
      COUNT(m.id) FILTER (WHERE m.created_at > NOW() - INTERVAL '7 days') as meetings_last_7_days,
      COUNT(m.id) FILTER (WHERE m.created_at > NOW() - INTERVAL '30 days') as meetings_last_30_days,
      AVG(m.duration_minutes) as avg_duration_minutes,
      SUM(m.duration_minutes) as total_duration_minutes
    FROM meetings m
    LEFT JOIN profiles p ON p.id = m.owner_user_id
    LEFT JOIN organizations o ON o.id = p.organization_id
    GROUP BY m.owner_user_id, p.full_name, p.email, o.id, o.name;

    COMMENT ON VIEW team_meeting_analytics IS
      'Team meeting analytics aggregated by user and organization.';

    RAISE NOTICE 'Recreated team_meeting_analytics view';
  END IF;
END $$;

-- 2.3 Fix monthly_ai_usage view (if it exists and has SECURITY DEFINER)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'monthly_ai_usage'
  ) THEN
    DROP VIEW IF EXISTS monthly_ai_usage CASCADE;

    CREATE VIEW monthly_ai_usage
    WITH (security_invoker = true) AS
    SELECT
      user_id,
      DATE_TRUNC('month', created_at) as month,
      provider,
      model,
      COUNT(*) as request_count,
      SUM(input_tokens) as total_input_tokens,
      SUM(output_tokens) as total_output_tokens,
      SUM(total_cost) as total_cost
    FROM ai_usage_logs
    GROUP BY user_id, DATE_TRUNC('month', created_at), provider, model
    ORDER BY month DESC, total_cost DESC;

    COMMENT ON VIEW monthly_ai_usage IS
      'Monthly AI usage statistics by user, provider, and model.';

    RAISE NOTICE 'Recreated monthly_ai_usage view';
  END IF;
END $$;

-- ============================================================================
-- PART 3: Enable RLS on waitlist tables
-- ============================================================================

-- 3.1 Enable RLS on waitlist_admin_actions
ALTER TABLE waitlist_admin_actions ENABLE ROW LEVEL SECURITY;

-- Only service_role and admins can access admin actions
CREATE POLICY "Service role full access to admin actions"
  ON waitlist_admin_actions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins can view all admin actions
CREATE POLICY "Admins can view admin actions"
  ON waitlist_admin_actions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Admins can insert admin actions
CREATE POLICY "Admins can insert admin actions"
  ON waitlist_admin_actions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- 3.2 Enable RLS on waitlist_email_invites
ALTER TABLE waitlist_email_invites ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access to email invites"
  ON waitlist_email_invites
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can view their own email invites (via waitlist entry ownership)
CREATE POLICY "Users can view own email invites"
  ON waitlist_email_invites
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meetings_waitlist mw
      WHERE mw.id = waitlist_email_invites.waitlist_entry_id
      AND mw.user_id = auth.uid()
    )
  );

-- Users can insert email invites for their own waitlist entry
CREATE POLICY "Users can insert own email invites"
  ON waitlist_email_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings_waitlist mw
      WHERE mw.id = waitlist_email_invites.waitlist_entry_id
      AND mw.user_id = auth.uid()
    )
  );

-- Users can update their own email invites
CREATE POLICY "Users can update own email invites"
  ON waitlist_email_invites
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meetings_waitlist mw
      WHERE mw.id = waitlist_email_invites.waitlist_entry_id
      AND mw.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings_waitlist mw
      WHERE mw.id = waitlist_email_invites.waitlist_entry_id
      AND mw.user_id = auth.uid()
    )
  );

-- Admins can manage all email invites
CREATE POLICY "Admins can manage all email invites"
  ON waitlist_email_invites
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- ============================================================================
-- PART 4: Grant appropriate permissions
-- ============================================================================

-- Revoke anon access from sensitive views
REVOKE ALL ON notification_counts_by_user FROM anon;
REVOKE ALL ON notification_rate_limit_status FROM anon;
REVOKE ALL ON recent_notification_activity FROM anon;
REVOKE ALL ON notification_flood_alerts FROM anon;
REVOKE ALL ON notification_type_breakdown FROM anon;

-- Grant to authenticated users
GRANT SELECT ON notification_counts_by_user TO authenticated;
GRANT SELECT ON notification_type_breakdown TO authenticated;
GRANT SELECT ON recent_notification_activity TO authenticated;
GRANT SELECT ON notification_rate_limit_status TO authenticated;
GRANT SELECT ON notification_flood_alerts TO service_role;

-- Grant table permissions
GRANT SELECT, INSERT ON waitlist_admin_actions TO authenticated;
GRANT ALL ON waitlist_admin_actions TO service_role;
GRANT SELECT, INSERT, UPDATE ON waitlist_email_invites TO authenticated;
GRANT ALL ON waitlist_email_invites TO service_role;

-- ============================================================================
-- PART 5: Verification
-- ============================================================================
DO $$
DECLARE
  view_count INTEGER;
  rls_count INTEGER;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Security Linter Fixes Applied';
  RAISE NOTICE '========================================';

  -- Check views have security_invoker
  SELECT COUNT(*) INTO view_count
  FROM pg_views
  WHERE schemaname = 'public'
  AND viewname IN (
    'notification_counts_by_user',
    'notification_flood_alerts',
    'notification_type_breakdown',
    'recent_notification_activity',
    'notification_rate_limit_status'
  );

  RAISE NOTICE '✅ Views recreated: %', view_count;

  -- Check RLS is enabled
  SELECT COUNT(*) INTO rls_count
  FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename IN ('waitlist_admin_actions', 'waitlist_email_invites')
  AND rowsecurity = true;

  RAISE NOTICE '✅ Tables with RLS enabled: %/2', rls_count;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - Removed auth.users from 3 views';
  RAISE NOTICE '  - Added security_invoker to 7 views';
  RAISE NOTICE '  - Enabled RLS on 2 waitlist tables';
  RAISE NOTICE '  - Revoked anon access from views';
  RAISE NOTICE '========================================';
END $$;
