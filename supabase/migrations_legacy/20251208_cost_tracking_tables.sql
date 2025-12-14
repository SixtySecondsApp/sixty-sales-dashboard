-- Cost Tracking Tables Migration
-- Creates tables for tracking AI costs by model and organization

-- ============================================================================
-- Cost Rates Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS cost_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'gemini', 'supabase')),
  model TEXT NOT NULL,
  input_cost_per_million DECIMAL(10, 4) NOT NULL,
  output_cost_per_million DECIMAL(10, 4) NOT NULL,
  effective_from TIMESTAMPTZ DEFAULT NOW(),
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, model, effective_from)
);

-- Index for active rates lookup
CREATE INDEX IF NOT EXISTS idx_cost_rates_active ON cost_rates(provider, model) WHERE effective_to IS NULL;

-- Seed with current rates (Dec 2024 pricing in GBP)
-- USD to GBP conversion rate: ~0.79 (as of Dec 2024)
-- Rates are stored in GBP (£) per million tokens
INSERT INTO cost_rates (provider, model, input_cost_per_million, output_cost_per_million) VALUES
  ('anthropic', 'claude-haiku-4-5', 0.20, 0.99),  -- $0.25/$1.25 → £0.20/£0.99
  ('anthropic', 'claude-sonnet-4', 2.37, 11.85),  -- $3.00/$15.00 → £2.37/£11.85
  ('anthropic', 'claude-3-5-sonnet', 2.37, 11.85),  -- $3.00/$15.00 → £2.37/£11.85
  ('gemini', 'gemini-2.5-flash', 0.059, 0.237)  -- $0.075/$0.30 → £0.059/£0.237
ON CONFLICT DO NOTHING;

-- ============================================================================
-- AI Cost Events Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_cost_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'gemini')),
  model TEXT NOT NULL,
  feature TEXT, -- 'transcript_analysis', 'copilot', 'proposal', 'meeting_search', etc.
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  estimated_cost DECIMAL(10, 6) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_ai_cost_events_org_id ON ai_cost_events(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_cost_events_created_at ON ai_cost_events(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_cost_events_provider_model ON ai_cost_events(provider, model);
CREATE INDEX IF NOT EXISTS idx_ai_cost_events_feature ON ai_cost_events(feature) WHERE feature IS NOT NULL;

-- Composite index for org + date range queries
CREATE INDEX IF NOT EXISTS idx_ai_cost_events_org_date ON ai_cost_events(org_id, created_at);

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE cost_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cost_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Cost rates are readable by authenticated users" ON cost_rates;
DROP POLICY IF EXISTS "Cost rates are writable by platform admins" ON cost_rates;
DROP POLICY IF EXISTS "Users can view their organization's cost events" ON ai_cost_events;
DROP POLICY IF EXISTS "Platform admins can view all cost events" ON ai_cost_events;
DROP POLICY IF EXISTS "Service role can insert cost events" ON ai_cost_events;

-- Cost rates: Platform admins can read/write, others read-only
CREATE POLICY "Cost rates are readable by authenticated users"
  ON cost_rates FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Cost rates are writable by platform admins"
  ON cost_rates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- AI cost events: Users can only see their own org's events
CREATE POLICY "Users can view their organization's cost events"
  ON ai_cost_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = ai_cost_events.org_id
      AND organization_memberships.user_id = auth.uid()
    )
  );

-- Platform admins can view all cost events
CREATE POLICY "Platform admins can view all cost events"
  ON ai_cost_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Service role can insert cost events (for edge functions)
CREATE POLICY "Service role can insert cost events"
  ON ai_cost_events FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to get current cost rate for a model
CREATE OR REPLACE FUNCTION get_current_cost_rate(
  p_provider TEXT,
  p_model TEXT
) RETURNS TABLE (
  input_cost_per_million DECIMAL(10, 4),
  output_cost_per_million DECIMAL(10, 4)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cr.input_cost_per_million,
    cr.output_cost_per_million
  FROM cost_rates cr
  WHERE cr.provider = p_provider
    AND cr.model = p_model
    AND cr.effective_to IS NULL
  ORDER BY cr.effective_from DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate cost from tokens
CREATE OR REPLACE FUNCTION calculate_token_cost(
  p_provider TEXT,
  p_model TEXT,
  p_input_tokens INTEGER,
  p_output_tokens INTEGER
) RETURNS DECIMAL(10, 6) AS $$
DECLARE
  v_input_cost DECIMAL(10, 4);
  v_output_cost DECIMAL(10, 4);
  v_total_cost DECIMAL(10, 6);
BEGIN
  SELECT input_cost_per_million, output_cost_per_million
  INTO v_input_cost, v_output_cost
  FROM get_current_cost_rate(p_provider, p_model);

  IF v_input_cost IS NULL OR v_output_cost IS NULL THEN
    RETURN 0;
  END IF;

  v_total_cost := (p_input_tokens::DECIMAL / 1000000) * v_input_cost +
                  (p_output_tokens::DECIMAL / 1000000) * v_output_cost;

  RETURN v_total_cost;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE cost_rates IS 'Configurable cost rates per AI model/provider';
COMMENT ON TABLE ai_cost_events IS 'Log of all AI API calls with token usage and estimated costs';
COMMENT ON COLUMN ai_cost_events.feature IS 'Feature/use case that triggered this API call (e.g., transcript_analysis, copilot)';
COMMENT ON COLUMN ai_cost_events.metadata IS 'Additional context about the API call (workflow_id, meeting_id, etc.)';

