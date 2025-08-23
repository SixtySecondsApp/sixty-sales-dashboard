-- Dashboard Performance Optimization Indexes
-- This migration adds indexes to optimize dashboard queries and creates materialized views

-- Indexes for activities table
CREATE INDEX IF NOT EXISTS idx_activities_user_date 
  ON activities(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_activities_user_type_date 
  ON activities(user_id, type, date DESC);

CREATE INDEX IF NOT EXISTS idx_activities_date_range 
  ON activities(date) 
  WHERE date >= (CURRENT_DATE - INTERVAL '90 days');

-- Indexes for clients table
CREATE INDEX IF NOT EXISTS idx_clients_owner_status 
  ON clients(owner_id, status);

CREATE INDEX IF NOT EXISTS idx_clients_subscription 
  ON clients(owner_id, subscription_amount) 
  WHERE status = 'active';

-- Indexes for deals table
CREATE INDEX IF NOT EXISTS idx_deals_stage_owner 
  ON deals(stage_id, owner_id);

CREATE INDEX IF NOT EXISTS idx_deals_owner_value 
  ON deals(owner_id, value DESC);

CREATE INDEX IF NOT EXISTS idx_deals_date_range 
  ON deals(created_at) 
  WHERE created_at >= (CURRENT_DATE - INTERVAL '90 days');

-- Create materialized view for dashboard metrics (refreshed hourly)
CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_metrics_hourly AS
SELECT 
  user_id,
  DATE_TRUNC('month', date) as month,
  type,
  COUNT(*) as activity_count,
  SUM(CASE WHEN type = 'sale' THEN amount ELSE 0 END) as revenue,
  AVG(CASE WHEN type = 'sale' THEN amount ELSE NULL END) as avg_sale_value,
  MAX(date) as last_activity_date
FROM activities
WHERE date >= (CURRENT_DATE - INTERVAL '13 months')
GROUP BY user_id, DATE_TRUNC('month', date), type;

-- Index on the materialized view for fast lookups
CREATE INDEX IF NOT EXISTS idx_dashboard_metrics_user_month 
  ON dashboard_metrics_hourly(user_id, month DESC);

-- Create materialized view for MRR calculations (refreshed daily)
CREATE MATERIALIZED VIEW IF NOT EXISTS mrr_summary_daily AS
SELECT 
  owner_id,
  COUNT(*) as total_clients,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active_clients,
  COUNT(CASE WHEN status = 'churned' THEN 1 END) as churned_clients,
  COUNT(CASE WHEN status = 'paused' THEN 1 END) as paused_clients,
  SUM(CASE WHEN status = 'active' THEN subscription_amount ELSE 0 END) as total_mrr,
  AVG(CASE WHEN status = 'active' THEN subscription_amount ELSE NULL END) as avg_mrr,
  MIN(CASE WHEN status = 'active' THEN subscription_amount ELSE NULL END) as min_mrr,
  MAX(CASE WHEN status = 'active' THEN subscription_amount ELSE NULL END) as max_mrr,
  CASE 
    WHEN COUNT(*) > 0 
    THEN (COUNT(CASE WHEN status = 'churned' THEN 1 END)::DECIMAL / COUNT(*)::DECIMAL * 100)
    ELSE 0 
  END as churn_rate,
  CASE 
    WHEN COUNT(*) > 0 
    THEN (COUNT(CASE WHEN status = 'active' THEN 1 END)::DECIMAL / COUNT(*)::DECIMAL * 100)
    ELSE 100 
  END as active_rate
FROM clients
GROUP BY owner_id;

-- Index on the MRR summary view
CREATE INDEX IF NOT EXISTS idx_mrr_summary_owner 
  ON mrr_summary_daily(owner_id);

-- Function to refresh materialized views (can be called by cron job)
CREATE OR REPLACE FUNCTION refresh_dashboard_views()
RETURNS void AS $$
BEGIN
  -- Refresh hourly metrics (for dashboard)
  REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_metrics_hourly;
  
  -- Refresh daily MRR summary
  REFRESH MATERIALIZED VIEW CONCURRENTLY mrr_summary_daily;
END;
$$ LANGUAGE plpgsql;

-- Create a stored procedure for efficient dashboard data retrieval
CREATE OR REPLACE FUNCTION get_dashboard_data(
  p_user_id UUID,
  p_month DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  metric_type TEXT,
  current_value NUMERIC,
  previous_value NUMERIC,
  trend_percent NUMERIC
) AS $$
DECLARE
  v_month_start DATE;
  v_month_end DATE;
  v_prev_month_start DATE;
  v_prev_month_end DATE;
BEGIN
  -- Calculate date ranges
  v_month_start := DATE_TRUNC('month', p_month);
  v_month_end := (v_month_start + INTERVAL '1 month - 1 day')::DATE;
  v_prev_month_start := v_month_start - INTERVAL '1 month';
  v_prev_month_end := v_month_start - INTERVAL '1 day';
  
  -- Return aggregated metrics
  RETURN QUERY
  WITH current_month AS (
    SELECT 
      type,
      COUNT(*) as count,
      SUM(CASE WHEN type = 'sale' THEN amount ELSE 0 END) as revenue
    FROM activities
    WHERE user_id = p_user_id
      AND date BETWEEN v_month_start AND v_month_end
    GROUP BY type
  ),
  previous_month AS (
    SELECT 
      type,
      COUNT(*) as count,
      SUM(CASE WHEN type = 'sale' THEN amount ELSE 0 END) as revenue
    FROM activities
    WHERE user_id = p_user_id
      AND date BETWEEN v_prev_month_start AND v_prev_month_end
    GROUP BY type
  )
  SELECT 
    cm.type::TEXT as metric_type,
    COALESCE(cm.revenue, cm.count)::NUMERIC as current_value,
    COALESCE(pm.revenue, pm.count, 0)::NUMERIC as previous_value,
    CASE 
      WHEN COALESCE(pm.revenue, pm.count, 0) > 0 
      THEN ((COALESCE(cm.revenue, cm.count) - COALESCE(pm.revenue, pm.count, 0)) / COALESCE(pm.revenue, pm.count, 0) * 100)::NUMERIC
      ELSE 100::NUMERIC
    END as trend_percent
  FROM current_month cm
  LEFT JOIN previous_month pm ON cm.type = pm.type;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON dashboard_metrics_hourly TO authenticated;
GRANT SELECT ON mrr_summary_daily TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_data TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_dashboard_views TO service_role;

-- Comment on the migration
COMMENT ON MATERIALIZED VIEW dashboard_metrics_hourly IS 'Pre-calculated dashboard metrics refreshed hourly for performance';
COMMENT ON MATERIALIZED VIEW mrr_summary_daily IS 'Pre-calculated MRR summary refreshed daily for performance';
COMMENT ON FUNCTION get_dashboard_data IS 'Optimized function to retrieve dashboard data with trend calculations';