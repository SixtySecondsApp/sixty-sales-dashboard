-- Create integration test results table for storing test run history
-- This enables proactive monitoring and historical analysis of integration health

CREATE TABLE IF NOT EXISTS integration_test_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Integration identification
  integration_name TEXT NOT NULL, -- e.g., 'fathom', 'google', 'slack'

  -- Test identification
  test_name TEXT NOT NULL, -- e.g., 'oauth_token_validation', 'api_connectivity'
  test_category TEXT, -- e.g., 'authentication', 'sync', 'webhook'

  -- Test result
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'skipped', 'error')),
  duration_ms INTEGER, -- How long the test took

  -- Result details
  message TEXT, -- Human readable result message
  error_details JSONB, -- Detailed error information for debugging
  response_data JSONB, -- Optional response data for analysis

  -- Test context
  triggered_by TEXT NOT NULL CHECK (triggered_by IN ('manual', 'scheduled', 'webhook', 'onboarding')),
  triggered_by_user_id UUID REFERENCES auth.users(id),
  org_id UUID, -- Optional org context

  -- Indexes for common queries
  CONSTRAINT integration_test_results_org_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX idx_integration_test_results_integration ON integration_test_results(integration_name);
CREATE INDEX idx_integration_test_results_status ON integration_test_results(status);
CREATE INDEX idx_integration_test_results_created_at ON integration_test_results(created_at DESC);
CREATE INDEX idx_integration_test_results_org_id ON integration_test_results(org_id);
CREATE INDEX idx_integration_test_results_integration_status ON integration_test_results(integration_name, status, created_at DESC);

-- Create a view for latest test results per integration
CREATE OR REPLACE VIEW latest_integration_test_results AS
SELECT DISTINCT ON (integration_name, test_name)
  id,
  created_at,
  integration_name,
  test_name,
  test_category,
  status,
  duration_ms,
  message,
  error_details,
  triggered_by,
  triggered_by_user_id,
  org_id
FROM integration_test_results
ORDER BY integration_name, test_name, created_at DESC;

-- Create integration health summary view
CREATE OR REPLACE VIEW integration_health_summary AS
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
    WHEN COUNT(*) FILTER (WHERE status IN ('failed', 'error') AND created_at > NOW() - INTERVAL '1 hour') > 0 THEN 'critical'
    WHEN COUNT(*) FILTER (WHERE status IN ('failed', 'error') AND created_at > NOW() - INTERVAL '24 hours') > 0 THEN 'warning'
    ELSE 'healthy'
  END as health_status
FROM integration_test_results
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY integration_name;

-- RLS Policies
ALTER TABLE integration_test_results ENABLE ROW LEVEL SECURITY;

-- Platform admins can view all test results
CREATE POLICY "Platform admins can view all integration test results"
  ON integration_test_results
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- Platform admins can insert test results
CREATE POLICY "Platform admins can insert integration test results"
  ON integration_test_results
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- Service role can do anything (for edge functions)
CREATE POLICY "Service role full access to integration test results"
  ON integration_test_results
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create notifications table for integration alerts (if not exists)
CREATE TABLE IF NOT EXISTS integration_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  integration_name TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('failure', 'recovery', 'degradation')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),

  title TEXT NOT NULL,
  message TEXT NOT NULL,

  -- Link to the failing test
  test_result_id UUID REFERENCES integration_test_results(id),

  -- Alert state
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),

  -- Notification tracking
  slack_notified_at TIMESTAMPTZ,
  email_notified_at TIMESTAMPTZ
);

CREATE INDEX idx_integration_alerts_integration ON integration_alerts(integration_name);
CREATE INDEX idx_integration_alerts_severity ON integration_alerts(severity);
CREATE INDEX idx_integration_alerts_unresolved ON integration_alerts(resolved_at) WHERE resolved_at IS NULL;

-- RLS for alerts
ALTER TABLE integration_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can manage integration alerts"
  ON integration_alerts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

CREATE POLICY "Service role full access to integration alerts"
  ON integration_alerts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE integration_test_results IS 'Stores results of integration health tests for monitoring and debugging';
COMMENT ON TABLE integration_alerts IS 'Stores alerts generated when integration tests fail';
COMMENT ON VIEW integration_health_summary IS 'Provides a quick overview of integration health status';
COMMENT ON VIEW latest_integration_test_results IS 'Shows the most recent test result for each integration/test combination';
