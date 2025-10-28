-- Migration: Create Meeting Content Tables for AI-Generated Marketing Content
-- Created: 2025-01-28
-- Description: Adds tables for storing extracted topics and generated marketing content
--              from meeting transcripts with full versioning and cost tracking

-- ============================================================================
-- Table 1: meeting_content_topics
-- ============================================================================
-- Stores extracted discussion topics from meeting transcripts
-- Cached per meeting to avoid repeat AI calls
-- JSONB structure allows atomic updates and flexible querying

CREATE TABLE IF NOT EXISTS meeting_content_topics (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id), -- User who owns this extraction

  -- Topic Data (JSONB for flexibility and performance)
  -- Structure: [{ title, description, timestamp_seconds }, ...]
  topics JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Versioning (allows re-extraction)
  extraction_version INTEGER NOT NULL DEFAULT 1,

  -- AI Metadata
  model_used TEXT NOT NULL, -- e.g., "claude-haiku-4-5-20251001"
  tokens_used INTEGER CHECK (tokens_used >= 0),
  cost_cents INTEGER CHECK (cost_cents >= 0), -- Integer for exact arithmetic

  -- Audit Fields
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ, -- Soft delete

  -- Constraints
  CONSTRAINT topics_json_check CHECK (jsonb_typeof(topics) = 'array'),
  CONSTRAINT extraction_version_positive CHECK (extraction_version > 0)
);

-- Comments
COMMENT ON TABLE meeting_content_topics IS 'Stores AI-extracted discussion topics from meeting transcripts';
COMMENT ON COLUMN meeting_content_topics.topics IS 'JSONB array of topic objects with title, description, timestamp, and fathom_url';
COMMENT ON COLUMN meeting_content_topics.cost_cents IS 'Cost in cents for exact financial arithmetic (no floating point errors)';

-- ============================================================================
-- Table 2: meeting_generated_content
-- ============================================================================
-- Stores AI-generated marketing content with full versioning
-- Supports multiple content types and regeneration history

CREATE TABLE IF NOT EXISTS meeting_generated_content (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,

  -- Content Data
  content_type TEXT NOT NULL CHECK (content_type IN ('social', 'blog', 'video', 'email')),
  title TEXT,
  content TEXT NOT NULL, -- Markdown format

  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  parent_id UUID REFERENCES meeting_generated_content(id) ON DELETE SET NULL, -- Version chain
  is_latest BOOLEAN NOT NULL DEFAULT true,

  -- AI Metadata
  model_used TEXT NOT NULL, -- e.g., "claude-sonnet-4-5-20250929"
  prompt_used TEXT, -- Optional: store prompt for debugging
  tokens_used INTEGER CHECK (tokens_used >= 0),
  cost_cents INTEGER CHECK (cost_cents >= 0),

  -- Audit Fields
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT version_positive CHECK (version > 0)
);

-- Comments
COMMENT ON TABLE meeting_generated_content IS 'Stores AI-generated marketing content with full version history';
COMMENT ON COLUMN meeting_generated_content.content_type IS 'Type of content: social (posts), blog (articles), video (scripts), email (newsletters)';
COMMENT ON COLUMN meeting_generated_content.version IS 'Version number for tracking regenerations (1, 2, 3...)';
COMMENT ON COLUMN meeting_generated_content.parent_id IS 'Links to previous version for version chain';
COMMENT ON COLUMN meeting_generated_content.is_latest IS 'Flag for quickly finding the most recent version';

-- ============================================================================
-- Table 3: content_topic_links
-- ============================================================================
-- Junction table for many-to-many relationship between content and topics
-- Tracks which topics were used to generate each piece of content

CREATE TABLE IF NOT EXISTS content_topic_links (
  -- Composite Primary Key
  content_id UUID NOT NULL REFERENCES meeting_generated_content(id) ON DELETE CASCADE,
  topic_index INTEGER NOT NULL CHECK (topic_index >= 0), -- Index in topics JSONB array

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Primary Key
  PRIMARY KEY (content_id, topic_index)
);

-- Comments
COMMENT ON TABLE content_topic_links IS 'Junction table linking generated content to specific topics';
COMMENT ON COLUMN content_topic_links.topic_index IS 'Index of topic in meeting_content_topics.topics JSONB array';

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- meeting_content_topics indexes
CREATE INDEX IF NOT EXISTS idx_topics_meeting_id ON meeting_content_topics(meeting_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_topics_user_id ON meeting_content_topics(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_topics_created_by ON meeting_content_topics(created_by) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_topics_created_at ON meeting_content_topics(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_topics_extraction_version ON meeting_content_topics(meeting_id, extraction_version DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_topics_jsonb_search ON meeting_content_topics USING GIN (topics) WHERE deleted_at IS NULL;

-- meeting_generated_content indexes
CREATE INDEX IF NOT EXISTS idx_content_meeting_id ON meeting_generated_content(meeting_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_content_type ON meeting_generated_content(content_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_content_created_by ON meeting_generated_content(created_by) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_content_is_latest ON meeting_generated_content(is_latest) WHERE is_latest = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_content_version ON meeting_generated_content(meeting_id, content_type, version DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_content_created_at ON meeting_generated_content(created_at DESC) WHERE deleted_at IS NULL;

-- content_topic_links indexes
CREATE INDEX IF NOT EXISTS idx_links_content_id ON content_topic_links(content_id);
CREATE INDEX IF NOT EXISTS idx_links_topic_index ON content_topic_links(topic_index);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE meeting_content_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_topic_links ENABLE ROW LEVEL SECURITY;

-- meeting_content_topics policies
CREATE POLICY "Users can view topics for their meetings"
  ON meeting_content_topics FOR SELECT
  USING (
    deleted_at IS NULL AND
    meeting_id IN (
      SELECT id FROM meetings WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create topics for their meetings"
  ON meeting_content_topics FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    meeting_id IN (
      SELECT id FROM meetings WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own topics"
  ON meeting_content_topics FOR UPDATE
  USING (
    deleted_at IS NULL AND
    created_by = auth.uid() AND
    meeting_id IN (
      SELECT id FROM meetings WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can soft delete their own topics"
  ON meeting_content_topics FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (deleted_at IS NOT NULL);

-- meeting_generated_content policies
CREATE POLICY "Users can view content for their meetings"
  ON meeting_generated_content FOR SELECT
  USING (
    deleted_at IS NULL AND
    meeting_id IN (
      SELECT id FROM meetings WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create content for their meetings"
  ON meeting_generated_content FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    meeting_id IN (
      SELECT id FROM meetings WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own content"
  ON meeting_generated_content FOR UPDATE
  USING (
    deleted_at IS NULL AND
    created_by = auth.uid() AND
    meeting_id IN (
      SELECT id FROM meetings WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can soft delete their own content"
  ON meeting_generated_content FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (deleted_at IS NOT NULL);

-- content_topic_links policies (linked to content permissions)
CREATE POLICY "Users can view links for their content"
  ON content_topic_links FOR SELECT
  USING (
    content_id IN (
      SELECT id FROM meeting_generated_content
      WHERE deleted_at IS NULL AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create links for their content"
  ON content_topic_links FOR INSERT
  WITH CHECK (
    content_id IN (
      SELECT id FROM meeting_generated_content
      WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete links for their content"
  ON content_topic_links FOR DELETE
  USING (
    content_id IN (
      SELECT id FROM meeting_generated_content
      WHERE created_by = auth.uid()
    )
  );

-- ============================================================================
-- Automatic Timestamp Triggers
-- ============================================================================

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers
CREATE TRIGGER update_meeting_content_topics_updated_at
  BEFORE UPDATE ON meeting_content_topics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meeting_generated_content_updated_at
  BEFORE UPDATE ON meeting_generated_content
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to get latest content for a meeting by type
CREATE OR REPLACE FUNCTION get_latest_content(
  p_meeting_id UUID,
  p_content_type TEXT
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  title TEXT,
  version INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY: Verify caller owns the meeting
  IF NOT EXISTS (
    SELECT 1
    FROM meetings
    WHERE meetings.id = p_meeting_id
      AND meetings.owner_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Permission denied: You do not own this meeting'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Return content
  RETURN QUERY
  SELECT
    mgc.id,
    mgc.content,
    mgc.title,
    mgc.version,
    mgc.created_at
  FROM meeting_generated_content mgc
  WHERE
    mgc.meeting_id = p_meeting_id
    AND mgc.content_type = p_content_type
    AND mgc.is_latest = true
    AND mgc.deleted_at IS NULL
  ORDER BY mgc.created_at DESC
  LIMIT 1;
END;
$$;

-- Function to get content with linked topics
CREATE OR REPLACE FUNCTION get_content_with_topics(p_content_id UUID)
RETURNS TABLE (
  content_id UUID,
  content TEXT,
  title TEXT,
  content_type TEXT,
  topics JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY: Verify caller owns the meeting for this content
  IF NOT EXISTS (
    SELECT 1
    FROM meeting_generated_content mgc
    JOIN meetings m ON m.id = mgc.meeting_id
    WHERE mgc.id = p_content_id
      AND m.owner_user_id = auth.uid()
      AND mgc.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Permission denied: You do not own the meeting for this content'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Return content with topics
  RETURN QUERY
  SELECT
    mgc.id,
    mgc.content,
    mgc.title,
    mgc.content_type,
    mct.topics
  FROM meeting_generated_content mgc
  JOIN content_topic_links ctl ON ctl.content_id = mgc.id
  JOIN meeting_content_topics mct ON mct.meeting_id = mgc.meeting_id
  WHERE
    mgc.id = p_content_id
    AND mgc.deleted_at IS NULL
    AND mct.deleted_at IS NULL
  LIMIT 1;
END;
$$;

-- Function to calculate total costs for a meeting
CREATE OR REPLACE FUNCTION calculate_meeting_content_costs(p_meeting_id UUID)
RETURNS TABLE (
  topics_cost_cents INTEGER,
  content_cost_cents INTEGER,
  total_cost_cents INTEGER,
  total_tokens INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY: Verify caller owns the meeting
  IF NOT EXISTS (
    SELECT 1
    FROM meetings
    WHERE meetings.id = p_meeting_id
      AND meetings.owner_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Permission denied: You do not own this meeting'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Calculate and return costs
  RETURN QUERY
  SELECT
    COALESCE(SUM(mct.cost_cents), 0)::INTEGER as topics_cost_cents,
    COALESCE(SUM(mgc.cost_cents), 0)::INTEGER as content_cost_cents,
    COALESCE(SUM(mct.cost_cents), 0)::INTEGER + COALESCE(SUM(mgc.cost_cents), 0)::INTEGER as total_cost_cents,
    COALESCE(SUM(mct.tokens_used), 0)::INTEGER + COALESCE(SUM(mgc.tokens_used), 0)::INTEGER as total_tokens
  FROM meetings m
  LEFT JOIN meeting_content_topics mct ON mct.meeting_id = m.id AND mct.deleted_at IS NULL
  LEFT JOIN meeting_generated_content mgc ON mgc.meeting_id = m.id AND mgc.deleted_at IS NULL
  WHERE m.id = p_meeting_id
  GROUP BY m.id;
END;
$$;

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Add comment to track migration
COMMENT ON TABLE meeting_content_topics IS 'Created by migration 20250128000000 - Meeting Content Tables';
