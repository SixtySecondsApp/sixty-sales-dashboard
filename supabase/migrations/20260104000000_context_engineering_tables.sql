-- Migration: Context Engineering Support Tables
-- Purpose: Add tables for skill output storage, reference archiving, and HITL tracking
-- Date: 2026-01-04
--
-- Context Engineering Principles:
-- 1. Compaction: Pointers, Not Payloads - Store full data externally
-- 2. Isolation: Results, Not Context Dumps - Skills return contracts
-- 3. Mutable State: Update state object, don't append history

-- =============================================================================
-- Step 1: Create skill_output_storage table
-- Stores full skill outputs for reference (compaction principle)
-- =============================================================================

CREATE TABLE IF NOT EXISTS skill_output_storage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organization scope
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Storage path (acts as unique identifier for retrieval)
  path TEXT NOT NULL,

  -- Content metadata
  content_type TEXT NOT NULL DEFAULT 'raw_response'
    CHECK (content_type IN (
      'transcript',
      'enrichment',
      'draft',
      'analysis',
      'raw_response',
      'image',
      'document'
    )),

  -- The actual data payload (JSONB for structured data)
  data JSONB NOT NULL,

  -- Size tracking for budget management
  size_bytes INTEGER NOT NULL DEFAULT 0,

  -- Timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ, -- Optional TTL for auto-cleanup

  -- Constraints
  UNIQUE (organization_id, path)
);

-- Indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_skill_output_storage_org
  ON skill_output_storage(organization_id);
CREATE INDEX IF NOT EXISTS idx_skill_output_storage_path
  ON skill_output_storage(path);
CREATE INDEX IF NOT EXISTS idx_skill_output_storage_type
  ON skill_output_storage(content_type);
CREATE INDEX IF NOT EXISTS idx_skill_output_storage_created
  ON skill_output_storage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_output_storage_expires
  ON skill_output_storage(expires_at)
  WHERE expires_at IS NOT NULL;

-- RLS
ALTER TABLE skill_output_storage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their organization's skill outputs"
  ON skill_output_storage FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage skill outputs"
  ON skill_output_storage FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- Step 2: Create sequence_references_archive table
-- Archives references that have been compacted out of active state
-- =============================================================================

CREATE TABLE IF NOT EXISTS sequence_references_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to the sequence execution
  sequence_instance_id TEXT NOT NULL,

  -- Organization scope
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Reference metadata
  reference_type TEXT NOT NULL
    CHECK (reference_type IN (
      'transcript',
      'enrichment',
      'draft',
      'analysis',
      'raw_response',
      'image',
      'document'
    )),
  location TEXT NOT NULL,
  summary TEXT,
  size_bytes INTEGER,

  -- Timing
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sequence_refs_instance
  ON sequence_references_archive(sequence_instance_id);
CREATE INDEX IF NOT EXISTS idx_sequence_refs_org
  ON sequence_references_archive(organization_id);
CREATE INDEX IF NOT EXISTS idx_sequence_refs_type
  ON sequence_references_archive(reference_type);

-- RLS
ALTER TABLE sequence_references_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their organization's archived references"
  ON sequence_references_archive FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage archived references"
  ON sequence_references_archive FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- Step 3: Create sequence_hitl_requests table
-- Tracks HITL (Human-in-the-Loop) approval requests
-- =============================================================================

CREATE TABLE IF NOT EXISTS sequence_hitl_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to the sequence execution
  execution_id TEXT NOT NULL,
  sequence_key TEXT NOT NULL,
  step_index INTEGER NOT NULL,
  timing TEXT NOT NULL CHECK (timing IN ('before', 'after')),

  -- Organization and user context
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  assigned_to_user_id UUID REFERENCES auth.users(id),

  -- Request configuration
  request_type TEXT NOT NULL
    CHECK (request_type IN ('confirmation', 'question', 'choice', 'input')),
  prompt TEXT NOT NULL,
  options JSONB DEFAULT '[]',
  default_value TEXT,

  -- Notification channels
  channels JSONB NOT NULL DEFAULT '["in_app"]',
  slack_channel_id TEXT,
  slack_message_ts TEXT,

  -- Timeout configuration
  timeout_minutes INTEGER NOT NULL DEFAULT 60,
  timeout_action TEXT NOT NULL DEFAULT 'fail'
    CHECK (timeout_action IN ('fail', 'continue', 'use_default')),
  expires_at TIMESTAMPTZ,

  -- Execution context (compact state at time of request)
  execution_context JSONB NOT NULL DEFAULT '{}',

  -- Response
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'responded', 'expired', 'cancelled')),
  response_value TEXT,
  response_context JSONB DEFAULT '{}',
  responded_by_user_id UUID REFERENCES auth.users(id),
  responded_at TIMESTAMPTZ,
  response_channel TEXT,

  -- Timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hitl_requests_execution
  ON sequence_hitl_requests(execution_id);
CREATE INDEX IF NOT EXISTS idx_hitl_requests_org
  ON sequence_hitl_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_hitl_requests_assigned
  ON sequence_hitl_requests(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_hitl_requests_status
  ON sequence_hitl_requests(status);
CREATE INDEX IF NOT EXISTS idx_hitl_requests_pending
  ON sequence_hitl_requests(organization_id, status)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_hitl_requests_expires
  ON sequence_hitl_requests(expires_at)
  WHERE status = 'pending';

-- RLS
ALTER TABLE sequence_hitl_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read HITL requests in their organization"
  ON sequence_hitl_requests FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can respond to assigned HITL requests"
  ON sequence_hitl_requests FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
    AND (assigned_to_user_id IS NULL OR assigned_to_user_id = auth.uid())
  );

CREATE POLICY "Service role can manage HITL requests"
  ON sequence_hitl_requests FOR ALL
  USING (auth.role() = 'service_role');

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_hitl_requests_updated_at ON sequence_hitl_requests;
CREATE TRIGGER update_hitl_requests_updated_at
  BEFORE UPDATE ON sequence_hitl_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Step 4: Add HITL columns to sequence_executions if not present
-- =============================================================================

DO $$
BEGIN
  -- Add waiting_for_hitl column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sequence_executions'
    AND column_name = 'waiting_for_hitl'
  ) THEN
    ALTER TABLE sequence_executions
    ADD COLUMN waiting_for_hitl BOOLEAN NOT NULL DEFAULT false;
  END IF;

  -- Add current_hitl_request_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sequence_executions'
    AND column_name = 'current_hitl_request_id'
  ) THEN
    ALTER TABLE sequence_executions
    ADD COLUMN current_hitl_request_id UUID;
  END IF;

  -- Update status constraint to include waiting_hitl
  -- First drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sequence_executions_status_check'
  ) THEN
    ALTER TABLE sequence_executions DROP CONSTRAINT sequence_executions_status_check;
  END IF;

  -- Recreate with waiting_hitl status
  ALTER TABLE sequence_executions
    ADD CONSTRAINT sequence_executions_status_check
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'waiting_hitl'));
END $$;

-- =============================================================================
-- Step 5: Create token_budget_tracking table
-- Tracks token usage for sequences (optional detailed tracking)
-- =============================================================================

CREATE TABLE IF NOT EXISTS sequence_token_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to sequence execution
  sequence_instance_id TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Token tracking
  system_prompt_tokens INTEGER NOT NULL DEFAULT 0,
  state_tokens INTEGER NOT NULL DEFAULT 0,
  skill_result_tokens INTEGER NOT NULL DEFAULT 0,
  total_used INTEGER NOT NULL DEFAULT 0,

  -- Budget limits
  per_step_ceiling INTEGER NOT NULL DEFAULT 3800,

  -- Status
  over_budget BOOLEAN NOT NULL DEFAULT false,
  warnings JSONB DEFAULT '[]',

  -- Per-step breakdown
  step_breakdown JSONB DEFAULT '[]',

  -- Timing
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_token_budgets_instance
  ON sequence_token_budgets(sequence_instance_id);
CREATE INDEX IF NOT EXISTS idx_token_budgets_org
  ON sequence_token_budgets(organization_id);
CREATE INDEX IF NOT EXISTS idx_token_budgets_over
  ON sequence_token_budgets(organization_id, over_budget)
  WHERE over_budget = true;

-- RLS
ALTER TABLE sequence_token_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their organization's token budgets"
  ON sequence_token_budgets FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage token budgets"
  ON sequence_token_budgets FOR ALL
  USING (auth.role() = 'service_role');

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_token_budgets_updated_at ON sequence_token_budgets;
CREATE TRIGGER update_token_budgets_updated_at
  BEFORE UPDATE ON sequence_token_budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Step 6: Create helper function to cleanup expired storage
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_skill_outputs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM skill_output_storage
  WHERE expires_at IS NOT NULL
    AND expires_at < now();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Step 7: Create helper function to expire pending HITL requests
-- =============================================================================

CREATE OR REPLACE FUNCTION expire_pending_hitl_requests()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE sequence_hitl_requests
  SET
    status = 'expired',
    updated_at = now()
  WHERE
    status = 'pending'
    AND expires_at IS NOT NULL
    AND expires_at < now();

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Step 8: Create function to get pending HITL requests for a user
-- =============================================================================

CREATE OR REPLACE FUNCTION get_pending_hitl_requests(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  execution_id TEXT,
  sequence_key TEXT,
  step_index INTEGER,
  request_type TEXT,
  prompt TEXT,
  options JSONB,
  default_value TEXT,
  timeout_minutes INTEGER,
  timeout_action TEXT,
  expires_at TIMESTAMPTZ,
  execution_context JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    hr.id,
    hr.execution_id,
    hr.sequence_key,
    hr.step_index,
    hr.request_type,
    hr.prompt,
    hr.options,
    hr.default_value,
    hr.timeout_minutes,
    hr.timeout_action,
    hr.expires_at,
    hr.execution_context,
    hr.created_at
  FROM sequence_hitl_requests hr
  WHERE
    hr.status = 'pending'
    AND (hr.assigned_to_user_id = p_user_id OR hr.assigned_to_user_id IS NULL)
    AND hr.organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = p_user_id
    )
    AND (hr.expires_at IS NULL OR hr.expires_at > now())
  ORDER BY hr.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_pending_hitl_requests TO authenticated;

-- =============================================================================
-- Step 9: Create function to respond to HITL request
-- =============================================================================

CREATE OR REPLACE FUNCTION respond_to_hitl_request(
  p_request_id UUID,
  p_response_value TEXT,
  p_response_context JSONB DEFAULT '{}',
  p_response_channel TEXT DEFAULT 'in_app'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_success BOOLEAN;
BEGIN
  UPDATE sequence_hitl_requests
  SET
    status = 'responded',
    response_value = p_response_value,
    response_context = p_response_context,
    responded_by_user_id = auth.uid(),
    responded_at = now(),
    response_channel = p_response_channel,
    updated_at = now()
  WHERE
    id = p_request_id
    AND status = 'pending'
    AND organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
    );

  GET DIAGNOSTICS v_success = ROW_COUNT;
  RETURN v_success > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION respond_to_hitl_request TO authenticated;

-- =============================================================================
-- Step 10: Add comments for documentation
-- =============================================================================

COMMENT ON TABLE skill_output_storage IS
'Stores full skill outputs for reference. Implements the Context Engineering compaction principle: store full data externally, pass references in context.';

COMMENT ON TABLE sequence_references_archive IS
'Archives references that have been compacted out of active sequence state. Allows retrieval of historical data without bloating active context.';

COMMENT ON TABLE sequence_hitl_requests IS
'Tracks Human-in-the-Loop approval requests during sequence execution. Supports pausing sequences for human review and approval.';

COMMENT ON TABLE sequence_token_budgets IS
'Tracks token usage per sequence execution. Implements Context Engineering token budget guidelines to keep sequences efficient.';

COMMENT ON FUNCTION cleanup_expired_skill_outputs IS
'Cleans up skill outputs that have passed their TTL. Run periodically via CRON.';

COMMENT ON FUNCTION expire_pending_hitl_requests IS
'Marks pending HITL requests as expired if past their timeout. Run periodically via CRON.';
