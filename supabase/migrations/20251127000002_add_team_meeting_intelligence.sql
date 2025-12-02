-- Migration: Add Team-wide Meeting Intelligence Support
-- Purpose: Enable searching across team members' meetings with filtering
-- Date: 2025-11-27

-- =============================================================================
-- Updated Helper Function: Get index status with optional user filter
-- p_target_user_id: NULL = all team, specific UUID = that user only
-- =============================================================================

CREATE OR REPLACE FUNCTION get_meeting_index_status_v2(
  p_requesting_user_id UUID,
  p_target_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  indexed_count BIGINT,
  total_meetings BIGINT,
  pending_count BIGINT,
  failed_count BIGINT,
  last_indexed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(mfi.id) FILTER (WHERE mfi.status = 'indexed') as indexed_count,
    COUNT(DISTINCT m.id) as total_meetings,
    COUNT(miq.id) as pending_count,
    COUNT(mfi.id) FILTER (WHERE mfi.status = 'failed') as failed_count,
    MAX(mfi.indexed_at) as last_indexed_at
  FROM meetings m
  LEFT JOIN meeting_file_search_index mfi ON m.id = mfi.meeting_id
  LEFT JOIN meeting_index_queue miq ON m.id = miq.meeting_id
  WHERE
    -- Filter by target user if specified, otherwise all meetings
    (p_target_user_id IS NULL OR m.owner_user_id = p_target_user_id)
    AND m.transcript_text IS NOT NULL
    AND m.transcript_text != '';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_meeting_index_status_v2 IS 'Returns indexing status summary - pass NULL for p_target_user_id to get all team meetings';

-- =============================================================================
-- Function: Get team members with meeting counts (DEPRECATED - use get_team_members_with_connected_accounts)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_team_members_with_meetings()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  meeting_count BIGINT,
  indexed_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id as user_id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)) as full_name,
    COUNT(DISTINCT m.id) FILTER (WHERE m.transcript_text IS NOT NULL AND m.transcript_text != '') as meeting_count,
    COUNT(DISTINCT mfi.meeting_id) FILTER (WHERE mfi.status = 'indexed') as indexed_count
  FROM auth.users u
  LEFT JOIN meetings m ON m.owner_user_id = u.id
  LEFT JOIN meeting_file_search_index mfi ON m.id = mfi.meeting_id
  GROUP BY u.id, u.email, u.raw_user_meta_data
  HAVING COUNT(DISTINCT m.id) FILTER (WHERE m.transcript_text IS NOT NULL AND m.transcript_text != '') > 0
  ORDER BY full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_team_members_with_meetings IS 'Returns team members who have meetings with transcripts (deprecated)';

-- =============================================================================
-- Function: Get team members with CONNECTED Fathom accounts
-- Only returns users who have active Fathom integrations AND meetings with transcripts
-- =============================================================================

CREATE OR REPLACE FUNCTION get_team_members_with_connected_accounts()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  meeting_count BIGINT,
  indexed_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fi.user_id,
    COALESCE(fi.fathom_user_email, u.email) as email,
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(COALESCE(fi.fathom_user_email, u.email), '@', 1)) as full_name,
    COUNT(DISTINCT m.id) FILTER (WHERE m.transcript_text IS NOT NULL AND m.transcript_text != '') as meeting_count,
    COUNT(DISTINCT mfi.meeting_id) FILTER (WHERE mfi.status = 'indexed') as indexed_count
  FROM fathom_integrations fi
  INNER JOIN auth.users u ON fi.user_id = u.id
  LEFT JOIN meetings m ON m.owner_user_id = fi.user_id
  LEFT JOIN meeting_file_search_index mfi ON m.id = mfi.meeting_id
  WHERE fi.is_active = true
  GROUP BY fi.user_id, fi.fathom_user_email, u.email, u.raw_user_meta_data
  HAVING COUNT(DISTINCT m.id) FILTER (WHERE m.transcript_text IS NOT NULL AND m.transcript_text != '') > 0
  ORDER BY full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_team_members_with_connected_accounts IS 'Returns team members with active Fathom integrations who have meetings with transcripts';

-- =============================================================================
-- Update meeting_file_search_index to support team-wide indexing
-- Add index on meeting owner for team queries
-- =============================================================================

-- Add meeting_owner_id column for faster team queries (denormalized for performance)
ALTER TABLE meeting_file_search_index
ADD COLUMN IF NOT EXISTS meeting_owner_id UUID REFERENCES auth.users(id);

-- Create index for team-wide queries
CREATE INDEX IF NOT EXISTS idx_meeting_file_search_index_owner
ON meeting_file_search_index(meeting_owner_id);

-- Backfill meeting_owner_id from meetings table
UPDATE meeting_file_search_index mfi
SET meeting_owner_id = m.owner_user_id
FROM meetings m
WHERE mfi.meeting_id = m.id
AND mfi.meeting_owner_id IS NULL;

-- =============================================================================
-- Function: Search meetings with team filter
-- Returns meeting IDs matching filters for a specific user or all team
-- =============================================================================

CREATE OR REPLACE FUNCTION search_meetings_by_owner(
  p_owner_user_id UUID DEFAULT NULL,  -- NULL = all team
  p_sentiment TEXT DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_company_id UUID DEFAULT NULL,
  p_has_action_items BOOLEAN DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  meeting_id UUID,
  title TEXT,
  meeting_date DATE,
  owner_user_id UUID,
  owner_name TEXT,
  company_name TEXT,
  sentiment_score NUMERIC,
  has_action_items BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id as meeting_id,
    m.title,
    DATE(m.meeting_start) as meeting_date,
    m.owner_user_id,
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)) as owner_name,
    c.name as company_name,
    m.sentiment_score,
    EXISTS(SELECT 1 FROM meeting_action_items mai WHERE mai.meeting_id = m.id) as has_action_items
  FROM meetings m
  LEFT JOIN auth.users u ON m.owner_user_id = u.id
  LEFT JOIN companies c ON m.company_id = c.id
  WHERE
    m.transcript_text IS NOT NULL
    AND m.transcript_text != ''
    AND (p_owner_user_id IS NULL OR m.owner_user_id = p_owner_user_id)
    AND (p_sentiment IS NULL OR
         (p_sentiment = 'positive' AND m.sentiment_score > 0.25) OR
         (p_sentiment = 'negative' AND m.sentiment_score < -0.25) OR
         (p_sentiment = 'neutral' AND m.sentiment_score BETWEEN -0.25 AND 0.25))
    AND (p_date_from IS NULL OR DATE(m.meeting_start) >= p_date_from)
    AND (p_date_to IS NULL OR DATE(m.meeting_start) <= p_date_to)
    AND (p_company_id IS NULL OR m.company_id = p_company_id)
    AND (p_has_action_items IS NULL OR
         (p_has_action_items = true AND EXISTS(SELECT 1 FROM meeting_action_items mai WHERE mai.meeting_id = m.id)) OR
         (p_has_action_items = false AND NOT EXISTS(SELECT 1 FROM meeting_action_items mai WHERE mai.meeting_id = m.id)))
  ORDER BY m.meeting_start DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION search_meetings_by_owner IS 'Search meetings with optional owner filter - pass NULL for all team meetings';
