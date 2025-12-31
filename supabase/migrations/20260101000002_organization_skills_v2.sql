-- Migration: Organization Skills Extension for Agent-Executable Skills Platform
-- Phase 1, Stage 1.3: Extend organization_skills for compiled skill documents
-- Date: 2026-01-01

-- =============================================================================
-- Extend organization_skills table
-- Add columns for platform skill linking and compiled content
-- =============================================================================

-- Add new columns to existing organization_skills table
ALTER TABLE organization_skills
  ADD COLUMN IF NOT EXISTS platform_skill_id UUID REFERENCES platform_skills(id),
  ADD COLUMN IF NOT EXISTS platform_skill_version INT,
  ADD COLUMN IF NOT EXISTS compiled_frontmatter JSONB,
  ADD COLUMN IF NOT EXISTS compiled_content TEXT,
  ADD COLUMN IF NOT EXISTS user_overrides JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_compiled_at TIMESTAMPTZ;

-- Add comments for new columns
COMMENT ON COLUMN organization_skills.platform_skill_id IS 'Reference to the platform skill template this was compiled from';
COMMENT ON COLUMN organization_skills.platform_skill_version IS 'Version of the platform skill used for compilation';
COMMENT ON COLUMN organization_skills.compiled_frontmatter IS 'Frontmatter with org context variables interpolated';
COMMENT ON COLUMN organization_skills.compiled_content IS 'Skill content with org context variables interpolated';
COMMENT ON COLUMN organization_skills.user_overrides IS 'Org-specific overrides that persist across recompilation';
COMMENT ON COLUMN organization_skills.is_enabled IS 'Whether this skill is enabled for the organization';
COMMENT ON COLUMN organization_skills.last_compiled_at IS 'When this skill was last compiled from platform template';

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_org_skills_platform_skill ON organization_skills(platform_skill_id);
CREATE INDEX IF NOT EXISTS idx_org_skills_enabled ON organization_skills(is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_org_skills_needs_recompile ON organization_skills(last_compiled_at) WHERE last_compiled_at IS NULL;

-- =============================================================================
-- Function: Get compiled skills for AI agents
-- Returns all enabled, compiled skills for an organization
-- =============================================================================

CREATE OR REPLACE FUNCTION get_organization_skills_for_agent(p_org_id UUID)
RETURNS TABLE (
  skill_key TEXT,
  category TEXT,
  frontmatter JSONB,
  content TEXT,
  is_enabled BOOLEAN,
  version INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    os.skill_id as skill_key,
    ps.category,
    COALESCE(os.compiled_frontmatter, ps.frontmatter) as frontmatter,
    COALESCE(os.compiled_content, ps.content_template) as content,
    COALESCE(os.is_enabled, true) as is_enabled,
    COALESCE(os.platform_skill_version, ps.version) as version
  FROM organization_skills os
  LEFT JOIN platform_skills ps ON ps.id = os.platform_skill_id
  WHERE os.organization_id = p_org_id
    AND os.is_active = true
    AND COALESCE(os.is_enabled, true) = true
    AND (ps.id IS NULL OR ps.is_active = true)
  ORDER BY ps.category NULLS LAST, os.skill_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_organization_skills_for_agent IS 'Returns compiled skills for AI agents with fallback to platform templates';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_organization_skills_for_agent TO authenticated;

-- =============================================================================
-- Function: Get skills needing recompilation
-- Used by refresh system to identify stale skills
-- =============================================================================

CREATE OR REPLACE FUNCTION get_skills_needing_recompile()
RETURNS TABLE (
  organization_id UUID,
  skill_id TEXT,
  platform_skill_id UUID,
  current_version INT,
  platform_version INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    os.organization_id,
    os.skill_id,
    os.platform_skill_id,
    os.platform_skill_version as current_version,
    ps.version as platform_version
  FROM organization_skills os
  JOIN platform_skills ps ON ps.id = os.platform_skill_id
  WHERE os.is_active = true
    AND ps.is_active = true
    AND (
      os.last_compiled_at IS NULL
      OR os.platform_skill_version < ps.version
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_skills_needing_recompile IS 'Returns organization skills that need recompilation due to platform skill updates';

-- Grant execute permission (admin only via RLS)
GRANT EXECUTE ON FUNCTION get_skills_needing_recompile TO authenticated;

-- =============================================================================
-- Trigger: Mark org skills for recompile when platform skill is updated
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_platform_skill_update()
RETURNS TRIGGER AS $$
BEGIN
  -- When a platform skill is updated, mark all org skills for recompilation
  -- by setting last_compiled_at to NULL (they'll be picked up by refresh job)
  UPDATE organization_skills
  SET last_compiled_at = NULL
  WHERE platform_skill_id = NEW.id
    AND is_active = true;

  -- Log the update for monitoring
  RAISE NOTICE 'Platform skill % updated to version %, % org skills marked for recompile',
    NEW.skill_key, NEW.version,
    (SELECT COUNT(*) FROM organization_skills WHERE platform_skill_id = NEW.id AND is_active = true);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS platform_skill_updated_trigger ON platform_skills;
CREATE TRIGGER platform_skill_updated_trigger
  AFTER UPDATE ON platform_skills
  FOR EACH ROW
  WHEN (OLD.version IS DISTINCT FROM NEW.version)
  EXECUTE FUNCTION notify_platform_skill_update();

-- =============================================================================
-- Function: Save compiled skill
-- Used by the compile-organization-skills edge function
-- =============================================================================

CREATE OR REPLACE FUNCTION save_compiled_organization_skill(
  p_org_id UUID,
  p_skill_key TEXT,
  p_platform_skill_id UUID,
  p_platform_version INT,
  p_compiled_frontmatter JSONB,
  p_compiled_content TEXT
)
RETURNS UUID AS $$
DECLARE
  v_existing_id UUID;
  v_result_id UUID;
BEGIN
  -- Check if skill already exists for this org
  SELECT id INTO v_existing_id
  FROM organization_skills
  WHERE organization_id = p_org_id
    AND skill_id = p_skill_key;

  IF v_existing_id IS NOT NULL THEN
    -- Update existing skill
    UPDATE organization_skills
    SET
      platform_skill_id = p_platform_skill_id,
      platform_skill_version = p_platform_version,
      compiled_frontmatter = p_compiled_frontmatter,
      compiled_content = p_compiled_content,
      last_compiled_at = now(),
      updated_at = now()
    WHERE id = v_existing_id
    RETURNING id INTO v_result_id;
  ELSE
    -- Insert new skill
    INSERT INTO organization_skills (
      organization_id,
      skill_id,
      skill_name,
      platform_skill_id,
      platform_skill_version,
      compiled_frontmatter,
      compiled_content,
      config,
      ai_generated,
      is_enabled,
      last_compiled_at
    ) VALUES (
      p_org_id,
      p_skill_key,
      COALESCE(p_compiled_frontmatter->>'name', p_skill_key),
      p_platform_skill_id,
      p_platform_version,
      p_compiled_frontmatter,
      p_compiled_content,
      '{}',
      true,
      true,
      now()
    )
    RETURNING id INTO v_result_id;
  END IF;

  RETURN v_result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION save_compiled_organization_skill IS 'Save or update a compiled skill for an organization';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION save_compiled_organization_skill TO authenticated;

-- =============================================================================
-- Function: Toggle skill enabled status
-- Used by org admins to enable/disable skills
-- =============================================================================

CREATE OR REPLACE FUNCTION toggle_organization_skill(
  p_org_id UUID,
  p_skill_key TEXT,
  p_is_enabled BOOLEAN
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE organization_skills
  SET
    is_enabled = p_is_enabled,
    updated_at = now()
  WHERE organization_id = p_org_id
    AND skill_id = p_skill_key;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION toggle_organization_skill IS 'Enable or disable a skill for an organization';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION toggle_organization_skill TO authenticated;

-- =============================================================================
-- Function: Save user overrides
-- Preserves org-specific customizations across recompilation
-- =============================================================================

CREATE OR REPLACE FUNCTION save_skill_user_overrides(
  p_org_id UUID,
  p_skill_key TEXT,
  p_overrides JSONB
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE organization_skills
  SET
    user_overrides = p_overrides,
    user_modified = true,
    updated_at = now()
  WHERE organization_id = p_org_id
    AND skill_id = p_skill_key;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION save_skill_user_overrides IS 'Save user overrides that persist across skill recompilation';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION save_skill_user_overrides TO authenticated;
