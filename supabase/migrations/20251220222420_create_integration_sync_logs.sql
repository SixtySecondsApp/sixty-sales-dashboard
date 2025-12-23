-- Integration Sync Logs Table
-- Stores item-by-item sync activity for all integrations
-- Enables live logging in the Integrations Dashboard

-- Create the main logs table
CREATE TABLE IF NOT EXISTS integration_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Integration identification
  integration_name TEXT NOT NULL CHECK (integration_name IN (
    'hubspot', 'fathom', 'google_calendar', 'google_tasks', 'savvycal', 'slack'
  )),

  -- Operation details
  operation TEXT NOT NULL CHECK (operation IN (
    'sync', 'create', 'update', 'delete', 'push', 'pull', 'webhook', 'error'
  )),
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),

  -- Entity details (item-by-item logging)
  entity_type TEXT NOT NULL, -- 'contact', 'deal', 'task', 'meeting', 'event', 'note', etc.
  entity_id TEXT,            -- UUID or external ID
  entity_name TEXT,          -- Human-readable: "John Doe (john@example.com)", "Acme Corp $50k"

  -- Status
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN (
    'pending', 'success', 'failed', 'skipped'
  )),

  -- Error handling
  error_message TEXT,

  -- Additional context
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Batch tracking (groups related operations from the same sync run)
  batch_id UUID
);

-- Add comment
COMMENT ON TABLE integration_sync_logs IS 'Item-by-item sync activity logs for all integrations with real-time support';
COMMENT ON COLUMN integration_sync_logs.entity_name IS 'Human-readable description, e.g. "John Doe (john@example.com)"';
COMMENT ON COLUMN integration_sync_logs.batch_id IS 'Groups operations from the same sync run';

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_org_created
  ON integration_sync_logs(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_integration
  ON integration_sync_logs(integration_name);

CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_status
  ON integration_sync_logs(status);

CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_created_at
  ON integration_sync_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_batch_id
  ON integration_sync_logs(batch_id) WHERE batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_entity_type
  ON integration_sync_logs(entity_type);

-- Composite index for dashboard queries (org + integration + time)
CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_dashboard
  ON integration_sync_logs(org_id, integration_name, created_at DESC);

-- Enable Row Level Security
ALTER TABLE integration_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "integration_sync_logs_service_role" ON integration_sync_logs;
DROP POLICY IF EXISTS "integration_sync_logs_admin_select" ON integration_sync_logs;
DROP POLICY IF EXISTS "integration_sync_logs_org_select" ON integration_sync_logs;
DROP POLICY IF EXISTS "integration_sync_logs_user_select" ON integration_sync_logs;

-- Service role can do everything (for edge functions)
CREATE POLICY "integration_sync_logs_service_role" ON integration_sync_logs
  FOR ALL
  USING (auth.role() = 'service_role');

-- Platform admins can view all logs
CREATE POLICY "integration_sync_logs_admin_select" ON integration_sync_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.is_admin = true
    )
  );

-- Org members can view their org's logs
CREATE POLICY "integration_sync_logs_org_select" ON integration_sync_logs
  FOR SELECT
  USING (
    org_id IN (
      SELECT om.org_id FROM organization_memberships om
      WHERE om.user_id = auth.uid()
    )
  );

-- Users can view their own logs (for user-level integrations like Google)
CREATE POLICY "integration_sync_logs_user_select" ON integration_sync_logs
  FOR SELECT
  USING (user_id = auth.uid());

-- Enable Supabase Realtime for live log streaming
ALTER PUBLICATION supabase_realtime ADD TABLE integration_sync_logs;

-- Helper function for standardized logging from edge functions
CREATE OR REPLACE FUNCTION log_integration_sync(
  p_org_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_integration_name TEXT DEFAULT NULL,
  p_operation TEXT DEFAULT 'sync',
  p_direction TEXT DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id TEXT DEFAULT NULL,
  p_entity_name TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'success',
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_batch_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO integration_sync_logs (
    org_id,
    user_id,
    integration_name,
    operation,
    direction,
    entity_type,
    entity_id,
    entity_name,
    status,
    error_message,
    metadata,
    batch_id
  ) VALUES (
    p_org_id,
    p_user_id,
    p_integration_name,
    p_operation,
    p_direction,
    p_entity_type,
    p_entity_id,
    p_entity_name,
    p_status,
    p_error_message,
    p_metadata,
    p_batch_id
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Grant execute to service role and authenticated users
GRANT EXECUTE ON FUNCTION log_integration_sync TO service_role;
GRANT EXECUTE ON FUNCTION log_integration_sync TO authenticated;

COMMENT ON FUNCTION log_integration_sync IS 'Standardized helper for logging integration sync operations from edge functions';
