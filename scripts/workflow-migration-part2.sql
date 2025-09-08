-- Part 2: Additional Tables for Workflow Testing System
-- Run this after part 1

-- 8. HTTP Request Recordings Table
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
  created_at TIMESTAMPTZ DEFAULT NOW()
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
  updated_at TIMESTAMPTZ DEFAULT NOW()
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
  promoted_by UUID,
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