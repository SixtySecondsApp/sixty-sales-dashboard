-- Migration: Seed Initial API Monitor Improvements
-- Purpose: Record recent optimizations with expected impact
-- Date: 2026-01-03

-- ============================================================================
-- Seed improvements for recent API optimizations
-- ============================================================================

INSERT INTO api_monitor_improvements (
  title,
  description,
  shipped_at,
  expected_delta_requests_per_day,
  expected_delta_error_rate,
  code_changes,
  before_window_start,
  before_window_end,
  after_window_start,
  after_window_end
) VALUES
  (
    'Fix Activity Service UUID Generation',
    'Fixed activityService.ts to generate proper UUIDv4 session IDs instead of non-UUID strings. This prevents 400 errors from log_user_activity_event RPC calls and eliminates retry loops.',
    '2026-01-02 20:00:00+00'::timestamptz,
    -5000, -- Expected reduction: ~5000 failed retry requests per day
    -2.5, -- Expected error rate reduction: ~2.5%
    '[
      {"file": "src/lib/services/activityService.ts", "type": "fix"},
      {"file": "src/lib/utils/uuidUtils.ts", "type": "fix"}
    ]'::jsonb,
    '2026-01-01 00:00:00+00'::timestamptz, -- Before window: 2 days before fix
    '2026-01-02 20:00:00+00'::timestamptz,
    '2026-01-02 20:00:00+00'::timestamptz, -- After window: starts at fix time
    '2026-01-04 20:00:00+00'::timestamptz  -- 2 days after fix
  ),
  (
    'Add Notification Service Request Deduplication',
    'Implemented 5-second in-memory cache and promise deduplication for getUnreadCount RPC calls. Prevents bursty duplicate requests from multiple UI components.',
    '2026-01-02 20:00:00+00'::timestamptz,
    -2000, -- Expected reduction: ~2000 duplicate notification requests per day
    -0.5, -- Expected error rate reduction: ~0.5%
    '[
      {"file": "src/lib/services/notificationService.ts", "type": "optimization"},
      {"file": "src/lib/hooks/useNotifications.ts", "type": "optimization"}
    ]'::jsonb,
    '2026-01-01 00:00:00+00'::timestamptz,
    '2026-01-02 20:00:00+00'::timestamptz,
    '2026-01-02 20:00:00+00'::timestamptz,
    '2026-01-04 20:00:00+00'::timestamptz
  ),
  (
    'Optimize Cron Job Schedules',
    'Reduced SavvyCal cron from every 15 minutes to every 4 hours (6x/day instead of 96x/day). Reduced Fathom cron from hourly to working hours only (8am-3pm weekdays, 8 calls/day instead of 24x/day).',
    '2026-01-02 20:00:00+00'::timestamptz,
    -2000, -- Expected reduction: ~2000 cron-triggered requests per day
    0, -- No error rate change expected
    '[
      {"file": "supabase/migrations/20260102200000_optimize_cron_schedules.sql", "type": "optimization"}
    ]'::jsonb,
    '2026-01-01 00:00:00+00'::timestamptz,
    '2026-01-02 20:00:00+00'::timestamptz,
    '2026-01-02 20:00:00+00'::timestamptz,
    '2026-01-04 20:00:00+00'::timestamptz
  ),
  (
    'Fix Notification RPC Parameter Name',
    'Corrected mark_notification_read RPC parameter from notification_id to p_notification_id to match PostgreSQL function signature.',
    '2026-01-02 20:00:00+00'::timestamptz,
    -100, -- Expected reduction: ~100 failed requests per day
    -0.1, -- Expected error rate reduction: ~0.1%
    '[
      {"file": "src/lib/services/notificationService.ts", "type": "fix"}
    ]'::jsonb,
    '2026-01-01 00:00:00+00'::timestamptz,
    '2026-01-02 20:00:00+00'::timestamptz,
    '2026-01-02 20:00:00+00'::timestamptz,
    '2026-01-04 20:00:00+00'::timestamptz
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE api_monitor_improvements IS 'Log of API optimizations. Actual deltas are computed by comparing rollups before/after shipped_at using compute_improvement_deltas() function.';
