-- Fix integration_health_summary view to only count tests from the LATEST run
-- instead of cumulative counts from the last 7 days

-- Drop the existing view
DROP VIEW IF EXISTS integration_health_summary;

-- Create improved view that only counts from the latest test run per integration
-- The latest run is determined by the most recent created_at timestamp
CREATE OR REPLACE VIEW integration_health_summary AS
WITH latest_run_per_integration AS (
  -- Find the timestamp of the most recent test run for each integration
  -- A "run" is a batch of tests executed at roughly the same time (within 1 minute)
  SELECT
    integration_name,
    MAX(created_at) as latest_run_at
  FROM integration_test_results
  GROUP BY integration_name
),
latest_run_tests AS (
  -- Get all tests from the latest run (within 5 minutes of the max timestamp)
  SELECT
    itr.*
  FROM integration_test_results itr
  INNER JOIN latest_run_per_integration lrpi
    ON itr.integration_name = lrpi.integration_name
    AND itr.created_at >= lrpi.latest_run_at - INTERVAL '5 minutes'
)
SELECT
  integration_name,
  COUNT(*) FILTER (WHERE status = 'passed') as passed_count,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
  COUNT(*) FILTER (WHERE status = 'error') as error_count,
  COUNT(*) as total_tests,
  ROUND(
    (COUNT(*) FILTER (WHERE status = 'passed')::DECIMAL / NULLIF(COUNT(*), 0)) * 100,
    1
  ) as pass_rate,
  MAX(created_at) as last_test_at,
  CASE
    WHEN COUNT(*) FILTER (WHERE status IN ('failed', 'error')) > 0 THEN 'critical'
    WHEN COUNT(*) FILTER (WHERE status = 'passed') = COUNT(*) THEN 'healthy'
    ELSE 'warning'
  END as health_status
FROM latest_run_tests
GROUP BY integration_name;

-- Add comment for documentation
COMMENT ON VIEW integration_health_summary IS 'Provides health status based on the LATEST test run only (not cumulative)';
