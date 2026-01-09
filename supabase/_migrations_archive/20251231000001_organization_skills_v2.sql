-- Migration: Organization Skills V2 Extension
-- Purpose: Extend organization_skills table for platform skill compilation
-- Phase 1, Stage 1.3 of Agent-Executable Skills Platform
-- Date: 2025-01-01

-- =============================================================================
-- Extend organization_skills table
-- Add columns for platform skill references and compiled content
-- =============================================================================

-- Add new columns to organization_skills table
ALTER TABLE organization_skills
  ADD COLUMN IF NOT EXISTS platform_skill_id UUID REFERENCES platform_skills(id),
  ADD COLUMN IF NOT EXISTS platform_skill_version INT,
  ADD COLUMN IF NOT EXISTS compiled_frontmatter JSONB,
  ADD COLUMN IF NOT EXISTS compiled_content TEXT,
  ADD COLUMN IF NOT EXISTS user_overrides JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_compiled_at TIMESTAMPTZ;

-- Create index on platform_skill_id for faster joins
CREATE INDEX IF NOT EXISTS idx_org_skills_platform_skill ON organization_skills(platform_skill_id);
CREATE INDEX IF NOT EXISTS idx_org_skills_enabled ON organization_skills(is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_org_skills_compilation ON organization_skills(organization_id, is_enabled)
  WHERE is_enabled = true AND last_compiled_at IS NOT NULL;

-- =============================================================================
-- Function: Get all compiled skills for an organization (used by AI agents)
-- Returns skills in agent-executable format with compiled content
-- =============================================================================

CREATE OR REPLACE FUNCTION get_organization_skills_for_agent(p_org_id UUID)
RETURNS TABLE (
  skill_key TEXT,
  category TEXT,
  frontmatter JSONB,
  content TEXT,
  is_enabled BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    os.skill_id as skill_key,
    ps.category,
    COALESCE(os.compiled_frontmatter, ps.frontmatter) as frontmatter,
    COALESCE(os.compiled_content, ps.content_template) as content,
    os.is_enabled
  FROM organization_skills os
  JOIN platform_skills ps ON ps.skill_key = os.skill_id
  WHERE os.organization_id = p_org_id
    AND os.is_active = true
    AND ps.is_active = true
    AND os.is_enabled = true
  ORDER BY ps.category, os.skill_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_organization_skills_for_agent TO authenticated;

-- =============================================================================
-- Function: Trigger to recompile skills when platform skill is updated
-- Marks organization_skills for recompilation by clearing last_compiled_at
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_skill_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark all organization skills using this platform skill for recompilation
  UPDATE organization_skills
  SET last_compiled_at = NULL
  WHERE skill_id = NEW.skill_key;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on platform_skills updates
DROP TRIGGER IF EXISTS platform_skill_updated ON platform_skills;
CREATE TRIGGER platform_skill_updated
  AFTER UPDATE ON platform_skills
  FOR EACH ROW
  WHEN (OLD.content_template IS DISTINCT FROM NEW.content_template
        OR OLD.frontmatter IS DISTINCT FROM NEW.frontmatter)
  EXECUTE FUNCTION notify_skill_update();

-- =============================================================================
-- Function: Get skills needing compilation
-- Returns organization skills that need to be compiled or recompiled
-- =============================================================================

CREATE OR REPLACE FUNCTION get_skills_needing_compilation()
RETURNS TABLE (
  org_skill_id UUID,
  organization_id UUID,
  skill_key TEXT,
  platform_skill_id UUID,
  platform_frontmatter JSONB,
  platform_content TEXT,
  platform_version INT,
  user_overrides JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    os.id as org_skill_id,
    os.organization_id,
    os.skill_id as skill_key,
    ps.id as platform_skill_id,
    ps.frontmatter as platform_frontmatter,
    ps.content_template as platform_content,
    ps.version as platform_version,
    os.user_overrides
  FROM organization_skills os
  JOIN platform_skills ps ON ps.skill_key = os.skill_id
  WHERE os.is_active = true
    AND ps.is_active = true
    AND (
      os.last_compiled_at IS NULL
      OR os.platform_skill_version IS NULL
      OR os.platform_skill_version < ps.version
    )
  ORDER BY os.organization_id, ps.category, os.skill_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_skills_needing_compilation TO authenticated;

-- =============================================================================
-- Function: Mark skill as compiled
-- Updates organization_skills after successful compilation
-- =============================================================================

CREATE OR REPLACE FUNCTION mark_skill_compiled(
  p_org_skill_id UUID,
  p_compiled_frontmatter JSONB,
  p_compiled_content TEXT,
  p_platform_skill_id UUID,
  p_platform_version INT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE organization_skills
  SET
    compiled_frontmatter = p_compiled_frontmatter,
    compiled_content = p_compiled_content,
    platform_skill_id = p_platform_skill_id,
    platform_skill_version = p_platform_version,
    last_compiled_at = now(),
    updated_at = now()
  WHERE id = p_org_skill_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION mark_skill_compiled TO authenticated;

-- =============================================================================
-- Function: Get organization skills summary
-- Returns a summary of skills for an organization with compilation status
-- =============================================================================

CREATE OR REPLACE FUNCTION get_organization_skills_summary(p_org_id UUID)
RETURNS TABLE (
  skill_id TEXT,
  skill_name TEXT,
  category TEXT,
  is_enabled BOOLEAN,
  is_compiled BOOLEAN,
  needs_compilation BOOLEAN,
  platform_version INT,
  org_version INT,
  last_compiled_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    os.skill_id,
    os.skill_name,
    ps.category,
    os.is_enabled,
    (os.last_compiled_at IS NOT NULL) as is_compiled,
    (os.last_compiled_at IS NULL OR os.platform_skill_version IS NULL OR os.platform_skill_version < ps.version) as needs_compilation,
    ps.version as platform_version,
    os.platform_skill_version as org_version,
    os.last_compiled_at
  FROM organization_skills os
  LEFT JOIN platform_skills ps ON ps.skill_key = os.skill_id
  WHERE os.organization_id = p_org_id
    AND os.is_active = true
  ORDER BY ps.category, os.skill_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_organization_skills_summary TO authenticated;

-- =============================================================================
-- Comments for Documentation
-- =============================================================================

COMMENT ON COLUMN organization_skills.platform_skill_id IS 'Reference to the platform skill template used to compile this skill';
COMMENT ON COLUMN organization_skills.platform_skill_version IS 'Version of the platform skill used for compilation';
COMMENT ON COLUMN organization_skills.compiled_frontmatter IS 'Compiled frontmatter with organization context interpolated';
COMMENT ON COLUMN organization_skills.compiled_content IS 'Compiled markdown content with organization context interpolated';
COMMENT ON COLUMN organization_skills.user_overrides IS 'User-specific customizations that override platform skill content';
COMMENT ON COLUMN organization_skills.is_enabled IS 'Whether this skill is enabled for the organization';
COMMENT ON COLUMN organization_skills.last_compiled_at IS 'Timestamp of last successful compilation';

COMMENT ON FUNCTION get_organization_skills_for_agent IS 'Returns all compiled skills for an organization in agent-executable format';
COMMENT ON FUNCTION notify_skill_update IS 'Trigger function that marks organization skills for recompilation when platform skill changes';
COMMENT ON FUNCTION get_skills_needing_compilation IS 'Returns organization skills that need compilation or recompilation';
COMMENT ON FUNCTION mark_skill_compiled IS 'Updates organization_skills after successful compilation';
COMMENT ON FUNCTION get_organization_skills_summary IS 'Returns a summary of skills with compilation status for an organization';
