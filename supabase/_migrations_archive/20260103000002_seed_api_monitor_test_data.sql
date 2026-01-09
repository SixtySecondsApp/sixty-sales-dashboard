-- Migration: Seed API Monitor Test Data
-- Purpose: Add sample data so the UI has something to display
-- Date: 2026-01-03

-- Insert a test snapshot
INSERT INTO api_monitor_snapshots (
  snapshot_time,
  time_bucket_start,
  time_bucket_end,
  bucket_type,
  total_requests,
  total_errors,
  error_rate,
  top_endpoints,
  top_errors,
  top_callers,
  suspected_bursts,
  source
) VALUES (
  NOW(),
  NOW() - INTERVAL '1 hour',
  NOW(),
  '1h',
  1500,
  45,
  3.0,
  '[
    {"endpoint": "/rest/v1/deals", "method": "GET", "count": 450, "errors": 5},
    {"endpoint": "/rest/v1/contacts", "method": "GET", "count": 320, "errors": 8},
    {"endpoint": "/rpc/log_user_activity_event", "method": "POST", "count": 280, "errors": 25},
    {"endpoint": "/rest/v1/activities", "method": "GET", "count": 200, "errors": 2},
    {"endpoint": "/rest/v1/tasks", "method": "GET", "count": 150, "errors": 3},
    {"endpoint": "/rest/v1/user_notifications", "method": "GET", "count": 100, "errors": 2}
  ]'::jsonb,
  '[
    {"status": 400, "endpoint": "/rpc/log_user_activity_event", "count": 25, "sample_message": "invalid input syntax for type uuid"},
    {"status": 404, "endpoint": "/rest/v1/deals", "count": 5, "sample_message": "No rows found"},
    {"status": 500, "endpoint": "/rest/v1/contacts", "count": 8, "sample_message": "Internal server error"}
  ]'::jsonb,
  '[
    {"ip": "192.168.1.100", "user_agent": "Mozilla/5.0...", "count": 800},
    {"ip": "10.0.0.1", "user_agent": "Deno/1.40.0", "count": 500},
    {"ip": null, "user_agent": null, "count": 200}
  ]'::jsonb,
  jsonb_build_array(
    jsonb_build_object(
      'endpoint', '/rest/v1/user_notifications',
      'requests_per_minute', 75,
      'time_window', (NOW() - INTERVAL '30 minutes')::text
    )
  ),
  'supabase_logs'
) ON CONFLICT DO NOTHING;

-- Insert a test daily rollup (total)
INSERT INTO api_monitor_rollups_daily (
  date,
  user_id,
  total_requests,
  total_errors,
  error_rate,
  top_endpoints,
  error_breakdown
) VALUES (
  CURRENT_DATE,
  NULL, -- NULL = total across all users
  15000,
  450,
  3.0,
  '[
    {"endpoint": "/rest/v1/deals", "method": "GET", "count": 4500},
    {"endpoint": "/rest/v1/contacts", "method": "GET", "count": 3200},
    {"endpoint": "/rpc/log_user_activity_event", "method": "POST", "count": 2800}
  ]'::jsonb,
  '{"400": 250, "404": 50, "500": 150}'::jsonb
) ON CONFLICT (date, user_id) DO UPDATE SET
  total_requests = EXCLUDED.total_requests,
  total_errors = EXCLUDED.total_errors,
  error_rate = EXCLUDED.error_rate,
  top_endpoints = EXCLUDED.top_endpoints,
  error_breakdown = EXCLUDED.error_breakdown,
  updated_at = NOW();
