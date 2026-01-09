-- Migration: Add missing skill compilation functions
-- Purpose: Add functions required by compile-organization-skills edge function
-- Date: 2026-01-01

-- =============================================================================
-- Function: Get organization context as a JSONB object
-- Returns all context key-value pairs as a single JSONB object
-- Used by compile-organization-skills edge function
-- =============================================================================

CREATE OR REPLACE FUNCTION get_organization_context_object(p_org_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB := '{}';
  v_row RECORD;
BEGIN
  FOR v_row IN
    SELECT context_key, value
    FROM organization_context
    WHERE organization_id = p_org_id
  LOOP
    -- For string values stored as JSONB, extract the raw value
    -- For arrays/objects, keep the JSONB structure
    v_result := v_result || jsonb_build_object(v_row.context_key, v_row.value);
  END LOOP;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role (for edge functions)
GRANT EXECUTE ON FUNCTION get_organization_context_object TO service_role;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_organization_context_object TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_organization_context_object IS 'Returns all organization context as a single JSONB object for skill template interpolation';

-- =============================================================================
-- Function: Save compiled organization skill
-- Creates or updates an organization skill with compiled content
-- Used by compile-organization-skills edge function
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
  v_result_id UUID;
  v_skill_name TEXT;
BEGIN
  -- Get skill name from platform_skills
  SELECT COALESCE(
    ps.frontmatter->>'name',
    INITCAP(REPLACE(ps.skill_key, '-', ' '))
  ) INTO v_skill_name
  FROM platform_skills ps
  WHERE ps.id = p_platform_skill_id;

  -- Upsert organization skill
  INSERT INTO organization_skills (
    organization_id,
    skill_id,
    skill_name,
    config,
    platform_skill_id,
    platform_skill_version,
    compiled_frontmatter,
    compiled_content,
    is_enabled,
    is_active,
    ai_generated,
    last_compiled_at
  )
  VALUES (
    p_org_id,
    p_skill_key,
    COALESCE(v_skill_name, INITCAP(REPLACE(p_skill_key, '-', ' '))),
    '{}',
    p_platform_skill_id,
    p_platform_version,
    p_compiled_frontmatter,
    p_compiled_content,
    true,
    true,
    false,
    now()
  )
  ON CONFLICT (organization_id, skill_id)
  DO UPDATE SET
    platform_skill_id = EXCLUDED.platform_skill_id,
    platform_skill_version = EXCLUDED.platform_skill_version,
    compiled_frontmatter = EXCLUDED.compiled_frontmatter,
    compiled_content = EXCLUDED.compiled_content,
    last_compiled_at = now(),
    updated_at = now()
  RETURNING id INTO v_result_id;

  RETURN v_result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role (for edge functions)
GRANT EXECUTE ON FUNCTION save_compiled_organization_skill TO service_role;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION save_compiled_organization_skill TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION save_compiled_organization_skill IS 'Creates or updates an organization skill with compiled platform skill content';

-- =============================================================================
-- Function: Get skills needing recompile (alias for edge function)
-- Returns skills that need to be recompiled
-- =============================================================================

CREATE OR REPLACE FUNCTION get_skills_needing_recompile(p_org_id UUID DEFAULT NULL)
RETURNS TABLE (
  organization_id UUID,
  skill_key TEXT,
  platform_skill_id UUID,
  platform_version INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    os.organization_id,
    os.skill_id as skill_key,
    ps.id as platform_skill_id,
    ps.version as platform_version
  FROM organization_skills os
  JOIN platform_skills ps ON ps.skill_key = os.skill_id
  WHERE os.is_active = true
    AND ps.is_active = true
    AND (p_org_id IS NULL OR os.organization_id = p_org_id)
    AND (
      os.last_compiled_at IS NULL
      OR os.platform_skill_version IS NULL
      OR os.platform_skill_version < ps.version
    )
  ORDER BY os.organization_id, os.skill_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_skills_needing_recompile TO service_role;
GRANT EXECUTE ON FUNCTION get_skills_needing_recompile TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_skills_needing_recompile IS 'Returns organization skills that need compilation or recompilation';
