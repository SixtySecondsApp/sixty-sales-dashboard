-- Apply Content Tab Migrations Manually
-- This script applies only the Content Tab migrations, handling existing objects gracefully

-- ============================================================================
-- MIGRATION 1: Create Meeting Content Tables
-- From: 20250128000000_create_meeting_content_tables.sql
-- ============================================================================

-- Table 1: meeting_content_topics
CREATE TABLE IF NOT EXISTS meeting_content_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  extraction_version INTEGER NOT NULL DEFAULT 1,
  model_used TEXT NOT NULL,
  tokens_used INTEGER CHECK (tokens_used >= 0),
  cost_cents INTEGER CHECK (cost_cents >= 0),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT topics_json_check CHECK (jsonb_typeof(topics) = 'array'),
  CONSTRAINT extraction_version_positive CHECK (extraction_version > 0)
);

-- Table 2: meeting_generated_content
CREATE TABLE IF NOT EXISTS meeting_generated_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('social', 'blog', 'video', 'email')),
  title TEXT,
  content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  parent_id UUID REFERENCES meeting_generated_content(id) ON DELETE SET NULL,
  is_latest BOOLEAN NOT NULL DEFAULT true,
  model_used TEXT NOT NULL,
  prompt_used TEXT,
  tokens_used INTEGER CHECK (tokens_used >= 0),
  cost_cents INTEGER CHECK (cost_cents >= 0),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT version_positive CHECK (version > 0)
);

-- Table 3: content_topic_links
CREATE TABLE IF NOT EXISTS content_topic_links (
  content_id UUID NOT NULL REFERENCES meeting_generated_content(id) ON DELETE CASCADE,
  topic_index INTEGER NOT NULL CHECK (topic_index >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (content_id, topic_index)
);

-- Indexes (with IF NOT EXISTS where possible)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_topics_meeting_id') THEN
    CREATE INDEX idx_topics_meeting_id ON meeting_content_topics(meeting_id) WHERE deleted_at IS NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_topics_user_id') THEN
    CREATE INDEX idx_topics_user_id ON meeting_content_topics(user_id) WHERE deleted_at IS NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_topics_created_by') THEN
    CREATE INDEX idx_topics_created_by ON meeting_content_topics(created_by) WHERE deleted_at IS NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_topics_created_at') THEN
    CREATE INDEX idx_topics_created_at ON meeting_content_topics(created_at DESC) WHERE deleted_at IS NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_topics_extraction_version') THEN
    CREATE INDEX idx_topics_extraction_version ON meeting_content_topics(meeting_id, extraction_version DESC) WHERE deleted_at IS NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_topics_jsonb_search') THEN
    CREATE INDEX idx_topics_jsonb_search ON meeting_content_topics USING GIN (topics) WHERE deleted_at IS NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_meeting_id') THEN
    CREATE INDEX idx_content_meeting_id ON meeting_generated_content(meeting_id) WHERE deleted_at IS NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_type') THEN
    CREATE INDEX idx_content_type ON meeting_generated_content(content_type) WHERE deleted_at IS NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_created_by') THEN
    CREATE INDEX idx_content_created_by ON meeting_generated_content(created_by) WHERE deleted_at IS NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_is_latest') THEN
    CREATE INDEX idx_content_is_latest ON meeting_generated_content(is_latest) WHERE is_latest = true AND deleted_at IS NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_version') THEN
    CREATE INDEX idx_content_version ON meeting_generated_content(meeting_id, content_type, version DESC) WHERE deleted_at IS NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_created_at') THEN
    CREATE INDEX idx_content_created_at ON meeting_generated_content(created_at DESC) WHERE deleted_at IS NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_links_content_id') THEN
    CREATE INDEX idx_links_content_id ON content_topic_links(content_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_links_topic_index') THEN
    CREATE INDEX idx_links_topic_index ON content_topic_links(topic_index);
  END IF;
END$$;

-- Enable RLS
ALTER TABLE meeting_content_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_topic_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view topics for their meetings' AND tablename = 'meeting_content_topics') THEN
    CREATE POLICY "Users can view topics for their meetings"
      ON meeting_content_topics FOR SELECT
      USING (
        deleted_at IS NULL AND
        meeting_id IN (
          SELECT id FROM meetings WHERE owner_user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create topics for their meetings' AND tablename = 'meeting_content_topics') THEN
    CREATE POLICY "Users can create topics for their meetings"
      ON meeting_content_topics FOR INSERT
      WITH CHECK (
        created_by = auth.uid() AND
        meeting_id IN (
          SELECT id FROM meetings WHERE owner_user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own topics' AND tablename = 'meeting_content_topics') THEN
    CREATE POLICY "Users can update their own topics"
      ON meeting_content_topics FOR UPDATE
      USING (
        deleted_at IS NULL AND
        created_by = auth.uid() AND
        meeting_id IN (
          SELECT id FROM meetings WHERE owner_user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can soft delete their own topics' AND tablename = 'meeting_content_topics') THEN
    CREATE POLICY "Users can soft delete their own topics"
      ON meeting_content_topics FOR UPDATE
      USING (created_by = auth.uid())
      WITH CHECK (deleted_at IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view content for their meetings' AND tablename = 'meeting_generated_content') THEN
    CREATE POLICY "Users can view content for their meetings"
      ON meeting_generated_content FOR SELECT
      USING (
        deleted_at IS NULL AND
        meeting_id IN (
          SELECT id FROM meetings WHERE owner_user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create content for their meetings' AND tablename = 'meeting_generated_content') THEN
    CREATE POLICY "Users can create content for their meetings"
      ON meeting_generated_content FOR INSERT
      WITH CHECK (
        created_by = auth.uid() AND
        meeting_id IN (
          SELECT id FROM meetings WHERE owner_user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own content' AND tablename = 'meeting_generated_content') THEN
    CREATE POLICY "Users can update their own content"
      ON meeting_generated_content FOR UPDATE
      USING (
        deleted_at IS NULL AND
        created_by = auth.uid() AND
        meeting_id IN (
          SELECT id FROM meetings WHERE owner_user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can soft delete their own content' AND tablename = 'meeting_generated_content') THEN
    CREATE POLICY "Users can soft delete their own content"
      ON meeting_generated_content FOR UPDATE
      USING (created_by = auth.uid())
      WITH CHECK (deleted_at IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view links for their content' AND tablename = 'content_topic_links') THEN
    CREATE POLICY "Users can view links for their content"
      ON content_topic_links FOR SELECT
      USING (
        content_id IN (
          SELECT id FROM meeting_generated_content
          WHERE deleted_at IS NULL AND created_by = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create links for their content' AND tablename = 'content_topic_links') THEN
    CREATE POLICY "Users can create links for their content"
      ON content_topic_links FOR INSERT
      WITH CHECK (
        content_id IN (
          SELECT id FROM meeting_generated_content
          WHERE created_by = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete links for their content' AND tablename = 'content_topic_links') THEN
    CREATE POLICY "Users can delete links for their content"
      ON content_topic_links FOR DELETE
      USING (
        content_id IN (
          SELECT id FROM meeting_generated_content
          WHERE created_by = auth.uid()
        )
      );
  END IF;
END$$;

-- Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_meeting_content_topics_updated_at') THEN
    CREATE TRIGGER update_meeting_content_topics_updated_at
      BEFORE UPDATE ON meeting_content_topics
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_meeting_generated_content_updated_at') THEN
    CREATE TRIGGER update_meeting_generated_content_updated_at
      BEFORE UPDATE ON meeting_generated_content
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END$$;

-- Helper Functions (STABLE volatility, no SECURITY DEFINER)
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
STABLE
AS $$
BEGIN
  -- RLS policies automatically filter by ownership
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

CREATE OR REPLACE FUNCTION get_content_with_topics(p_content_id UUID)
RETURNS TABLE (
  content_id UUID,
  content TEXT,
  title TEXT,
  content_type TEXT,
  topics JSONB
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- RLS policies automatically filter by ownership
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

CREATE OR REPLACE FUNCTION calculate_meeting_content_costs(p_meeting_id UUID)
RETURNS TABLE (
  topics_cost_cents INTEGER,
  content_cost_cents INTEGER,
  total_cost_cents INTEGER,
  total_tokens INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- RLS policies automatically filter by ownership
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
-- MIGRATION 2: Add Security Tables
-- From: 20250128100000_add_security_tables.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS cost_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  operation TEXT NOT NULL CHECK (operation IN ('extract_topics', 'generate_content')),
  cost_cents INTEGER NOT NULL CHECK (cost_cents >= 0),
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'AUTH_FAILURE',
    'RATE_LIMIT',
    'COST_ALERT',
    'SUSPICIOUS_PATTERN',
    'UNAUTHORIZED_ACCESS'
  )),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  details TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for cost_tracking and security_events
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_cost_tracking_user_id') THEN
    CREATE INDEX idx_cost_tracking_user_id ON cost_tracking(user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_cost_tracking_created_at') THEN
    CREATE INDEX idx_cost_tracking_created_at ON cost_tracking(created_at DESC);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_cost_tracking_user_date') THEN
    CREATE INDEX idx_cost_tracking_user_date ON cost_tracking(user_id, DATE(created_at));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_security_events_type') THEN
    CREATE INDEX idx_security_events_type ON security_events(event_type);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_security_events_severity') THEN
    CREATE INDEX idx_security_events_severity ON security_events(severity);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_security_events_created_at') THEN
    CREATE INDEX idx_security_events_created_at ON security_events(created_at DESC);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_security_events_user_id') THEN
    CREATE INDEX idx_security_events_user_id ON security_events(user_id) WHERE user_id IS NOT NULL;
  END IF;
END$$;

-- Enable RLS
ALTER TABLE cost_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own costs' AND tablename = 'cost_tracking') THEN
    CREATE POLICY "Users can view their own costs"
      ON cost_tracking FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END$$;

-- Cost tracking helper functions (STABLE volatility, no SECURITY DEFINER)
CREATE OR REPLACE FUNCTION get_user_hourly_cost(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  hourly_cost INTEGER;
BEGIN
  SELECT COALESCE(SUM(cost_cents), 0)
  INTO hourly_cost
  FROM cost_tracking
  WHERE user_id = p_user_id
    AND created_at >= NOW() - INTERVAL '1 hour';

  RETURN hourly_cost;
END;
$$;

CREATE OR REPLACE FUNCTION get_user_daily_cost(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  daily_cost INTEGER;
BEGIN
  SELECT COALESCE(SUM(cost_cents), 0)
  INTO daily_cost
  FROM cost_tracking
  WHERE user_id = p_user_id
    AND DATE(created_at) = CURRENT_DATE;

  RETURN daily_cost;
END;
$$;

CREATE OR REPLACE FUNCTION get_global_hourly_cost()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  global_cost INTEGER;
BEGIN
  SELECT COALESCE(SUM(cost_cents), 0)
  INTO global_cost
  FROM cost_tracking
  WHERE created_at >= NOW() - INTERVAL '1 hour';

  RETURN global_cost;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_hourly_cost(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_daily_cost(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_global_hourly_cost() TO service_role;

-- ============================================================================
-- Content Tab Migrations Applied Successfully
-- ============================================================================

RAISE NOTICE 'Content Tab migrations applied successfully!';
