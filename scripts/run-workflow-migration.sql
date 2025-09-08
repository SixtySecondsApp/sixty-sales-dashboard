-- Advanced Workflow Testing & Execution System
-- Run this script in your Supabase SQL Editor

-- 1. Workflow Environments Table (Build/Staging/Live modes)
CREATE TABLE IF NOT EXISTS workflow_environments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES user_automation_rules(id) ON DELETE CASCADE,
  environment TEXT NOT NULL CHECK (environment IN ('build', 'staging', 'live')),
  config JSONB DEFAULT '{}',
  variables JSONB DEFAULT '{}',
  secrets JSONB DEFAULT '{}',
  webhook_urls JSONB DEFAULT '{}',
  rate_limits JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workflow_id, environment)
);

-- 2. Workflow Contracts Table (JSON Schema definitions)
CREATE TABLE IF NOT EXISTS workflow_contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES user_automation_rules(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  input_schema JSONB NOT NULL DEFAULT '{}',
  output_schema JSONB NOT NULL DEFAULT '{}',
  version INTEGER DEFAULT 1,
  is_current BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workflow_id, node_id, version)
);

-- 3. Execution Snapshots Table (Time-travel debugging)
CREATE TABLE IF NOT EXISTS execution_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID NOT NULL,
  workflow_id UUID NOT NULL REFERENCES user_automation_rules(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,
  snapshot_type TEXT CHECK (snapshot_type IN ('before', 'after', 'error')),
  state JSONB NOT NULL DEFAULT '{}',
  variables JSONB DEFAULT '{}',
  node_outputs JSONB DEFAULT '{}',
  http_requests JSONB DEFAULT '[]',
  error_details JSONB,
  memory_usage INTEGER,
  cpu_time INTEGER,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(execution_id, node_id, sequence_number)
);

-- 4. Node Fixtures Table (Pinned inputs and golden outputs)
CREATE TABLE IF NOT EXISTS node_fixtures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES user_automation_rules(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  fixture_name TEXT NOT NULL,
  fixture_type TEXT CHECK (fixture_type IN ('input', 'output', 'golden')),
  environment TEXT CHECK (environment IN ('build', 'staging', 'live')),
  data JSONB NOT NULL DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workflow_id, node_id, fixture_name, environment)
);

-- 5. Scenario Fixtures Table (End-to-end test scenarios)
CREATE TABLE IF NOT EXISTS scenario_fixtures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES user_automation_rules(id) ON DELETE CASCADE,
  scenario_name TEXT NOT NULL,
  description TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  tags TEXT[],
  trigger_data JSONB DEFAULT '{}',
  expected_outputs JSONB DEFAULT '{}',
  node_fixtures JSONB DEFAULT '[]',
  validation_rules JSONB DEFAULT '[]',
  is_baseline BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workflow_id, scenario_name)
);

-- 6. Variable Storage Table (Persistent KV store with scopes)
CREATE TABLE IF NOT EXISTS variable_storage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES user_automation_rules(id) ON DELETE CASCADE,
  execution_id UUID,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'workflow', 'execution', 'branch', 'ephemeral')),
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  ttl_seconds INTEGER,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workflow_id, scope, key)
);

-- 7. Execution Checkpoints Table (Resume points)
CREATE TABLE IF NOT EXISTS execution_checkpoints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID NOT NULL,
  workflow_id UUID NOT NULL REFERENCES user_automation_rules(id) ON DELETE CASCADE,
  checkpoint_name TEXT NOT NULL,
  node_id TEXT NOT NULL,
  state JSONB NOT NULL DEFAULT '{}',
  variables JSONB DEFAULT '{}',
  node_outputs JSONB DEFAULT '{}',
  can_resume BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(execution_id, checkpoint_name)
);

-- 8. HTTP Request Recordings Table (For replay)
CREATE TABLE IF NOT EXISTS http_request_recordings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID NOT NULL,
  workflow_id UUID NOT NULL REFERENCES user_automation_rules(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  request_sequence INTEGER NOT NULL,
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  headers JSONB DEFAULT '{}',
  body JSONB,
  response_status INTEGER,
  response_headers JSONB DEFAULT '{}',
  response_body JSONB,
  response_time_ms INTEGER,
  error TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Idempotency Keys Table
CREATE TABLE IF NOT EXISTS workflow_idempotency_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES user_automation_rules(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  execution_id UUID,
  result JSONB,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(workflow_id, idempotency_key)
);

-- 10. Dead Letter Queue Table
CREATE TABLE IF NOT EXISTS workflow_dead_letter_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES user_automation_rules(id) ON DELETE CASCADE,
  execution_id UUID,
  trigger_data JSONB DEFAULT '{}',
  error_message TEXT,
  error_count INTEGER DEFAULT 1,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('pending', 'retrying', 'failed', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- 11. Rate Limiting Table
CREATE TABLE IF NOT EXISTS workflow_rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES user_automation_rules(id) ON DELETE CASCADE,
  node_id TEXT,
  limit_key TEXT NOT NULL,
  requests_per_second INTEGER,
  requests_per_minute INTEGER,
  requests_per_hour INTEGER,
  burst_size INTEGER DEFAULT 10,
  current_tokens INTEGER DEFAULT 0,
  last_refill_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workflow_id, node_id, limit_key)
);

-- 12. Circuit Breaker State Table
CREATE TABLE IF NOT EXISTS workflow_circuit_breakers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES user_automation_rules(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  state TEXT CHECK (state IN ('closed', 'open', 'half_open')) DEFAULT 'closed',
  failure_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_threshold INTEGER DEFAULT 5,
  success_threshold INTEGER DEFAULT 3,
  timeout_seconds INTEGER DEFAULT 60,
  last_failure_at TIMESTAMPTZ,
  opens_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workflow_id, node_id)
);

-- 13. Batch Processing Windows Table
CREATE TABLE IF NOT EXISTS workflow_batch_windows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES user_automation_rules(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  window_type TEXT CHECK (window_type IN ('time', 'count', 'size')),
  window_size INTEGER NOT NULL,
  current_batch JSONB DEFAULT '[]',
  current_count INTEGER DEFAULT 0,
  current_size INTEGER DEFAULT 0,
  window_started_at TIMESTAMPTZ DEFAULT NOW(),
  window_closes_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workflow_id, node_id)
);

-- 14. Environment Promotion History
CREATE TABLE IF NOT EXISTS workflow_environment_promotions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES user_automation_rules(id) ON DELETE CASCADE,
  from_environment TEXT NOT NULL,
  to_environment TEXT NOT NULL,
  promoted_by UUID REFERENCES user_profiles(id),
  changes_diff JSONB DEFAULT '{}',
  rollback_data JSONB DEFAULT '{}',
  status TEXT CHECK (status IN ('pending', 'completed', 'failed', 'rolled_back')),
  promoted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Webhook Mirror Configuration
CREATE TABLE IF NOT EXISTS webhook_mirror_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES user_automation_rules(id) ON DELETE CASCADE,
  source_environment TEXT NOT NULL,
  target_environment TEXT NOT NULL,
  mirror_percentage DECIMAL(5,2) DEFAULT 0,
  filter_rules JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workflow_id, source_environment, target_environment)
);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_execution_snapshots_execution ON execution_snapshots(execution_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_execution_snapshots_workflow ON execution_snapshots(workflow_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_node_fixtures_workflow ON node_fixtures(workflow_id, node_id);
CREATE INDEX IF NOT EXISTS idx_scenario_fixtures_workflow ON scenario_fixtures(workflow_id);
CREATE INDEX IF NOT EXISTS idx_variable_storage_workflow ON variable_storage(workflow_id, scope);
CREATE INDEX IF NOT EXISTS idx_variable_storage_expires ON variable_storage(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_http_recordings_execution ON http_request_recordings(execution_id, request_sequence);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_lookup ON workflow_idempotency_keys(workflow_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_dlq_status ON workflow_dead_letter_queue(status, next_retry_at) WHERE status IN ('pending', 'retrying');
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON workflow_rate_limits(workflow_id, node_id, limit_key);
CREATE INDEX IF NOT EXISTS idx_circuit_breakers_lookup ON workflow_circuit_breakers(workflow_id, node_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_workflow_environments_updated_at BEFORE UPDATE ON workflow_environments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_contracts_updated_at BEFORE UPDATE ON workflow_contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_node_fixtures_updated_at BEFORE UPDATE ON node_fixtures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scenario_fixtures_updated_at BEFORE UPDATE ON scenario_fixtures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_variable_storage_updated_at BEFORE UPDATE ON variable_storage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_circuit_breakers_updated_at BEFORE UPDATE ON workflow_circuit_breakers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhook_mirror_updated_at BEFORE UPDATE ON webhook_mirror_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies for security
ALTER TABLE workflow_environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE variable_storage ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE http_request_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_dead_letter_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_circuit_breakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_batch_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_environment_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_mirror_config ENABLE ROW LEVEL SECURITY;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Advanced Workflow Testing System tables created successfully!';
END $$;