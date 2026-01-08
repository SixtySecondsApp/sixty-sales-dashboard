-- Migration: Platform Skills Schema
-- Purpose: Platform-level skill documents (super-admin only)
-- Phase 1, Stage 1.1 of Agent-Executable Skills Platform
-- Date: 2025-01-01

-- =============================================================================
-- Table 1: platform_skills
-- Platform-level skill documents that are compiled for each organization
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification
  skill_key TEXT NOT NULL UNIQUE,  -- 'lead-qualification', 'follow-up-email'
  category TEXT NOT NULL CHECK (category IN ('sales-ai', 'writing', 'enrichment', 'workflows')),

  -- Skill Document (Markdown with frontmatter)
  frontmatter JSONB NOT NULL DEFAULT '{}',  -- {name, description, triggers, requires_context, etc.}
  content_template TEXT NOT NULL,  -- Markdown body with ${variable} placeholders

  -- Version Control
  version INT NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_platform_skills_category ON platform_skills(category);
CREATE INDEX IF NOT EXISTS idx_platform_skills_active ON platform_skills(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_platform_skills_key ON platform_skills(skill_key);

-- =============================================================================
-- Table 2: platform_skills_history
-- Track version history for rollback capability
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform_skills_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID REFERENCES platform_skills(id) ON DELETE CASCADE,
  version INT NOT NULL,
  frontmatter JSONB NOT NULL,
  content_template TEXT NOT NULL,
  changed_by UUID REFERENCES profiles(id),
  changed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_skills_history_skill ON platform_skills_history(skill_id);
CREATE INDEX IF NOT EXISTS idx_platform_skills_history_version ON platform_skills_history(skill_id, version);

-- =============================================================================
-- RLS Policies for platform_skills
-- =============================================================================

ALTER TABLE platform_skills ENABLE ROW LEVEL SECURITY;

-- Anyone can read active skills (idempotent)
DROP POLICY IF EXISTS "Anyone can read active platform skills" ON platform_skills;
CREATE POLICY "Anyone can read active platform skills"
  ON platform_skills FOR SELECT
  USING (is_active = true);

-- Only platform admins can manage skills (insert, update, delete) (idempotent)
DROP POLICY IF EXISTS "Only platform admins can insert platform skills" ON platform_skills;
CREATE POLICY "Only platform admins can insert platform skills"
  ON platform_skills FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ));

DROP POLICY IF EXISTS "Only platform admins can update platform skills" ON platform_skills;
CREATE POLICY "Only platform admins can update platform skills"
  ON platform_skills FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ));

DROP POLICY IF EXISTS "Only platform admins can delete platform skills" ON platform_skills;
CREATE POLICY "Only platform admins can delete platform skills"
  ON platform_skills FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ));

-- =============================================================================
-- RLS Policies for platform_skills_history
-- =============================================================================

ALTER TABLE platform_skills_history ENABLE ROW LEVEL SECURITY;

-- Anyone can read skill history (idempotent)
DROP POLICY IF EXISTS "Anyone can read platform skills history" ON platform_skills_history;
CREATE POLICY "Anyone can read platform skills history"
  ON platform_skills_history FOR SELECT
  USING (true);

-- Only platform admins can insert history (done automatically via trigger) (idempotent)
DROP POLICY IF EXISTS "Service role can insert platform skills history" ON platform_skills_history;
CREATE POLICY "Service role can insert platform skills history"
  ON platform_skills_history FOR INSERT
  WITH CHECK (true);

-- =============================================================================
-- Trigger: Auto-update updated_at timestamp
-- =============================================================================

-- Use existing update_updated_at_column function or create if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_platform_skills_updated_at ON platform_skills;
CREATE TRIGGER update_platform_skills_updated_at
  BEFORE UPDATE ON platform_skills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Trigger: Auto-save version history before updates
-- =============================================================================

CREATE OR REPLACE FUNCTION save_platform_skill_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Save current version to history before update
  INSERT INTO platform_skills_history (
    skill_id,
    version,
    frontmatter,
    content_template,
    changed_by
  )
  VALUES (
    OLD.id,
    OLD.version,
    OLD.frontmatter,
    OLD.content_template,
    auth.uid()
  );

  -- Increment version on the new record
  NEW.version := OLD.version + 1;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS platform_skill_version_history ON platform_skills;
CREATE TRIGGER platform_skill_version_history
  BEFORE UPDATE ON platform_skills
  FOR EACH ROW
  WHEN (OLD.content_template IS DISTINCT FROM NEW.content_template
        OR OLD.frontmatter IS DISTINCT FROM NEW.frontmatter)
  EXECUTE FUNCTION save_platform_skill_history();

-- =============================================================================
-- Function: Get platform skill by key
-- =============================================================================

CREATE OR REPLACE FUNCTION get_platform_skill(p_skill_key TEXT)
RETURNS TABLE (
  id UUID,
  skill_key TEXT,
  category TEXT,
  frontmatter JSONB,
  content_template TEXT,
  version INT,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ps.id,
    ps.skill_key,
    ps.category,
    ps.frontmatter,
    ps.content_template,
    ps.version,
    ps.is_active
  FROM platform_skills ps
  WHERE ps.skill_key = p_skill_key
    AND ps.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_platform_skill TO authenticated;
