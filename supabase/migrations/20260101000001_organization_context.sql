-- Migration: Organization Context Schema for Agent-Executable Skills Platform
-- Phase 1, Stage 1.2: Create organization context key-value storage
-- Date: 2026-01-01

-- =============================================================================
-- Table: organization_context
-- Key-value pairs for organization-specific context variables
-- Used to interpolate into platform skill templates
-- =============================================================================

CREATE TABLE IF NOT EXISTS organization_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Context Data
  context_key TEXT NOT NULL,  -- 'company_name', 'industry', 'products', etc.
  value JSONB NOT NULL,       -- String, array, or object value
  value_type TEXT NOT NULL CHECK (value_type IN ('string', 'array', 'object')),

  -- Source Tracking
  source TEXT NOT NULL CHECK (source IN ('scrape', 'manual', 'user', 'enrichment', 'migration')),
  confidence DECIMAL(3,2) DEFAULT 1.00 CHECK (confidence >= 0 AND confidence <= 1),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure unique keys per organization
  UNIQUE(organization_id, context_key)
);

-- Add comments for documentation
COMMENT ON TABLE organization_context IS 'Key-value storage for organization context variables used in skill template interpolation';
COMMENT ON COLUMN organization_context.context_key IS 'Variable name: company_name, industry, products, competitors, etc.';
COMMENT ON COLUMN organization_context.value IS 'JSONB value - can be string, array of strings, or object';
COMMENT ON COLUMN organization_context.value_type IS 'Type hint: string, array, or object';
COMMENT ON COLUMN organization_context.source IS 'How this value was obtained: scrape (website), manual (admin), user (org member), enrichment (AI), migration (from existing data)';
COMMENT ON COLUMN organization_context.confidence IS 'Confidence score 0.00-1.00 for AI-extracted values';

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_org_context_lookup ON organization_context(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_context_key ON organization_context(context_key);
CREATE INDEX IF NOT EXISTS idx_org_context_source ON organization_context(source);

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

-- Platform admins can view all context
CREATE POLICY "Platform admins can view all context"
  ON organization_context FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Org owners/admins can insert context
CREATE POLICY "Org admins can insert context"
  ON organization_context FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT org_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Org owners/admins can update context
CREATE POLICY "Org admins can update context"
  ON organization_context FOR UPDATE
  USING (
    organization_id IN (
      SELECT org_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Org owners/admins can delete context
CREATE POLICY "Org admins can delete context"
  ON organization_context FOR DELETE
  USING (
    organization_id IN (
      SELECT org_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- =============================================================================
-- Trigger: Auto-update updated_at timestamp
-- =============================================================================

DROP TRIGGER IF EXISTS update_org_context_updated_at ON organization_context;
CREATE TRIGGER update_org_context_updated_at
  BEFORE UPDATE ON organization_context
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Helper Function: Get all context for an organization as a flat object
-- Used by skill compilation
-- =============================================================================

CREATE OR REPLACE FUNCTION get_organization_context_object(p_org_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB := '{}';
  ctx RECORD;
BEGIN
  FOR ctx IN
    SELECT context_key, value
    FROM organization_context
    WHERE organization_id = p_org_id
  LOOP
    result := result || jsonb_build_object(ctx.context_key, ctx.value);
  END LOOP;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_organization_context_object IS 'Returns all organization context as a flat JSONB object for skill template interpolation';

-- =============================================================================
-- Helper Function: Upsert context value
-- Handles type inference and source tracking
-- =============================================================================

CREATE OR REPLACE FUNCTION upsert_organization_context(
  p_org_id UUID,
  p_key TEXT,
  p_value JSONB,
  p_source TEXT DEFAULT 'manual',
  p_confidence DECIMAL DEFAULT 1.00
)
RETURNS UUID AS $$
DECLARE
  v_value_type TEXT;
  v_result_id UUID;
BEGIN
  -- Infer value type from JSONB
  v_value_type := CASE
    WHEN jsonb_typeof(p_value) = 'array' THEN 'array'
    WHEN jsonb_typeof(p_value) = 'object' THEN 'object'
    ELSE 'string'
  END;

  INSERT INTO organization_context (
    organization_id,
    context_key,
    value,
    value_type,
    source,
    confidence
  ) VALUES (
    p_org_id,
    p_key,
    p_value,
    v_value_type,
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

COMMENT ON FUNCTION upsert_organization_context IS 'Insert or update a context value with automatic type inference';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_organization_context_object TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_organization_context TO authenticated;
