-- Migration: Platform Skills Schema for Agent-Executable Skills Platform
-- Phase 1, Stage 1.1: Create platform-level skill documents table
-- Date: 2026-01-01

-- =============================================================================
-- Table 1: platform_skills
-- Platform-level skill templates with frontmatter and content placeholders
-- Super-admin only management, all users can read active skills
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification
  skill_key TEXT NOT NULL UNIQUE,  -- 'lead-qualification', 'follow-up-email', etc.
  category TEXT NOT NULL CHECK (category IN ('sales-ai', 'writing', 'enrichment', 'workflows')),

  -- Skill Document (Markdown with frontmatter style)
  frontmatter JSONB NOT NULL DEFAULT '{}',  -- {name, description, triggers, requires_context, etc.}
  content_template TEXT NOT NULL DEFAULT '',  -- Markdown body with ${variable} placeholders

  -- Version Control
  version INT NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add comments for documentation
COMMENT ON TABLE platform_skills IS 'Platform-level skill templates managed by super-admins. Contains frontmatter and content templates with variable placeholders.';
COMMENT ON COLUMN platform_skills.skill_key IS 'Unique identifier for the skill, e.g., lead-qualification, follow-up-email';
COMMENT ON COLUMN platform_skills.category IS 'Skill category: sales-ai, writing, enrichment, or workflows';
COMMENT ON COLUMN platform_skills.frontmatter IS 'JSONB metadata including name, description, triggers, requires_context array';
COMMENT ON COLUMN platform_skills.content_template IS 'Markdown content with ${variable} placeholders for org context interpolation';
COMMENT ON COLUMN platform_skills.version IS 'Auto-incremented version number for change tracking';

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_platform_skills_category ON platform_skills(category);
CREATE INDEX IF NOT EXISTS idx_platform_skills_active ON platform_skills(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_platform_skills_key ON platform_skills(skill_key);

-- =============================================================================
-- Table 2: platform_skills_history
-- Version history for rollback capability
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform_skills_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID REFERENCES platform_skills(id) ON DELETE CASCADE,
  version INT NOT NULL,
  frontmatter JSONB NOT NULL,
  content_template TEXT NOT NULL,
  changed_by UUID REFERENCES profiles(id),
  changed_at TIMESTAMPTZ DEFAULT now(),
  change_reason TEXT
);

COMMENT ON TABLE platform_skills_history IS 'Version history for platform skills, enables rollback to previous versions';

CREATE INDEX IF NOT EXISTS idx_platform_skills_history_skill ON platform_skills_history(skill_id);
CREATE INDEX IF NOT EXISTS idx_platform_skills_history_version ON platform_skills_history(skill_id, version);

-- =============================================================================
-- RLS Policies for platform_skills
-- =============================================================================

ALTER TABLE platform_skills ENABLE ROW LEVEL SECURITY;

-- Anyone can read active skills (needed for compilation)
CREATE POLICY "Anyone can read active platform skills"
  ON platform_skills FOR SELECT
  USING (is_active = true);

-- Super-admins can read all skills (including inactive)
CREATE POLICY "Platform admins can read all skills"
  ON platform_skills FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Only platform admins can insert
CREATE POLICY "Platform admins can insert skills"
  ON platform_skills FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Only platform admins can update
CREATE POLICY "Platform admins can update skills"
  ON platform_skills FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Only platform admins can delete
CREATE POLICY "Platform admins can delete skills"
  ON platform_skills FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- =============================================================================
-- RLS Policies for platform_skills_history
-- =============================================================================

ALTER TABLE platform_skills_history ENABLE ROW LEVEL SECURITY;

-- Anyone can read history (for debugging/audit purposes)
CREATE POLICY "Anyone can read platform skills history"
  ON platform_skills_history FOR SELECT
  USING (true);

-- Only admins can insert history
CREATE POLICY "Platform admins can insert skills history"
  ON platform_skills_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- =============================================================================
-- Trigger: Auto-update updated_at and increment version
-- =============================================================================

CREATE OR REPLACE FUNCTION update_platform_skill_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment version on content or frontmatter changes
  IF OLD.content_template IS DISTINCT FROM NEW.content_template
     OR OLD.frontmatter IS DISTINCT FROM NEW.frontmatter THEN
    NEW.version := OLD.version + 1;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_platform_skill_version_trigger ON platform_skills;
CREATE TRIGGER update_platform_skill_version_trigger
  BEFORE UPDATE ON platform_skills
  FOR EACH ROW EXECUTE FUNCTION update_platform_skill_version();

-- =============================================================================
-- Trigger: Save to history on update
-- =============================================================================

CREATE OR REPLACE FUNCTION save_platform_skill_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Only save history if content or frontmatter changed
  IF OLD.content_template IS DISTINCT FROM NEW.content_template
     OR OLD.frontmatter IS DISTINCT FROM NEW.frontmatter THEN
    INSERT INTO platform_skills_history (
      skill_id,
      version,
      frontmatter,
      content_template,
      changed_by
    ) VALUES (
      OLD.id,
      OLD.version,
      OLD.frontmatter,
      OLD.content_template,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS save_platform_skill_history_trigger ON platform_skills;
CREATE TRIGGER save_platform_skill_history_trigger
  AFTER UPDATE ON platform_skills
  FOR EACH ROW EXECUTE FUNCTION save_platform_skill_history();
