-- Migration: Organization Enrichment and Skills for Onboarding V2
-- Purpose: Deep company intelligence and AI-generated skill configurations
-- Date: 2025-12-31

-- =============================================================================
-- Table 1: organization_enrichment
-- Stores scraped and AI-analyzed company data from multiple sources
-- =============================================================================

CREATE TABLE IF NOT EXISTS organization_enrichment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,

  -- Core company info
  company_name TEXT,
  logo_url TEXT,
  tagline TEXT,
  description TEXT,
  industry TEXT,
  employee_count TEXT,
  funding_stage TEXT,
  founded_year INT,
  headquarters TEXT,

  -- Products & Services
  products JSONB DEFAULT '[]', -- [{name, description, pricing_tier}]
  value_propositions JSONB DEFAULT '[]',
  use_cases JSONB DEFAULT '[]',

  -- Market Intelligence
  competitors JSONB DEFAULT '[]', -- [{name, domain, comparison}]
  target_market TEXT,
  ideal_customer_profile JSONB DEFAULT '{}',

  -- Team Intelligence
  key_people JSONB DEFAULT '[]', -- [{name, title, linkedin_url}]
  recent_hires JSONB DEFAULT '[]',
  open_roles JSONB DEFAULT '[]',
  tech_stack JSONB DEFAULT '[]',

  -- Social Proof
  customer_logos JSONB DEFAULT '[]',
  case_studies JSONB DEFAULT '[]',
  reviews_summary JSONB DEFAULT '{}',

  -- Pain Points & Opportunities
  pain_points JSONB DEFAULT '[]',
  buying_signals JSONB DEFAULT '[]',
  recent_news JSONB DEFAULT '[]',

  -- Meta
  sources_used JSONB DEFAULT '[]', -- ['website', 'linkedin', 'g2', 'crunchbase']
  confidence_score DECIMAL(3,2), -- 0.00 to 1.00
  model TEXT DEFAULT 'gemini-2.0-flash',
  raw_scraped_data JSONB DEFAULT '{}', -- Raw data from Prompt 1
  generated_skills JSONB DEFAULT '{}', -- Generated skills from Prompt 2
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'scraping', 'analyzing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(organization_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_org_enrichment_org_id ON organization_enrichment(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_enrichment_domain ON organization_enrichment(domain);
CREATE INDEX IF NOT EXISTS idx_org_enrichment_status ON organization_enrichment(status);

-- =============================================================================
-- Table 2: organization_skills
-- Stores AI-generated and user-modified skill configurations
-- =============================================================================

CREATE TABLE IF NOT EXISTS organization_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL, -- 'lead_qualification', 'lead_enrichment', 'brand_voice', 'objection_handling', 'icp'
  skill_name TEXT NOT NULL, -- Display name
  config JSONB NOT NULL DEFAULT '{}', -- Skill-specific configuration
  ai_generated BOOLEAN DEFAULT true, -- Was this created by AI?
  user_modified BOOLEAN DEFAULT false, -- Has user edited this?
  version INT NOT NULL DEFAULT 1, -- For version history
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  UNIQUE(organization_id, skill_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_org_skills_org_id ON organization_skills(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_skills_skill_id ON organization_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_org_skills_active ON organization_skills(is_active) WHERE is_active = true;

-- =============================================================================
-- Table 3: organization_skills_history
-- Version history for skill configurations (for rollback capability)
-- =============================================================================

CREATE TABLE IF NOT EXISTS organization_skills_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_record_id UUID REFERENCES organization_skills(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  config JSONB NOT NULL,
  version INT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_skills_history_skill ON organization_skills_history(skill_record_id);

-- =============================================================================
-- Add onboarding_version to organizations table
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'onboarding_version'
  ) THEN
    ALTER TABLE organizations ADD COLUMN onboarding_version TEXT DEFAULT 'v1';
  END IF;
END $$;

-- =============================================================================
-- Add feature flag for live onboarding version (global setting)
-- =============================================================================

-- Create app_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default onboarding version setting
INSERT INTO app_settings (key, value, description)
VALUES ('live_onboarding_version', '"v1"', 'Which onboarding version is shown to new signups (v1 or v2)')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- RLS Policies for organization_enrichment
-- =============================================================================

ALTER TABLE organization_enrichment ENABLE ROW LEVEL SECURITY;

-- Users can view enrichment for their own org
CREATE POLICY "Users can view own org enrichment"
  ON organization_enrichment FOR SELECT
  USING (
    organization_id IN (
      SELECT org_id FROM organization_memberships WHERE user_id = auth.uid()
    )
  );

-- Only org owners/admins can update enrichment
CREATE POLICY "Admins can update org enrichment"
  ON organization_enrichment FOR UPDATE
  USING (
    organization_id IN (
      SELECT org_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Service role can insert (for edge functions)
CREATE POLICY "Service role can insert enrichment"
  ON organization_enrichment FOR INSERT
  WITH CHECK (true);

-- =============================================================================
-- RLS Policies for organization_skills
-- =============================================================================

ALTER TABLE organization_skills ENABLE ROW LEVEL SECURITY;

-- Users can view skills for their own org
CREATE POLICY "Users can view own org skills"
  ON organization_skills FOR SELECT
  USING (
    organization_id IN (
      SELECT org_id FROM organization_memberships WHERE user_id = auth.uid()
    )
  );

-- Org members can insert skills
CREATE POLICY "Members can insert org skills"
  ON organization_skills FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT org_id FROM organization_memberships WHERE user_id = auth.uid()
    )
  );

-- Org members can update skills
CREATE POLICY "Members can update org skills"
  ON organization_skills FOR UPDATE
  USING (
    organization_id IN (
      SELECT org_id FROM organization_memberships WHERE user_id = auth.uid()
    )
  );

-- =============================================================================
-- RLS Policies for organization_skills_history
-- =============================================================================

ALTER TABLE organization_skills_history ENABLE ROW LEVEL SECURITY;

-- Users can view history for their own org
CREATE POLICY "Users can view own org skills history"
  ON organization_skills_history FOR SELECT
  USING (
    organization_id IN (
      SELECT org_id FROM organization_memberships WHERE user_id = auth.uid()
    )
  );

-- Service role can insert history
CREATE POLICY "Service role can insert skills history"
  ON organization_skills_history FOR INSERT
  WITH CHECK (true);

-- =============================================================================
-- RLS Policies for app_settings
-- =============================================================================

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read app settings
CREATE POLICY "Anyone can read app settings"
  ON app_settings FOR SELECT
  USING (true);

-- Only admins can update (will be checked in edge function)
CREATE POLICY "Service role can update app settings"
  ON app_settings FOR UPDATE
  USING (true);

-- =============================================================================
-- Trigger: Auto-update updated_at timestamp
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to organization_enrichment
DROP TRIGGER IF EXISTS update_org_enrichment_updated_at ON organization_enrichment;
CREATE TRIGGER update_org_enrichment_updated_at
  BEFORE UPDATE ON organization_enrichment
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to organization_skills
DROP TRIGGER IF EXISTS update_org_skills_updated_at ON organization_skills;
CREATE TRIGGER update_org_skills_updated_at
  BEFORE UPDATE ON organization_skills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Function: Save skill with version history
-- =============================================================================

CREATE OR REPLACE FUNCTION save_organization_skill(
  p_org_id UUID,
  p_skill_id TEXT,
  p_skill_name TEXT,
  p_config JSONB,
  p_user_id UUID,
  p_ai_generated BOOLEAN DEFAULT false,
  p_change_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_existing_id UUID;
  v_current_version INT;
  v_new_version INT;
  v_result_id UUID;
BEGIN
  -- Check if skill already exists
  SELECT id, version INTO v_existing_id, v_current_version
  FROM organization_skills
  WHERE organization_id = p_org_id AND skill_id = p_skill_id;

  IF v_existing_id IS NOT NULL THEN
    -- Save current version to history
    INSERT INTO organization_skills_history (
      skill_record_id, organization_id, skill_id, config, version, changed_by, change_reason
    )
    SELECT id, organization_id, skill_id, config, version, p_user_id, p_change_reason
    FROM organization_skills
    WHERE id = v_existing_id;

    -- Update existing skill
    v_new_version := v_current_version + 1;
    UPDATE organization_skills
    SET
      config = p_config,
      user_modified = NOT p_ai_generated,
      version = v_new_version,
      updated_at = now()
    WHERE id = v_existing_id;

    v_result_id := v_existing_id;
  ELSE
    -- Insert new skill
    INSERT INTO organization_skills (
      organization_id, skill_id, skill_name, config, ai_generated, created_by
    )
    VALUES (p_org_id, p_skill_id, p_skill_name, p_config, p_ai_generated, p_user_id)
    RETURNING id INTO v_result_id;
  END IF;

  RETURN v_result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION save_organization_skill TO authenticated;
