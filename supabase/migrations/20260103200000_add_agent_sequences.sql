-- Migration: Add Agent Sequences support
-- Purpose: Add 'agent-sequence' category and execution tracking table
-- Date: 2026-01-03

-- =============================================================================
-- Step 1: Expand platform_skills category constraint
-- =============================================================================

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Find the existing CHECK constraint on platform_skills.category
  SELECT c.conname
  INTO v_constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE t.relname = 'platform_skills'
    AND n.nspname = 'public'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%category%'
    AND pg_get_constraintdef(c.oid) ILIKE '%IN%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.platform_skills DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  -- Recreate constraint with agent-sequence category
  ALTER TABLE public.platform_skills
    ADD CONSTRAINT platform_skills_category_check
    CHECK (
      category IN (
        'sales-ai',
        'writing',
        'enrichment',
        'workflows',
        'data-access',
        'output-format',
        'agent-sequence'
      )
    );
END $$;

-- =============================================================================
-- Step 2: Create sequence_executions table
-- Tracks both simulations and live executions of agent sequences
-- =============================================================================

CREATE TABLE IF NOT EXISTS sequence_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to the sequence skill
  sequence_key TEXT NOT NULL,

  -- Organization and user context
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Execution status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),

  -- Input and output data
  input_context JSONB NOT NULL DEFAULT '{}',
  step_results JSONB NOT NULL DEFAULT '[]',
  final_output JSONB,

  -- Error handling
  error_message TEXT,
  failed_step_index INT,

  -- Simulation vs live execution
  is_simulation BOOLEAN NOT NULL DEFAULT false,
  mock_data_used JSONB,

  -- Timing
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- Step 3: Create indexes for sequence_executions
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_sequence_executions_sequence_key
  ON sequence_executions(sequence_key);

CREATE INDEX IF NOT EXISTS idx_sequence_executions_org
  ON sequence_executions(organization_id);

CREATE INDEX IF NOT EXISTS idx_sequence_executions_user
  ON sequence_executions(user_id);

CREATE INDEX IF NOT EXISTS idx_sequence_executions_status
  ON sequence_executions(status);

CREATE INDEX IF NOT EXISTS idx_sequence_executions_simulation
  ON sequence_executions(is_simulation);

CREATE INDEX IF NOT EXISTS idx_sequence_executions_created
  ON sequence_executions(created_at DESC);

-- =============================================================================
-- Step 4: Enable RLS on sequence_executions
-- =============================================================================

ALTER TABLE sequence_executions ENABLE ROW LEVEL SECURITY;

-- Users can read their own executions and org executions
CREATE POLICY "Users can read their organization's sequence executions"
  ON sequence_executions FOR SELECT
  USING (
    organization_id IN (
      SELECT org_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Users can create executions in their organization
CREATE POLICY "Users can create sequence executions in their organization"
  ON sequence_executions FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT org_id FROM organization_memberships
      WHERE user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- Users can update their own executions
CREATE POLICY "Users can update their own sequence executions"
  ON sequence_executions FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own executions
CREATE POLICY "Users can delete their own sequence executions"
  ON sequence_executions FOR DELETE
  USING (user_id = auth.uid());

-- =============================================================================
-- Step 5: Add updated_at trigger
-- =============================================================================

DROP TRIGGER IF EXISTS update_sequence_executions_updated_at ON sequence_executions;
CREATE TRIGGER update_sequence_executions_updated_at
  BEFORE UPDATE ON sequence_executions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Step 6: Create helper function to get sequence executions
-- =============================================================================

CREATE OR REPLACE FUNCTION get_sequence_executions(
  p_sequence_key TEXT DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL,
  p_is_simulation BOOLEAN DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  sequence_key TEXT,
  organization_id UUID,
  user_id UUID,
  status TEXT,
  input_context JSONB,
  step_results JSONB,
  final_output JSONB,
  error_message TEXT,
  failed_step_index INT,
  is_simulation BOOLEAN,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    se.id,
    se.sequence_key,
    se.organization_id,
    se.user_id,
    se.status,
    se.input_context,
    se.step_results,
    se.final_output,
    se.error_message,
    se.failed_step_index,
    se.is_simulation,
    se.started_at,
    se.completed_at,
    CASE
      WHEN se.completed_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (se.completed_at - se.started_at)) * 1000
      ELSE NULL
    END::BIGINT AS duration_ms
  FROM sequence_executions se
  WHERE
    (p_sequence_key IS NULL OR se.sequence_key = p_sequence_key)
    AND (p_organization_id IS NULL OR se.organization_id = p_organization_id)
    AND (p_is_simulation IS NULL OR se.is_simulation = p_is_simulation)
    AND (p_status IS NULL OR se.status = p_status)
  ORDER BY se.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_sequence_executions TO authenticated;
