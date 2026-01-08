-- ============================================================================
-- Migration: HITL (Human-in-the-Loop) Pending Approvals
-- ============================================================================
-- Purpose: Track pending approval requests for AI-generated content with
-- Slack integration for approve/reject/edit workflows.
-- ============================================================================

-- Create the main table
CREATE TABLE IF NOT EXISTS hitl_pending_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- User who should approve
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Who/what initiated

  -- Resource identification
  resource_type TEXT NOT NULL CHECK (resource_type IN (
    'email_draft', 'follow_up', 'task_list', 'summary',
    'meeting_notes', 'proposal_section', 'coaching_tip'
  )),
  resource_id TEXT NOT NULL,  -- UUID or external ID of the resource
  resource_name TEXT,         -- Human-readable name for display

  -- Slack message tracking
  slack_team_id TEXT NOT NULL,
  slack_channel_id TEXT NOT NULL,
  slack_message_ts TEXT NOT NULL,  -- For message updates
  slack_thread_ts TEXT,            -- If in a thread

  -- State management
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'edited', 'expired', 'cancelled'
  )),

  -- Content storage (JSONB for flexibility)
  original_content JSONB NOT NULL,  -- The AI-generated content
  edited_content JSONB,             -- User-modified content (if edited)

  -- User response
  response JSONB,  -- { action, feedback, edited_fields, ... }
  actioned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actioned_at TIMESTAMPTZ,

  -- Callback mechanism for downstream workflows
  callback_type TEXT CHECK (callback_type IS NULL OR callback_type IN (
    'edge_function', 'webhook', 'workflow'
  )),
  callback_target TEXT, -- Function name, URL, or workflow ID
  callback_metadata JSONB DEFAULT '{}'::jsonb,  -- Passed through to callback

  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours'),

  -- Audit
  metadata JSONB DEFAULT '{}'::jsonb  -- Additional context
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Primary query pattern: org's pending approvals
CREATE INDEX IF NOT EXISTS idx_hitl_pending_org_status
  ON hitl_pending_approvals(org_id, status, created_at DESC);

-- User's pending approvals
CREATE INDEX IF NOT EXISTS idx_hitl_pending_user_status
  ON hitl_pending_approvals(user_id, status)
  WHERE status = 'pending';

-- Find by resource
CREATE INDEX IF NOT EXISTS idx_hitl_pending_resource
  ON hitl_pending_approvals(resource_type, resource_id);

-- Find by Slack message (for updates)
CREATE INDEX IF NOT EXISTS idx_hitl_pending_slack_message
  ON hitl_pending_approvals(slack_channel_id, slack_message_ts);

-- Expiry cleanup
CREATE INDEX IF NOT EXISTS idx_hitl_pending_expires
  ON hitl_pending_approvals(expires_at)
  WHERE status = 'pending';

-- Dashboard queries
CREATE INDEX IF NOT EXISTS idx_hitl_pending_dashboard
  ON hitl_pending_approvals(org_id, user_id, status, created_at DESC);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE hitl_pending_approvals ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for edge functions)
DROP POLICY IF EXISTS "hitl_approvals_service_role" ON hitl_pending_approvals;
CREATE POLICY "hitl_approvals_service_role" ON hitl_pending_approvals
  FOR ALL
  USING (auth.role() = 'service_role');

-- Users can view their own pending approvals
DROP POLICY IF EXISTS "hitl_approvals_user_select" ON hitl_pending_approvals;
CREATE POLICY "hitl_approvals_user_select" ON hitl_pending_approvals
  FOR SELECT
  USING (user_id = auth.uid());

-- Org members can view org's pending approvals
DROP POLICY IF EXISTS "hitl_approvals_org_select" ON hitl_pending_approvals;
CREATE POLICY "hitl_approvals_org_select" ON hitl_pending_approvals
  FOR SELECT
  USING (
    org_id IN (
      SELECT om.org_id FROM organization_memberships om
      WHERE om.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Triggers
-- ============================================================================

-- Updated_at trigger (reuse existing function if available)
CREATE OR REPLACE FUNCTION update_hitl_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_hitl_pending_approvals_updated_at ON hitl_pending_approvals;
CREATE TRIGGER update_hitl_pending_approvals_updated_at
  BEFORE UPDATE ON hitl_pending_approvals
  FOR EACH ROW EXECUTE FUNCTION update_hitl_updated_at();

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Create a pending approval
CREATE OR REPLACE FUNCTION create_hitl_approval(
  p_org_id UUID,
  p_user_id UUID,
  p_resource_type TEXT,
  p_resource_id TEXT,
  p_resource_name TEXT,
  p_slack_team_id TEXT,
  p_slack_channel_id TEXT,
  p_slack_message_ts TEXT,
  p_original_content JSONB,
  p_callback_type TEXT DEFAULT NULL,
  p_callback_target TEXT DEFAULT NULL,
  p_callback_metadata JSONB DEFAULT '{}'::jsonb,
  p_expires_hours INTEGER DEFAULT 24,
  p_created_by UUID DEFAULT NULL,
  p_slack_thread_ts TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approval_id UUID;
BEGIN
  INSERT INTO hitl_pending_approvals (
    org_id, user_id, created_by, resource_type, resource_id, resource_name,
    slack_team_id, slack_channel_id, slack_message_ts, slack_thread_ts,
    original_content, callback_type, callback_target, callback_metadata,
    expires_at, metadata
  ) VALUES (
    p_org_id, p_user_id, p_created_by, p_resource_type, p_resource_id, p_resource_name,
    p_slack_team_id, p_slack_channel_id, p_slack_message_ts, p_slack_thread_ts,
    p_original_content, p_callback_type, p_callback_target, p_callback_metadata,
    now() + (p_expires_hours || ' hours')::INTERVAL, p_metadata
  )
  RETURNING id INTO v_approval_id;

  RETURN v_approval_id;
END;
$$;

-- Process approval action (approve/reject/edit)
CREATE OR REPLACE FUNCTION process_hitl_action(
  p_approval_id UUID,
  p_action TEXT,  -- 'approved', 'rejected', 'edited', 'cancelled'
  p_actioned_by UUID,
  p_response JSONB DEFAULT NULL,
  p_edited_content JSONB DEFAULT NULL
)
RETURNS hitl_pending_approvals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approval hitl_pending_approvals;
BEGIN
  -- Validate action
  IF p_action NOT IN ('approved', 'rejected', 'edited', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;

  UPDATE hitl_pending_approvals
  SET
    status = p_action,
    actioned_by = p_actioned_by,
    actioned_at = now(),
    response = p_response,
    edited_content = COALESCE(p_edited_content, edited_content)
  WHERE id = p_approval_id
    AND status = 'pending'
  RETURNING * INTO v_approval;

  IF v_approval IS NULL THEN
    -- Check if it exists but is not pending
    SELECT * INTO v_approval FROM hitl_pending_approvals WHERE id = p_approval_id;
    IF v_approval IS NOT NULL THEN
      RAISE EXCEPTION 'Approval is not pending (current status: %)', v_approval.status;
    ELSE
      RAISE EXCEPTION 'Approval not found: %', p_approval_id;
    END IF;
  END IF;

  RETURN v_approval;
END;
$$;

-- Mark expired approvals
CREATE OR REPLACE FUNCTION expire_hitl_approvals()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE hitl_pending_approvals
  SET
    status = 'expired',
    updated_at = now()
  WHERE status = 'pending'
    AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Get pending approvals for a user
CREATE OR REPLACE FUNCTION get_user_pending_approvals(
  p_user_id UUID,
  p_org_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS SETOF hitl_pending_approvals
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM hitl_pending_approvals
  WHERE user_id = p_user_id
    AND status = 'pending'
    AND expires_at > now()
    AND (p_org_id IS NULL OR org_id = p_org_id)
  ORDER BY created_at DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION create_hitl_approval TO service_role;
GRANT EXECUTE ON FUNCTION create_hitl_approval TO authenticated;
GRANT EXECUTE ON FUNCTION process_hitl_action TO service_role;
GRANT EXECUTE ON FUNCTION expire_hitl_approvals TO service_role;
GRANT EXECUTE ON FUNCTION get_user_pending_approvals TO service_role;
GRANT EXECUTE ON FUNCTION get_user_pending_approvals TO authenticated;

-- ============================================================================
-- Enable Realtime (optional - for live updates in dashboard)
-- ============================================================================

-- Uncomment if you want realtime subscriptions:
-- ALTER PUBLICATION supabase_realtime ADD TABLE hitl_pending_approvals;

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'HITL pending approvals table created successfully';
  RAISE NOTICE 'Functions: create_hitl_approval, process_hitl_action, expire_hitl_approvals, get_user_pending_approvals';
END;
$$;
