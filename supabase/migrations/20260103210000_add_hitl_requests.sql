-- =============================================================================
-- Human-in-the-Loop (HITL) Requests for Agent Sequences
-- =============================================================================
-- Allows sequences to pause execution and request user input via Slack or in-app
-- Users can provide confirmation, answers, or additional context mid-workflow

-- Create HITL requests table
CREATE TABLE IF NOT EXISTS hitl_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to execution
  execution_id UUID NOT NULL REFERENCES sequence_executions(id) ON DELETE CASCADE,
  sequence_key TEXT NOT NULL,
  step_index INT NOT NULL,

  -- Organization and user context
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  assigned_to_user_id UUID REFERENCES auth.users(id), -- Optional: specific user to respond

  -- Request configuration
  request_type TEXT NOT NULL CHECK (request_type IN ('confirmation', 'question', 'choice', 'input')),
  prompt TEXT NOT NULL, -- The question or message to show
  options JSONB DEFAULT '[]', -- For 'choice' type: array of {value, label} options
  default_value TEXT, -- Default selection/answer if timeout

  -- Channel configuration
  channels TEXT[] NOT NULL DEFAULT ARRAY['in_app'], -- 'slack', 'in_app', or both
  slack_channel_id TEXT, -- Specific Slack channel to post to
  slack_message_ts TEXT, -- Slack message timestamp for updating

  -- Timeout configuration
  timeout_minutes INT DEFAULT 60, -- How long to wait before auto-proceeding or failing
  timeout_action TEXT DEFAULT 'fail' CHECK (timeout_action IN ('fail', 'continue', 'use_default')),
  expires_at TIMESTAMPTZ, -- Calculated from timeout_minutes

  -- Context passed from execution
  execution_context JSONB DEFAULT '{}', -- Relevant context from previous steps

  -- Response tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'expired', 'cancelled')),
  response_value TEXT, -- The user's response
  response_context JSONB DEFAULT '{}', -- Additional context provided
  responded_by_user_id UUID REFERENCES auth.users(id),
  responded_at TIMESTAMPTZ,
  response_channel TEXT, -- Which channel they responded from

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX idx_hitl_requests_execution ON hitl_requests(execution_id);
CREATE INDEX idx_hitl_requests_org_status ON hitl_requests(organization_id, status);
CREATE INDEX idx_hitl_requests_assigned_user ON hitl_requests(assigned_to_user_id, status) WHERE assigned_to_user_id IS NOT NULL;
CREATE INDEX idx_hitl_requests_expires ON hitl_requests(expires_at) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE hitl_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view HITL requests for their organization
CREATE POLICY "Users can view org HITL requests"
  ON hitl_requests
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Users can respond to HITL requests assigned to them or unassigned in their org
CREATE POLICY "Users can respond to HITL requests"
  ON hitl_requests
  FOR UPDATE
  USING (
    status = 'pending' AND
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    ) AND
    (assigned_to_user_id IS NULL OR assigned_to_user_id = auth.uid())
  )
  WITH CHECK (
    status IN ('responded', 'cancelled')
  );

-- Service role can manage all HITL requests
CREATE POLICY "Service role manages HITL requests"
  ON hitl_requests
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Update trigger for updated_at
CREATE TRIGGER update_hitl_requests_updated_at
  BEFORE UPDATE ON hitl_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Update sequence_executions to track HITL state
-- =============================================================================

-- Add columns to track HITL waiting state
ALTER TABLE sequence_executions
  ADD COLUMN IF NOT EXISTS waiting_for_hitl BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_hitl_request_id UUID REFERENCES hitl_requests(id);

-- Create index for finding executions waiting for HITL
CREATE INDEX IF NOT EXISTS idx_sequence_executions_hitl_waiting
  ON sequence_executions(waiting_for_hitl)
  WHERE waiting_for_hitl = true;

-- =============================================================================
-- Function to handle HITL response and resume execution
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_hitl_response(
  p_request_id UUID,
  p_response_value TEXT,
  p_response_context JSONB DEFAULT '{}'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request hitl_requests%ROWTYPE;
  v_execution sequence_executions%ROWTYPE;
BEGIN
  -- Get the request
  SELECT * INTO v_request FROM hitl_requests WHERE id = p_request_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request already processed');
  END IF;

  -- Check expiration
  IF v_request.expires_at IS NOT NULL AND v_request.expires_at < now() THEN
    UPDATE hitl_requests
    SET status = 'expired', updated_at = now()
    WHERE id = p_request_id;
    RETURN jsonb_build_object('success', false, 'error', 'Request has expired');
  END IF;

  -- Update the request with response
  UPDATE hitl_requests SET
    status = 'responded',
    response_value = p_response_value,
    response_context = p_response_context,
    responded_by_user_id = auth.uid(),
    responded_at = now(),
    response_channel = 'in_app',
    updated_at = now()
  WHERE id = p_request_id;

  -- Update the execution to no longer wait for HITL
  UPDATE sequence_executions SET
    waiting_for_hitl = false,
    current_hitl_request_id = NULL
  WHERE id = v_request.execution_id;

  -- Get the updated execution
  SELECT * INTO v_execution FROM sequence_executions WHERE id = v_request.execution_id;

  RETURN jsonb_build_object(
    'success', true,
    'execution_id', v_request.execution_id,
    'step_index', v_request.step_index,
    'execution_status', v_execution.status
  );
END;
$$;

-- =============================================================================
-- Function to expire pending HITL requests (called by cron)
-- =============================================================================

CREATE OR REPLACE FUNCTION expire_hitl_requests()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expired_count INT;
  v_request RECORD;
BEGIN
  -- Find and process expired requests
  FOR v_request IN
    SELECT * FROM hitl_requests
    WHERE status = 'pending'
    AND expires_at IS NOT NULL
    AND expires_at < now()
  LOOP
    -- Mark request as expired
    UPDATE hitl_requests SET
      status = 'expired',
      updated_at = now()
    WHERE id = v_request.id;

    -- Handle the execution based on timeout_action
    IF v_request.timeout_action = 'fail' THEN
      UPDATE sequence_executions SET
        status = 'failed',
        error_message = 'HITL request timed out at step ' || v_request.step_index,
        failed_step_index = v_request.step_index,
        waiting_for_hitl = false,
        current_hitl_request_id = NULL,
        completed_at = now()
      WHERE id = v_request.execution_id;
    ELSIF v_request.timeout_action = 'use_default' THEN
      -- Store default as response and mark as ready to continue
      UPDATE hitl_requests SET
        response_value = v_request.default_value,
        response_context = jsonb_build_object('auto_defaulted', true)
      WHERE id = v_request.id;

      UPDATE sequence_executions SET
        waiting_for_hitl = false,
        current_hitl_request_id = NULL
      WHERE id = v_request.execution_id;
    ELSIF v_request.timeout_action = 'continue' THEN
      -- Just continue without response
      UPDATE sequence_executions SET
        waiting_for_hitl = false,
        current_hitl_request_id = NULL
      WHERE id = v_request.execution_id;
    END IF;
  END LOOP;

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  RETURN v_expired_count;
END;
$$;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE hitl_requests IS 'Human-in-the-Loop requests for agent sequence execution pauses';
COMMENT ON COLUMN hitl_requests.request_type IS 'confirmation: yes/no, question: open text, choice: select from options, input: structured input';
COMMENT ON COLUMN hitl_requests.channels IS 'Array of notification channels: slack, in_app';
COMMENT ON COLUMN hitl_requests.timeout_action IS 'What to do on timeout: fail the sequence, continue without response, or use default value';
