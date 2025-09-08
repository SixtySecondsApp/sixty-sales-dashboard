-- Part 3: Indexes and Triggers for Workflow Testing System
-- Run this after parts 1 and 2

-- Create unique indexes for variable_storage
CREATE UNIQUE INDEX IF NOT EXISTS idx_variable_storage_unique_global 
  ON variable_storage(scope, key) 
  WHERE scope = 'global' AND workflow_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_variable_storage_unique_workflow 
  ON variable_storage(workflow_id, scope, key) 
  WHERE workflow_id IS NOT NULL;

-- Create unique indexes for rate limits
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_unique
  ON workflow_rate_limits(workflow_id, node_id, limit_key) 
  WHERE workflow_id IS NOT NULL AND node_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_unique_global
  ON workflow_rate_limits(limit_key) 
  WHERE workflow_id IS NULL AND node_id IS NULL;

-- Create unique indexes for circuit breakers
CREATE UNIQUE INDEX IF NOT EXISTS idx_circuit_breakers_unique
  ON workflow_circuit_breakers(workflow_id, node_id) 
  WHERE workflow_id IS NOT NULL;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_execution_snapshots_execution 
  ON execution_snapshots(execution_id, sequence_number);

CREATE INDEX IF NOT EXISTS idx_execution_snapshots_workflow 
  ON execution_snapshots(workflow_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_node_fixtures_workflow 
  ON node_fixtures(workflow_id, node_id);

CREATE INDEX IF NOT EXISTS idx_scenario_fixtures_workflow 
  ON scenario_fixtures(workflow_id);

CREATE INDEX IF NOT EXISTS idx_variable_storage_workflow 
  ON variable_storage(workflow_id, scope);

CREATE INDEX IF NOT EXISTS idx_variable_storage_expires 
  ON variable_storage(expires_at) 
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_http_recordings_execution 
  ON http_request_recordings(execution_id, request_sequence);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_lookup 
  ON workflow_idempotency_keys(workflow_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_dlq_status 
  ON workflow_dead_letter_queue(status, next_retry_at) 
  WHERE status IN ('pending', 'retrying');

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup 
  ON workflow_rate_limits(workflow_id, node_id, limit_key);

CREATE INDEX IF NOT EXISTS idx_circuit_breakers_lookup 
  ON workflow_circuit_breakers(workflow_id, node_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_workflow_environments_updated_at ON workflow_environments;
CREATE TRIGGER update_workflow_environments_updated_at 
  BEFORE UPDATE ON workflow_environments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workflow_contracts_updated_at ON workflow_contracts;
CREATE TRIGGER update_workflow_contracts_updated_at 
  BEFORE UPDATE ON workflow_contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_node_fixtures_updated_at ON node_fixtures;
CREATE TRIGGER update_node_fixtures_updated_at 
  BEFORE UPDATE ON node_fixtures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_scenario_fixtures_updated_at ON scenario_fixtures;
CREATE TRIGGER update_scenario_fixtures_updated_at 
  BEFORE UPDATE ON scenario_fixtures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_variable_storage_updated_at ON variable_storage;
CREATE TRIGGER update_variable_storage_updated_at 
  BEFORE UPDATE ON variable_storage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_circuit_breakers_updated_at ON workflow_circuit_breakers;
CREATE TRIGGER update_circuit_breakers_updated_at 
  BEFORE UPDATE ON workflow_circuit_breakers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_webhook_mirror_updated_at ON webhook_mirror_config;
CREATE TRIGGER update_webhook_mirror_updated_at 
  BEFORE UPDATE ON webhook_mirror_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Success message
SELECT 'Workflow Testing System migration completed successfully!' AS status;