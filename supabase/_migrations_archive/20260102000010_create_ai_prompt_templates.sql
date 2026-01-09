-- ============================================================================
-- AI Prompt Templates Table
-- ============================================================================
-- Stores customizable AI prompts for various features in the platform.
-- Supports user-specific overrides and organization-wide templates.
--
-- Works with: supabase/functions/_shared/promptLoader.ts
-- ============================================================================

-- Create the ai_prompt_templates table
CREATE TABLE IF NOT EXISTS ai_prompt_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Ownership
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Template identification
  category TEXT NOT NULL,  -- Feature key (e.g., 'email_analysis', 'transcript_analysis')
  name TEXT NOT NULL,      -- Human-readable name
  description TEXT,        -- Description of what this prompt does

  -- Prompt content
  system_prompt TEXT,      -- System prompt for the AI
  user_prompt TEXT,        -- User prompt template with ${variable} placeholders

  -- Model configuration
  model TEXT DEFAULT 'claude-haiku-4-5-20251001',
  temperature NUMERIC(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 2048,

  -- Metadata
  is_public BOOLEAN DEFAULT FALSE,  -- If true, available to all users in org
  is_default BOOLEAN DEFAULT FALSE, -- If true, this is the org default (overrides system)
  version INTEGER DEFAULT 1,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT valid_temperature CHECK (temperature >= 0 AND temperature <= 2),
  CONSTRAINT valid_max_tokens CHECK (max_tokens > 0 AND max_tokens <= 128000),
  CONSTRAINT has_content CHECK (system_prompt IS NOT NULL OR user_prompt IS NOT NULL)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_category
  ON ai_prompt_templates(category);

CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_org_category
  ON ai_prompt_templates(organization_id, category);

CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_user_category
  ON ai_prompt_templates(user_id, category);

CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_public_category
  ON ai_prompt_templates(is_public, category)
  WHERE is_public = TRUE;

-- Enable RLS
ALTER TABLE ai_prompt_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view their own templates
CREATE POLICY "Users can view own templates"
  ON ai_prompt_templates FOR SELECT
  USING (auth.uid() = user_id);

-- Users can view public templates in their org
CREATE POLICY "Users can view org public templates"
  ON ai_prompt_templates FOR SELECT
  USING (
    is_public = TRUE
    AND organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Users can view system-wide public templates (no org)
CREATE POLICY "Users can view system templates"
  ON ai_prompt_templates FOR SELECT
  USING (is_public = TRUE AND organization_id IS NULL AND user_id IS NULL);

-- Users can create their own templates
CREATE POLICY "Users can create own templates"
  ON ai_prompt_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.uid() = created_by);

-- Users can update their own templates
CREATE POLICY "Users can update own templates"
  ON ai_prompt_templates FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own templates
CREATE POLICY "Users can delete own templates"
  ON ai_prompt_templates FOR DELETE
  USING (auth.uid() = user_id);

-- Org admins can manage org templates
CREATE POLICY "Org admins can manage org templates"
  ON ai_prompt_templates FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- Platform admins can manage all templates
CREATE POLICY "Platform admins can manage all templates"
  ON ai_prompt_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND is_platform_admin = TRUE
    )
  );

-- Create updated_at trigger
CREATE TRIGGER set_ai_prompt_templates_updated_at
  BEFORE UPDATE ON ai_prompt_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Prompt Template History (for version tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_prompt_template_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID REFERENCES ai_prompt_templates(id) ON DELETE CASCADE,

  -- Snapshot of the template at this version
  system_prompt TEXT,
  user_prompt TEXT,
  model TEXT,
  temperature NUMERIC(3,2),
  max_tokens INTEGER,
  version INTEGER NOT NULL,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  change_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_prompt_template_history_template
  ON ai_prompt_template_history(template_id, version DESC);

-- Enable RLS for history
ALTER TABLE ai_prompt_template_history ENABLE ROW LEVEL SECURITY;

-- History follows same access as parent template
CREATE POLICY "Users can view history of accessible templates"
  ON ai_prompt_template_history FOR SELECT
  USING (
    template_id IN (
      SELECT id FROM ai_prompt_templates
    )
  );

-- ============================================================================
-- Functions
-- ============================================================================

-- Function to save a prompt template (upsert)
CREATE OR REPLACE FUNCTION save_prompt_template(
  p_category TEXT,
  p_name TEXT,
  p_system_prompt TEXT,
  p_user_prompt TEXT,
  p_model TEXT DEFAULT 'claude-haiku-4-5-20251001',
  p_temperature NUMERIC DEFAULT 0.7,
  p_max_tokens INTEGER DEFAULT 2048,
  p_description TEXT DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL,
  p_is_public BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_template_id UUID;
  v_current_version INTEGER;
BEGIN
  -- Check for existing template
  SELECT id, version INTO v_template_id, v_current_version
  FROM ai_prompt_templates
  WHERE category = p_category
    AND (
      (user_id = v_user_id AND p_organization_id IS NULL)
      OR (organization_id = p_organization_id AND is_public = p_is_public)
    )
  LIMIT 1;

  IF v_template_id IS NOT NULL THEN
    -- Archive current version
    INSERT INTO ai_prompt_template_history (
      template_id, system_prompt, user_prompt, model,
      temperature, max_tokens, version, created_by
    )
    SELECT
      id, system_prompt, user_prompt, model,
      temperature, max_tokens, version, v_user_id
    FROM ai_prompt_templates
    WHERE id = v_template_id;

    -- Update existing template
    UPDATE ai_prompt_templates
    SET
      name = p_name,
      description = p_description,
      system_prompt = p_system_prompt,
      user_prompt = p_user_prompt,
      model = p_model,
      temperature = p_temperature,
      max_tokens = p_max_tokens,
      version = COALESCE(v_current_version, 0) + 1,
      updated_at = NOW()
    WHERE id = v_template_id;
  ELSE
    -- Insert new template
    INSERT INTO ai_prompt_templates (
      category, name, description, system_prompt, user_prompt,
      model, temperature, max_tokens,
      user_id, organization_id, is_public, created_by
    )
    VALUES (
      p_category, p_name, p_description, p_system_prompt, p_user_prompt,
      p_model, p_temperature, p_max_tokens,
      CASE WHEN p_organization_id IS NULL THEN v_user_id ELSE NULL END,
      p_organization_id, p_is_public, v_user_id
    )
    RETURNING id INTO v_template_id;
  END IF;

  RETURN v_template_id;
END;
$$;

-- Function to get prompt for a feature (with fallback chain)
CREATE OR REPLACE FUNCTION get_prompt_template(
  p_category TEXT,
  p_user_id UUID DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  category TEXT,
  name TEXT,
  description TEXT,
  system_prompt TEXT,
  user_prompt TEXT,
  model TEXT,
  temperature NUMERIC,
  max_tokens INTEGER,
  source TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- First try user-specific override
  IF p_user_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      t.id, t.category, t.name, t.description,
      t.system_prompt, t.user_prompt, t.model,
      t.temperature, t.max_tokens,
      'user'::TEXT as source
    FROM ai_prompt_templates t
    WHERE t.category = p_category
      AND t.user_id = p_user_id
    LIMIT 1;

    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Then try org default
  IF p_organization_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      t.id, t.category, t.name, t.description,
      t.system_prompt, t.user_prompt, t.model,
      t.temperature, t.max_tokens,
      'organization'::TEXT as source
    FROM ai_prompt_templates t
    WHERE t.category = p_category
      AND t.organization_id = p_organization_id
      AND t.is_default = TRUE
    LIMIT 1;

    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Finally try system default (public, no org)
  RETURN QUERY
  SELECT
    t.id, t.category, t.name, t.description,
    t.system_prompt, t.user_prompt, t.model,
    t.temperature, t.max_tokens,
    'system'::TEXT as source
  FROM ai_prompt_templates t
  WHERE t.category = p_category
    AND t.is_public = TRUE
    AND t.organization_id IS NULL
    AND t.user_id IS NULL
  ORDER BY t.created_at DESC
  LIMIT 1;
END;
$$;

-- Function to reset a prompt to default (delete user override)
CREATE OR REPLACE FUNCTION reset_prompt_to_default(
  p_category TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_deleted BOOLEAN := FALSE;
BEGIN
  DELETE FROM ai_prompt_templates
  WHERE category = p_category
    AND user_id = v_user_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION save_prompt_template TO authenticated;
GRANT EXECUTE ON FUNCTION get_prompt_template TO authenticated;
GRANT EXECUTE ON FUNCTION reset_prompt_to_default TO authenticated;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE ai_prompt_templates IS
  'Stores customizable AI prompt templates for various features. Supports user overrides, org defaults, and system templates.';

COMMENT ON COLUMN ai_prompt_templates.category IS
  'Feature key matching promptLoader.ts categories (e.g., email_analysis, transcript_analysis)';

COMMENT ON COLUMN ai_prompt_templates.is_public IS
  'If true, this template is visible to all users in the organization';

COMMENT ON COLUMN ai_prompt_templates.is_default IS
  'If true, this is the default template for the org (overrides system default)';
