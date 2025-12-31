-- Migration: Organization Context Schema
-- Purpose: Key-value context storage for organization-specific variables
-- Phase 1, Stage 1.2 of Agent-Executable Skills Platform
-- Date: 2025-01-01

-- =============================================================================
-- Table: organization_context
-- Stores key-value context variables for each organization
-- Used to interpolate platform skill templates into org-specific skills
-- =============================================================================

CREATE TABLE IF NOT EXISTS organization_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Context Data
  context_key TEXT NOT NULL,  -- e.g., 'company_name', 'industry', 'products'
  value JSONB NOT NULL,       -- Can be string, array, or object
  value_type TEXT NOT NULL CHECK (value_type IN ('string', 'array', 'object')),

  -- Source Tracking
  source TEXT NOT NULL CHECK (source IN ('scrape', 'manual', 'user', 'enrichment')),
  confidence DECIMAL(3,2) DEFAULT 1.00 CHECK (confidence >= 0 AND confidence <= 1),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure unique context keys per organization
  UNIQUE(organization_id, context_key)
);

-- =============================================================================
-- Indexes for Performance
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_org_context_org_id ON organization_context(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_context_key ON organization_context(context_key);
CREATE INDEX IF NOT EXISTS idx_org_context_lookup ON organization_context(organization_id, context_key);

-- =============================================================================
-- RLS Policies for organization_context
-- =============================================================================

ALTER TABLE organization_context ENABLE ROW LEVEL SECURITY;

-- Org members can view their organization's context
CREATE POLICY "Org members can view context"
  ON organization_context FOR SELECT
  USING (
    organization_id IN (
      SELECT org_id FROM organization_memberships WHERE user_id = auth.uid()
    )
  );

-- Org admins can insert context
CREATE POLICY "Org admins can insert context"
  ON organization_context FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT org_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Org admins can update context
CREATE POLICY "Org admins can update context"
  ON organization_context FOR UPDATE
  USING (
    organization_id IN (
      SELECT org_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Org admins can delete context
CREATE POLICY "Org admins can delete context"
  ON organization_context FOR DELETE
  USING (
    organization_id IN (
      SELECT org_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Service role can manage all context (for edge functions)
CREATE POLICY "Service role can manage context"
  ON organization_context FOR ALL
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- Trigger: Auto-update updated_at timestamp
-- =============================================================================

-- Use existing update_updated_at_column function
DROP TRIGGER IF EXISTS update_org_context_updated_at ON organization_context;
CREATE TRIGGER update_org_context_updated_at
  BEFORE UPDATE ON organization_context
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Function: Get all context for an organization
-- Returns context as key-value pairs for easy interpolation
-- =============================================================================

CREATE OR REPLACE FUNCTION get_organization_context(p_org_id UUID)
RETURNS TABLE (
  context_key TEXT,
  value JSONB,
  value_type TEXT,
  source TEXT,
  confidence DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    oc.context_key,
    oc.value,
    oc.value_type,
    oc.source,
    oc.confidence
  FROM organization_context oc
  WHERE oc.organization_id = p_org_id
  ORDER BY oc.context_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_organization_context TO authenticated;

-- =============================================================================
-- Function: Upsert organization context
-- Helper function to insert or update context values
-- =============================================================================

CREATE OR REPLACE FUNCTION upsert_organization_context(
  p_org_id UUID,
  p_context_key TEXT,
  p_value JSONB,
  p_value_type TEXT,
  p_source TEXT,
  p_confidence DECIMAL DEFAULT 1.00
)
RETURNS UUID AS $$
DECLARE
  v_result_id UUID;
BEGIN
  INSERT INTO organization_context (
    organization_id,
    context_key,
    value,
    value_type,
    source,
    confidence
  )
  VALUES (
    p_org_id,
    p_context_key,
    p_value,
    p_value_type,
    p_source,
    p_confidence
  )
  ON CONFLICT (organization_id, context_key)
  DO UPDATE SET
    value = EXCLUDED.value,
    value_type = EXCLUDED.value_type,
    source = EXCLUDED.source,
    confidence = EXCLUDED.confidence,
    updated_at = now()
  RETURNING id INTO v_result_id;

  RETURN v_result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION upsert_organization_context TO authenticated;

-- =============================================================================
-- Comments for Documentation
-- =============================================================================

COMMENT ON TABLE organization_context IS 'Stores organization-specific context variables used to compile platform skill templates';
COMMENT ON COLUMN organization_context.context_key IS 'Variable name (e.g., company_name, industry, products)';
COMMENT ON COLUMN organization_context.value IS 'JSONB value that can be string, array, or object';
COMMENT ON COLUMN organization_context.value_type IS 'Type of value for validation and type safety';
COMMENT ON COLUMN organization_context.source IS 'How this context was obtained (scrape, manual, user, enrichment)';
COMMENT ON COLUMN organization_context.confidence IS 'Confidence score from 0.00 to 1.00 for enrichment quality';
