-- Global Topics Feature: Helper Functions
-- Additional functions and triggers for global topics aggregation

-- ============================================================================
-- 1. RPC FUNCTION: Get Global Topics Statistics
-- ============================================================================
CREATE OR REPLACE FUNCTION get_global_topics_stats(p_user_id UUID)
RETURNS TABLE (
  total_topics BIGINT,
  total_meetings BIGINT,
  total_companies BIGINT,
  total_contacts BIGINT,
  avg_sources_per_topic DECIMAL,
  newest_topic_date TIMESTAMPTZ,
  oldest_topic_date TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(DISTINCT gt.id) FROM global_topics gt WHERE gt.user_id = p_user_id AND gt.deleted_at IS NULL AND gt.is_archived = false) as total_topics,
    (SELECT COUNT(DISTINCT gts.meeting_id) FROM global_topic_sources gts JOIN global_topics gt ON gt.id = gts.global_topic_id WHERE gt.user_id = p_user_id AND gt.deleted_at IS NULL) as total_meetings,
    (SELECT COUNT(DISTINCT gts.company_id) FROM global_topic_sources gts JOIN global_topics gt ON gt.id = gts.global_topic_id WHERE gt.user_id = p_user_id AND gt.deleted_at IS NULL AND gts.company_id IS NOT NULL) as total_companies,
    (SELECT COUNT(DISTINCT gts.contact_id) FROM global_topic_sources gts JOIN global_topics gt ON gt.id = gts.global_topic_id WHERE gt.user_id = p_user_id AND gt.deleted_at IS NULL AND gts.contact_id IS NOT NULL) as total_contacts,
    (SELECT ROUND(AVG(gt.source_count)::DECIMAL, 2) FROM global_topics gt WHERE gt.user_id = p_user_id AND gt.deleted_at IS NULL AND gt.is_archived = false) as avg_sources_per_topic,
    (SELECT MAX(gt.last_seen_at) FROM global_topics gt WHERE gt.user_id = p_user_id AND gt.deleted_at IS NULL) as newest_topic_date,
    (SELECT MIN(gt.first_seen_at) FROM global_topics gt WHERE gt.user_id = p_user_id AND gt.deleted_at IS NULL) as oldest_topic_date;
END;
$$;

GRANT EXECUTE ON FUNCTION get_global_topics_stats(UUID) TO authenticated;

-- ============================================================================
-- 2. RPC FUNCTION: Increment Source Count (Atomic)
-- ============================================================================
CREATE OR REPLACE FUNCTION increment_source_count(topic_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE global_topics
  SET source_count = source_count + 1,
      updated_at = NOW()
  WHERE id = topic_id
  RETURNING source_count INTO new_count;

  RETURN new_count;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_source_count(UUID) TO service_role;

-- ============================================================================
-- 3. RPC FUNCTION: Get Topic Sources with Meeting Details
-- ============================================================================
CREATE OR REPLACE FUNCTION get_topic_sources_with_details(
  p_global_topic_id UUID,
  p_limit INTEGER DEFAULT 10,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  meeting_id UUID,
  meeting_title TEXT,
  meeting_date TIMESTAMPTZ,
  company_name TEXT,
  contact_name TEXT,
  topic_title TEXT,
  topic_description TEXT,
  timestamp_seconds INTEGER,
  fathom_url TEXT,
  similarity_score DECIMAL
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    gts.meeting_id,
    m.title as meeting_title,
    gts.meeting_date,
    c.name as company_name,
    ct.name as contact_name,
    gts.topic_title,
    gts.topic_description,
    gts.timestamp_seconds,
    gts.fathom_url,
    gts.similarity_score
  FROM global_topic_sources gts
  JOIN meetings m ON m.id = gts.meeting_id
  LEFT JOIN companies c ON c.id = gts.company_id
  LEFT JOIN contacts ct ON ct.id = gts.contact_id
  WHERE gts.global_topic_id = p_global_topic_id
  ORDER BY gts.meeting_date DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_topic_sources_with_details(UUID, INTEGER, INTEGER) TO authenticated;

-- ============================================================================
-- 4. RPC FUNCTION: Archive/Unarchive Global Topic
-- ============================================================================
CREATE OR REPLACE FUNCTION toggle_topic_archive(p_topic_id UUID, p_archive BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE global_topics
  SET is_archived = p_archive,
      updated_at = NOW()
  WHERE id = p_topic_id
    AND user_id = auth.uid();

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION toggle_topic_archive(UUID, BOOLEAN) TO authenticated;

-- ============================================================================
-- 5. RPC FUNCTION: Merge Two Global Topics
-- ============================================================================
CREATE OR REPLACE FUNCTION merge_global_topics(
  p_source_topic_id UUID,
  p_target_topic_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_source_count INTEGER;
BEGIN
  -- Verify both topics belong to the current user
  SELECT user_id INTO v_user_id
  FROM global_topics
  WHERE id = p_source_topic_id
    AND user_id = auth.uid()
    AND deleted_at IS NULL;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Source topic not found or not owned by user';
  END IF;

  SELECT user_id INTO v_user_id
  FROM global_topics
  WHERE id = p_target_topic_id
    AND user_id = auth.uid()
    AND deleted_at IS NULL;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Target topic not found or not owned by user';
  END IF;

  -- Move all sources from source to target
  UPDATE global_topic_sources
  SET global_topic_id = p_target_topic_id
  WHERE global_topic_id = p_source_topic_id;

  -- Update target topic stats
  SELECT COUNT(*) INTO v_source_count
  FROM global_topic_sources
  WHERE global_topic_id = p_target_topic_id;

  UPDATE global_topics
  SET source_count = v_source_count,
      last_seen_at = (SELECT MAX(meeting_date) FROM global_topic_sources WHERE global_topic_id = p_target_topic_id),
      updated_at = NOW()
  WHERE id = p_target_topic_id;

  -- Soft delete the source topic
  UPDATE global_topics
  SET deleted_at = NOW(),
      updated_at = NOW()
  WHERE id = p_source_topic_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION merge_global_topics(UUID, UUID) TO authenticated;

-- ============================================================================
-- 6. RPC FUNCTION: Get Pending Aggregation Count
-- ============================================================================
CREATE OR REPLACE FUNCTION get_pending_aggregation_count(p_user_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM topic_aggregation_queue
    WHERE user_id = p_user_id
      AND status = 'pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_pending_aggregation_count(UUID) TO authenticated;

-- ============================================================================
-- 7. Add Index for meeting owner lookup on global topic sources
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_topic_sources_meeting_date_desc') THEN
    CREATE INDEX idx_topic_sources_meeting_date_desc ON global_topic_sources(meeting_date DESC NULLS LAST);
  END IF;
END$$;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Global Topics helper functions migration completed successfully!
