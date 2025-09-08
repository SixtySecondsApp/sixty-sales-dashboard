-- Part 1: Core Tables for Workflow Testing System
-- Run this first, then run part 2

-- 1. Workflow Environments Table
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

-- 2. Workflow Contracts Table
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

-- 3. Execution Snapshots Table
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

-- 4. Node Fixtures Table
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

-- 5. Scenario Fixtures Table
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

-- 6. Variable Storage Table
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
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Execution Checkpoints Table
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