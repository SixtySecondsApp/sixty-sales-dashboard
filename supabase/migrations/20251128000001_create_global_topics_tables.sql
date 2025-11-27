-- Global Topics Feature: Create tables for topic aggregation and tone settings
-- This migration creates the schema for the Global Topic Extractor with RAG

-- ============================================================================
-- 1. GLOBAL TOPICS TABLE (Aggregated/Clustered Topics)
-- ============================================================================
CREATE TABLE IF NOT EXISTS global_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Topic Information
  canonical_title TEXT NOT NULL,
  canonical_description TEXT,

  -- Aggregation Metadata
  source_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Relevance scoring
  frequency_score DECIMAL(5,4) NOT NULL DEFAULT 0.0, -- How often this topic appears
  recency_score DECIMAL(5,4) NOT NULL DEFAULT 0.0,   -- How recent the mentions are
  relevance_score DECIMAL(5,4) NOT NULL DEFAULT 0.0, -- Combined score

  -- Status
  is_archived BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================================
-- 2. GLOBAL TOPIC SOURCES (Junction Table: Global Topics -> Source Topics)
-- ============================================================================
CREATE TABLE IF NOT EXISTS global_topic_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  global_topic_id UUID NOT NULL REFERENCES global_topics(id) ON DELETE CASCADE,

  -- Source Information (from meeting_content_topics JSONB)
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  topic_index INTEGER NOT NULL, -- Index in the topics JSONB array

  -- Cached topic data for quick access
  topic_title TEXT NOT NULL,
  topic_description TEXT,
  timestamp_seconds INTEGER,
  fathom_url TEXT,

  -- Meeting context (denormalized for query performance)
  meeting_date TIMESTAMPTZ,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

  -- Similarity score to canonical topic
  similarity_score DECIMAL(5,4) NOT NULL DEFAULT 1.0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate source entries
  UNIQUE(global_topic_id, meeting_id, topic_index)
);

-- ============================================================================
-- 3. USER TONE SETTINGS (Per-content-type configuration)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_tone_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('social', 'blog', 'email', 'video')),

  -- Tone Configuration
  tone_style TEXT NOT NULL DEFAULT 'professional',
  formality_level INTEGER NOT NULL DEFAULT 5 CHECK (formality_level BETWEEN 1 AND 10),
  emoji_usage TEXT NOT NULL DEFAULT 'none' CHECK (emoji_usage IN ('none', 'minimal', 'moderate', 'liberal')),

  -- Brand Voice
  brand_voice_description TEXT,
  sample_phrases TEXT[],

  -- Word Lists
  words_to_avoid TEXT[] DEFAULT '{}',
  preferred_keywords TEXT[] DEFAULT '{}',

  -- Additional Settings
  max_length_override INTEGER,
  include_cta BOOLEAN DEFAULT true,
  cta_style TEXT DEFAULT 'soft',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One setting per content type per user
  UNIQUE(user_id, content_type)
);

-- ============================================================================
-- 4. TOPIC AGGREGATION QUEUE (Async Processing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS topic_aggregation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  topic_index INTEGER NOT NULL,

  -- Queue Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,

  -- Prevent duplicate queue entries
  UNIQUE(user_id, meeting_id, topic_index)
);

-- ============================================================================
-- 5. INDEXES
-- ============================================================================
DO $$
BEGIN
  -- Global Topics indexes
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_global_topics_user_id') THEN
    CREATE INDEX idx_global_topics_user_id ON global_topics(user_id) WHERE deleted_at IS NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_global_topics_relevance') THEN
    CREATE INDEX idx_global_topics_relevance ON global_topics(user_id, relevance_score DESC) WHERE deleted_at IS NULL AND is_archived = false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_global_topics_source_count') THEN
    CREATE INDEX idx_global_topics_source_count ON global_topics(user_id, source_count DESC) WHERE deleted_at IS NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_global_topics_last_seen') THEN
    CREATE INDEX idx_global_topics_last_seen ON global_topics(user_id, last_seen_at DESC) WHERE deleted_at IS NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_global_topics_search') THEN
    CREATE INDEX idx_global_topics_search ON global_topics USING GIN (to_tsvector('english', canonical_title || ' ' || COALESCE(canonical_description, '')));
  END IF;

  -- Global Topic Sources indexes
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_topic_sources_global_topic') THEN
    CREATE INDEX idx_topic_sources_global_topic ON global_topic_sources(global_topic_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_topic_sources_meeting') THEN
    CREATE INDEX idx_topic_sources_meeting ON global_topic_sources(meeting_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_topic_sources_company') THEN
    CREATE INDEX idx_topic_sources_company ON global_topic_sources(company_id) WHERE company_id IS NOT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_topic_sources_contact') THEN
    CREATE INDEX idx_topic_sources_contact ON global_topic_sources(contact_id) WHERE contact_id IS NOT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_topic_sources_date') THEN
    CREATE INDEX idx_topic_sources_date ON global_topic_sources(meeting_date DESC);
  END IF;

  -- Tone Settings indexes
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tone_settings_user') THEN
    CREATE INDEX idx_tone_settings_user ON user_tone_settings(user_id);
  END IF;

  -- Aggregation Queue indexes
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_aggregation_queue_pending') THEN
    CREATE INDEX idx_aggregation_queue_pending ON topic_aggregation_queue(user_id, status) WHERE status = 'pending';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_aggregation_queue_user_meeting') THEN
    CREATE INDEX idx_aggregation_queue_user_meeting ON topic_aggregation_queue(user_id, meeting_id);
  END IF;
END$$;

-- ============================================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE global_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_topic_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tone_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_aggregation_queue ENABLE ROW LEVEL SECURITY;

-- Global Topics RLS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own global topics' AND tablename = 'global_topics') THEN
    CREATE POLICY "Users can view their own global topics"
      ON global_topics FOR SELECT
      USING (user_id = auth.uid() AND deleted_at IS NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create their own global topics' AND tablename = 'global_topics') THEN
    CREATE POLICY "Users can create their own global topics"
      ON global_topics FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own global topics' AND tablename = 'global_topics') THEN
    CREATE POLICY "Users can update their own global topics"
      ON global_topics FOR UPDATE
      USING (user_id = auth.uid() AND deleted_at IS NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own global topics' AND tablename = 'global_topics') THEN
    CREATE POLICY "Users can delete their own global topics"
      ON global_topics FOR DELETE
      USING (user_id = auth.uid());
  END IF;
END$$;

-- Global Topic Sources RLS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view sources for their global topics' AND tablename = 'global_topic_sources') THEN
    CREATE POLICY "Users can view sources for their global topics"
      ON global_topic_sources FOR SELECT
      USING (
        global_topic_id IN (
          SELECT id FROM global_topics WHERE user_id = auth.uid() AND deleted_at IS NULL
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create sources for their global topics' AND tablename = 'global_topic_sources') THEN
    CREATE POLICY "Users can create sources for their global topics"
      ON global_topic_sources FOR INSERT
      WITH CHECK (
        global_topic_id IN (
          SELECT id FROM global_topics WHERE user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete sources for their global topics' AND tablename = 'global_topic_sources') THEN
    CREATE POLICY "Users can delete sources for their global topics"
      ON global_topic_sources FOR DELETE
      USING (
        global_topic_id IN (
          SELECT id FROM global_topics WHERE user_id = auth.uid()
        )
      );
  END IF;
END$$;

-- User Tone Settings RLS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own tone settings' AND tablename = 'user_tone_settings') THEN
    CREATE POLICY "Users can view their own tone settings"
      ON user_tone_settings FOR SELECT
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create their own tone settings' AND tablename = 'user_tone_settings') THEN
    CREATE POLICY "Users can create their own tone settings"
      ON user_tone_settings FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own tone settings' AND tablename = 'user_tone_settings') THEN
    CREATE POLICY "Users can update their own tone settings"
      ON user_tone_settings FOR UPDATE
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own tone settings' AND tablename = 'user_tone_settings') THEN
    CREATE POLICY "Users can delete their own tone settings"
      ON user_tone_settings FOR DELETE
      USING (user_id = auth.uid());
  END IF;
END$$;

-- Topic Aggregation Queue RLS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own queue items' AND tablename = 'topic_aggregation_queue') THEN
    CREATE POLICY "Users can view their own queue items"
      ON topic_aggregation_queue FOR SELECT
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create their own queue items' AND tablename = 'topic_aggregation_queue') THEN
    CREATE POLICY "Users can create their own queue items"
      ON topic_aggregation_queue FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;
END$$;

-- ============================================================================
-- 7. TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_global_topics_updated_at') THEN
    CREATE TRIGGER update_global_topics_updated_at
      BEFORE UPDATE ON global_topics
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_tone_settings_updated_at') THEN
    CREATE TRIGGER update_user_tone_settings_updated_at
      BEFORE UPDATE ON user_tone_settings
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END$$;

-- ============================================================================
-- 8. HELPER FUNCTIONS
-- ============================================================================

-- Function to queue topics for aggregation when new topics are extracted
CREATE OR REPLACE FUNCTION queue_topics_for_aggregation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  topic_count INTEGER;
  i INTEGER;
BEGIN
  -- Get the number of topics in the JSONB array
  topic_count := jsonb_array_length(NEW.topics);

  -- Queue each topic for aggregation
  FOR i IN 0..(topic_count - 1) LOOP
    INSERT INTO topic_aggregation_queue (user_id, meeting_id, topic_index, status)
    VALUES (NEW.user_id, NEW.meeting_id, i, 'pending')
    ON CONFLICT (user_id, meeting_id, topic_index) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger to auto-queue topics when extracted
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'queue_new_topics_for_aggregation') THEN
    CREATE TRIGGER queue_new_topics_for_aggregation
      AFTER INSERT OR UPDATE OF topics ON meeting_content_topics
      FOR EACH ROW
      WHEN (NEW.deleted_at IS NULL)
      EXECUTE FUNCTION queue_topics_for_aggregation();
  END IF;
END$$;

-- Function to calculate relevance score
CREATE OR REPLACE FUNCTION calculate_topic_relevance_score(
  p_frequency_score DECIMAL,
  p_recency_score DECIMAL
)
RETURNS DECIMAL
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Weighted combination: 40% frequency, 60% recency
  RETURN (p_frequency_score * 0.4) + (p_recency_score * 0.6);
END;
$$;

-- Function to get global topics with filtering
CREATE OR REPLACE FUNCTION get_global_topics_filtered(
  p_user_id UUID,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_company_ids UUID[] DEFAULT NULL,
  p_contact_ids UUID[] DEFAULT NULL,
  p_search_query TEXT DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'relevance',
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  canonical_title TEXT,
  canonical_description TEXT,
  source_count INTEGER,
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  relevance_score DECIMAL,
  companies TEXT[],
  contacts TEXT[],
  meeting_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH filtered_sources AS (
    SELECT
      gts.global_topic_id,
      gts.company_id,
      gts.contact_id,
      gts.meeting_id
    FROM global_topic_sources gts
    JOIN global_topics gt ON gt.id = gts.global_topic_id
    WHERE gt.user_id = p_user_id
      AND gt.deleted_at IS NULL
      AND gt.is_archived = false
      AND (p_date_from IS NULL OR gts.meeting_date >= p_date_from)
      AND (p_date_to IS NULL OR gts.meeting_date <= p_date_to)
      AND (p_company_ids IS NULL OR gts.company_id = ANY(p_company_ids))
      AND (p_contact_ids IS NULL OR gts.contact_id = ANY(p_contact_ids))
  ),
  topic_stats AS (
    SELECT
      fs.global_topic_id,
      array_agg(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL) as companies,
      array_agg(DISTINCT ct.name) FILTER (WHERE ct.name IS NOT NULL) as contacts,
      COUNT(DISTINCT fs.meeting_id) as meeting_count
    FROM filtered_sources fs
    LEFT JOIN companies c ON c.id = fs.company_id
    LEFT JOIN contacts ct ON ct.id = fs.contact_id
    GROUP BY fs.global_topic_id
  )
  SELECT
    gt.id,
    gt.canonical_title,
    gt.canonical_description,
    gt.source_count,
    gt.first_seen_at,
    gt.last_seen_at,
    gt.relevance_score,
    COALESCE(ts.companies, '{}') as companies,
    COALESCE(ts.contacts, '{}') as contacts,
    COALESCE(ts.meeting_count, 0) as meeting_count
  FROM global_topics gt
  JOIN topic_stats ts ON ts.global_topic_id = gt.id
  WHERE gt.user_id = p_user_id
    AND gt.deleted_at IS NULL
    AND gt.is_archived = false
    AND (
      p_search_query IS NULL
      OR to_tsvector('english', gt.canonical_title || ' ' || COALESCE(gt.canonical_description, ''))
         @@ plainto_tsquery('english', p_search_query)
    )
  ORDER BY
    CASE WHEN p_sort_by = 'relevance' THEN gt.relevance_score END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'frequency' THEN gt.source_count END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'recency' THEN gt.last_seen_at END DESC NULLS LAST,
    gt.relevance_score DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_topic_relevance_score(DECIMAL, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION get_global_topics_filtered(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID[], UUID[], TEXT, TEXT, INTEGER, INTEGER) TO authenticated;

-- ============================================================================
-- 9. UPDATE COST TRACKING FOR NEW OPERATIONS (Optional - only if table exists)
-- ============================================================================
DO $$
BEGIN
  -- Only update if cost_tracking table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cost_tracking') THEN
    -- Update the check constraint if it exists
    IF EXISTS (
      SELECT 1 FROM information_schema.check_constraints
      WHERE constraint_name = 'cost_tracking_operation_check'
    ) THEN
      ALTER TABLE cost_tracking DROP CONSTRAINT cost_tracking_operation_check;
    END IF;

    -- Add new operation types to cost_tracking
    ALTER TABLE cost_tracking ADD CONSTRAINT cost_tracking_operation_check
      CHECK (operation IN (
        'extract_topics',
        'generate_content',
        'aggregate_topics',
        'generate_content_with_tone',
        'semantic_search'
      ));
  END IF;
END$$;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Global Topics schema migration completed successfully!
