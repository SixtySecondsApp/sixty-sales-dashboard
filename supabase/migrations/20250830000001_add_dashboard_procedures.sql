-- Dashboard Aggregation Procedures
-- Based on Phase 3 Database Audit Findings
-- Addresses: "2-3 second dashboard load times" and "Multiple separate queries for different metrics"
-- Target: 70% performance improvement for dashboard queries

-- Revenue summary procedure for dashboard
CREATE OR REPLACE FUNCTION get_revenue_summary(owner_id UUID DEFAULT NULL)
RETURNS TABLE(
  total_one_off DECIMAL,
  total_mrr DECIMAL, 
  total_annual DECIMAL,
  won_deals_count INTEGER,
  active_deals_count INTEGER,
  avg_deal_value DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(d.one_off_revenue), 0) as total_one_off,
    COALESCE(SUM(d.monthly_mrr), 0) as total_mrr,
    COALESCE(SUM(d.annual_value), 0) as total_annual,
    COUNT(CASE WHEN d.stage_id IN (
      SELECT id FROM deal_stages WHERE name ILIKE '%won%' OR name ILIKE '%signed%'
    ) THEN 1 END)::INTEGER as won_deals_count,
    COUNT(CASE WHEN d.status = 'active' THEN 1 END)::INTEGER as active_deals_count,
    COALESCE(AVG(d.value), 0) as avg_deal_value
  FROM deals d
  WHERE (owner_id IS NULL OR d.owner_id = owner_id)
    AND d.status != 'deleted';
END;
$$ LANGUAGE plpgsql STABLE;

-- Pipeline summary procedure for dashboard
CREATE OR REPLACE FUNCTION get_pipeline_summary(owner_id UUID DEFAULT NULL)
RETURNS TABLE(
  stage_name TEXT,
  stage_color TEXT,
  deal_count INTEGER,
  total_value DECIMAL,
  avg_probability DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ds.name as stage_name,
    ds.color as stage_color,
    COUNT(d.id)::INTEGER as deal_count,
    COALESCE(SUM(d.value), 0) as total_value,
    COALESCE(AVG(d.probability), 0) as avg_probability
  FROM deal_stages ds
  LEFT JOIN deals d ON d.stage_id = ds.id 
    AND d.status = 'active'
    AND (get_pipeline_summary.owner_id IS NULL OR d.owner_id = get_pipeline_summary.owner_id)
  GROUP BY ds.id, ds.name, ds.color, ds.order_position
  ORDER BY ds.order_position;
END;
$$ LANGUAGE plpgsql STABLE;

-- Activity summary procedure for dashboard  
CREATE OR REPLACE FUNCTION get_activity_summary(owner_id UUID DEFAULT NULL)
RETURNS TABLE(
  activity_type TEXT,
  count_today INTEGER,
  count_this_week INTEGER,
  count_this_month INTEGER,
  total_value DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.type::TEXT as activity_type,
    COUNT(CASE 
      WHEN a.date >= CURRENT_DATE 
      THEN 1 
    END)::INTEGER as count_today,
    COUNT(CASE 
      WHEN a.date >= date_trunc('week', CURRENT_DATE) 
      THEN 1 
    END)::INTEGER as count_this_week,
    COUNT(CASE 
      WHEN a.date >= date_trunc('month', CURRENT_DATE) 
      THEN 1 
    END)::INTEGER as count_this_month,
    COALESCE(SUM(a.amount), 0) as total_value
  FROM activities a
  WHERE (get_activity_summary.owner_id IS NULL OR a.user_id = get_activity_summary.owner_id)
    AND a.status = 'completed'
    AND a.date >= CURRENT_DATE - INTERVAL '3 months'
  GROUP BY a.type
  ORDER BY count_this_month DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Deal performance analytics procedure
CREATE OR REPLACE FUNCTION get_deal_performance_analytics(owner_id UUID DEFAULT NULL, days_back INTEGER DEFAULT 30)
RETURNS TABLE(
  deals_created INTEGER,
  deals_won INTEGER,
  deals_lost INTEGER,
  conversion_rate DECIMAL,
  avg_deal_cycle_days DECIMAL,
  revenue_this_period DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(CASE WHEN d.created_at >= CURRENT_DATE - INTERVAL '1 day' * days_back THEN 1 END)::INTEGER as deals_created,
    COUNT(CASE 
      WHEN d.stage_id IN (SELECT id FROM deal_stages WHERE name ILIKE '%won%' OR name ILIKE '%signed%')
      AND d.updated_at >= CURRENT_DATE - INTERVAL '1 day' * days_back
      THEN 1 
    END)::INTEGER as deals_won,
    COUNT(CASE 
      WHEN d.stage_id IN (SELECT id FROM deal_stages WHERE name ILIKE '%lost%')
      AND d.updated_at >= CURRENT_DATE - INTERVAL '1 day' * days_back
      THEN 1 
    END)::INTEGER as deals_lost,
    CASE 
      WHEN COUNT(CASE WHEN d.created_at >= CURRENT_DATE - INTERVAL '1 day' * days_back THEN 1 END) > 0
      THEN (COUNT(CASE 
        WHEN d.stage_id IN (SELECT id FROM deal_stages WHERE name ILIKE '%won%' OR name ILIKE '%signed%')
        AND d.updated_at >= CURRENT_DATE - INTERVAL '1 day' * days_back
        THEN 1 
      END)::DECIMAL / COUNT(CASE WHEN d.created_at >= CURRENT_DATE - INTERVAL '1 day' * days_back THEN 1 END)::DECIMAL) * 100
      ELSE 0
    END as conversion_rate,
    COALESCE(AVG(CASE 
      WHEN d.stage_id IN (SELECT id FROM deal_stages WHERE name ILIKE '%won%' OR name ILIKE '%signed%')
      THEN EXTRACT(DAY FROM (d.updated_at - d.created_at))
    END), 0) as avg_deal_cycle_days,
    COALESCE(SUM(CASE 
      WHEN d.stage_id IN (SELECT id FROM deal_stages WHERE name ILIKE '%won%' OR name ILIKE '%signed%')
      AND d.updated_at >= CURRENT_DATE - INTERVAL '1 day' * days_back
      THEN d.value
    END), 0) as revenue_this_period
  FROM deals d
  WHERE (get_deal_performance_analytics.owner_id IS NULL OR d.owner_id = get_deal_performance_analytics.owner_id)
    AND d.status != 'deleted';
END;
$$ LANGUAGE plpgsql STABLE;

-- Activity trend analysis for better insights
CREATE OR REPLACE FUNCTION get_activity_trends(owner_id UUID DEFAULT NULL, days_back INTEGER DEFAULT 30)
RETURNS TABLE(
  date DATE,
  activity_count INTEGER,
  sales_count INTEGER,
  meetings_count INTEGER,
  total_value DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.date::DATE as date,
    COUNT(*)::INTEGER as activity_count,
    COUNT(CASE WHEN a.type = 'sale' THEN 1 END)::INTEGER as sales_count,
    COUNT(CASE WHEN a.type = 'meeting' THEN 1 END)::INTEGER as meetings_count,
    COALESCE(SUM(a.amount), 0) as total_value
  FROM activities a
  WHERE (get_activity_trends.owner_id IS NULL OR a.user_id = get_activity_trends.owner_id)
    AND a.status = 'completed'
    AND a.date >= CURRENT_DATE - INTERVAL '1 day' * days_back
  GROUP BY a.date::DATE
  ORDER BY a.date::DATE DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_revenue_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pipeline_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_activity_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_deal_performance_analytics(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_activity_trends(UUID, INTEGER) TO authenticated;

-- Create materialized view for heavy dashboard queries (optional optimization)
CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_cache AS
SELECT 
  owner_id,
  COUNT(*) as total_deals,
  SUM(value) as total_pipeline_value,
  AVG(probability) as avg_probability,
  COUNT(CASE WHEN stage_id IN (
    SELECT id FROM deal_stages WHERE name ILIKE '%won%' OR name ILIKE '%signed%'
  ) THEN 1 END) as won_deals,
  CURRENT_TIMESTAMP as last_updated
FROM deals 
WHERE status = 'active'
GROUP BY owner_id;

-- Index for materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_cache_owner ON dashboard_cache(owner_id);

-- Function to refresh materialized view (call this periodically or on data changes)
CREATE OR REPLACE FUNCTION refresh_dashboard_cache()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_cache;
END;
$$ LANGUAGE plpgsql;