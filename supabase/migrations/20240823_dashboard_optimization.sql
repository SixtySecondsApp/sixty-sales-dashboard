-- Dashboard Performance Optimization Migration
-- Version: 2.0.0
-- Date: 2024-08-23
-- Description: Adds indexes and materialized views for dashboard performance

-- Create deployment log table if not exists
CREATE TABLE IF NOT EXISTS deployment_log (
  id SERIAL PRIMARY KEY,
  action VARCHAR(50) NOT NULL,
  version VARCHAR(20) NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  details JSONB
);

-- Log deployment start
INSERT INTO deployment_log (action, version, details)
VALUES ('deploy_start', 'v2.0.0', jsonb_build_object(
  'component', 'database',
  'changes', 'indexes and materialized views'
));

-- ============================================
-- INDEXES (CONCURRENT for zero downtime)
-- ============================================

-- Index for activities by user and date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_user_date 
ON activities(user_id, date DESC);

-- Index for activities by user, type, and date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_user_type_date 
ON activities(user_id, type, date DESC);

-- Index for activities by user and status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_user_status
ON activities(user_id, status);

-- Index for clients by owner and status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_owner_status 
ON clients(owner_id, status);

-- Index for clients by owner and subscription
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_owner_subscription
ON clients(owner_id, subscription_amount DESC);

-- ============================================
-- MATERIALIZED VIEWS for pre-calculated metrics
-- ============================================

-- Monthly metrics summary view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_monthly_metrics AS
SELECT 
  user_id,
  DATE_TRUNC('month', date) as month,
  -- Activity counts
  COUNT(*) FILTER (WHERE type = 'sale') as sales_count,
  COUNT(*) FILTER (WHERE type = 'outbound') as outbound_count,
  COUNT(*) FILTER (WHERE type = 'meeting') as meetings_count,
  COUNT(*) FILTER (WHERE type = 'proposal') as proposals_count,
  -- Revenue metrics
  SUM(amount) FILTER (WHERE type = 'sale') as revenue,
  AVG(amount) FILTER (WHERE type = 'sale') as avg_deal_size,
  MAX(amount) FILTER (WHERE type = 'sale') as max_deal_size,
  -- Status counts
  COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  -- Calculated at
  NOW() as calculated_at
FROM activities
WHERE date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months')
GROUP BY user_id, DATE_TRUNC('month', date);

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_mv_monthly_metrics_user_month 
ON mv_dashboard_monthly_metrics(user_id, month DESC);

-- Daily metrics for chart data
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_daily_metrics AS
SELECT 
  user_id,
  date,
  -- Daily counts
  COUNT(*) FILTER (WHERE type = 'sale') as sales_count,
  COUNT(*) FILTER (WHERE type = 'outbound') as outbound_count,
  COUNT(*) FILTER (WHERE type = 'meeting') as meetings_count,
  COUNT(*) FILTER (WHERE type = 'proposal') as proposals_count,
  -- Daily revenue
  SUM(amount) FILTER (WHERE type = 'sale') as revenue,
  -- Calculated at
  NOW() as calculated_at
FROM activities
WHERE date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY user_id, date;

-- Create index on daily metrics
CREATE INDEX IF NOT EXISTS idx_mv_daily_metrics_user_date 
ON mv_dashboard_daily_metrics(user_id, date DESC);

-- MRR summary view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_mrr_summary AS
SELECT 
  owner_id as user_id,
  COUNT(*) as total_clients,
  COUNT(*) FILTER (WHERE status = 'active') as active_clients,
  SUM(subscription_amount) FILTER (WHERE status = 'active') as total_mrr,
  AVG(subscription_amount) FILTER (WHERE status = 'active') as avg_mrr,
  COUNT(*) FILTER (WHERE status = 'churned' 
    AND updated_at >= CURRENT_DATE - INTERVAL '30 days') as churned_last_30_days,
  NOW() as calculated_at
FROM clients
GROUP BY owner_id;

-- Create index on MRR summary
CREATE INDEX IF NOT EXISTS idx_mv_mrr_summary_user 
ON mv_mrr_summary(user_id);

-- ============================================
-- REFRESH FUNCTIONS for materialized views
-- ============================================

-- Function to refresh all dashboard materialized views
CREATE OR REPLACE FUNCTION refresh_dashboard_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_monthly_metrics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_daily_metrics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mrr_summary;
  
  INSERT INTO deployment_log (action, version, details)
  VALUES ('views_refreshed', 'v2.0.0', jsonb_build_object(
    'timestamp', NOW(),
    'views', ARRAY['mv_dashboard_monthly_metrics', 'mv_dashboard_daily_metrics', 'mv_mrr_summary']
  ));
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROLLBACK FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION rollback_dashboard_optimization()
RETURNS void AS $$
BEGIN
  -- Drop materialized views
  DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_monthly_metrics CASCADE;
  DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_daily_metrics CASCADE;
  DROP MATERIALIZED VIEW IF EXISTS mv_mrr_summary CASCADE;
  
  -- Drop indexes
  DROP INDEX IF EXISTS idx_activities_user_date;
  DROP INDEX IF EXISTS idx_activities_user_type_date;
  DROP INDEX IF EXISTS idx_activities_user_status;
  DROP INDEX IF EXISTS idx_clients_owner_status;
  DROP INDEX IF EXISTS idx_clients_owner_subscription;
  
  -- Drop refresh function
  DROP FUNCTION IF EXISTS refresh_dashboard_views();
  
  -- Log rollback
  INSERT INTO deployment_log (action, version, details)
  VALUES ('rollback_complete', 'v1.0.0', jsonb_build_object(
    'timestamp', NOW(),
    'rolled_back_from', 'v2.0.0',
    'components', ARRAY['indexes', 'materialized_views', 'functions']
  ));
  
  RAISE NOTICE 'Dashboard optimization rollback completed successfully';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SCHEDULED REFRESH (using pg_cron if available)
-- ============================================

-- Check if pg_cron is available and schedule refresh
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Schedule refresh every 5 minutes
    PERFORM cron.schedule(
      'refresh-dashboard-views',
      '*/5 * * * *',
      'SELECT refresh_dashboard_views();'
    );
    
    RAISE NOTICE 'Scheduled automatic refresh every 5 minutes using pg_cron';
  ELSE
    RAISE NOTICE 'pg_cron not available. Manual refresh required or use external scheduler.';
  END IF;
END $$;

-- Initial refresh of views
SELECT refresh_dashboard_views();

-- Log deployment completion
INSERT INTO deployment_log (action, version, details)
VALUES ('deploy_complete', 'v2.0.0', jsonb_build_object(
  'timestamp', NOW(),
  'indexes_created', 5,
  'views_created', 3,
  'functions_created', 2
));

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify indexes exist
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE indexname LIKE 'idx_%'
  AND tablename IN ('activities', 'clients')
ORDER BY tablename, indexname;

-- Verify materialized views exist
SELECT 
  schemaname,
  matviewname,
  definition
FROM pg_matviews
WHERE matviewname LIKE 'mv_%'
ORDER BY matviewname;