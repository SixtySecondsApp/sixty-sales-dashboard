-- Migration: Organization-based File Search Stores
-- Purpose: One File Search Store per organization for multi-tenant isolation
-- Date: 2025-11-27

-- =============================================================================
-- Table: org_file_search_stores
-- Purpose: Track each organization's Google File Search store
-- =============================================================================

CREATE TABLE IF NOT EXISTS org_file_search_stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL UNIQUE,
  store_name TEXT NOT NULL,
  display_name TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'syncing', 'error')),
  total_files INTEGER DEFAULT 0,
  last_sync_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_file_search_stores_org_id
  ON org_file_search_stores(org_id);

-- =============================================================================
-- Update meeting_file_search_index to include org_id
-- =============================================================================

ALTER TABLE meeting_file_search_index
ADD COLUMN IF NOT EXISTS org_id UUID;

CREATE INDEX IF NOT EXISTS idx_meeting_file_search_index_org_id
  ON meeting_file_search_index(org_id);

-- =============================================================================
-- Helper function: Get user's organization
-- =============================================================================

CREATE OR REPLACE FUNCTION get_user_org_id(p_user_id UUID)
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT org_id
    FROM organization_memberships
    WHERE user_id = p_user_id
    ORDER BY created_at ASC
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Helper function: Get org's File Search store name
-- =============================================================================

CREATE OR REPLACE FUNCTION get_org_file_search_store(p_org_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT store_name
    FROM org_file_search_stores
    WHERE org_id = p_org_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Updated index status function for org-based queries
-- =============================================================================

CREATE OR REPLACE FUNCTION get_org_meeting_index_status(
  p_org_id UUID,
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
  INNER JOIN organization_memberships om ON m.owner_user_id = om.user_id AND om.org_id = p_org_id
  LEFT JOIN meeting_file_search_index mfi ON m.id = mfi.meeting_id
  LEFT JOIN meeting_index_queue miq ON m.id = miq.meeting_id
  WHERE
    (p_target_user_id IS NULL OR m.owner_user_id = p_target_user_id)
    AND m.transcript_text IS NOT NULL
    AND m.transcript_text != '';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Get team members within an organization
-- =============================================================================

CREATE OR REPLACE FUNCTION get_org_team_members(p_org_id UUID)
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
    om.user_id,
    COALESCE(fi.fathom_user_email, u.email) as email,
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(COALESCE(fi.fathom_user_email, u.email), '@', 1)) as full_name,
    COUNT(DISTINCT m.id) FILTER (WHERE m.transcript_text IS NOT NULL AND m.transcript_text != '') as meeting_count,
    COUNT(DISTINCT mfi.meeting_id) FILTER (WHERE mfi.status = 'indexed') as indexed_count
  FROM organization_memberships om
  INNER JOIN auth.users u ON om.user_id = u.id
  LEFT JOIN fathom_integrations fi ON om.user_id = fi.user_id AND fi.is_active = true
  LEFT JOIN meetings m ON m.owner_user_id = om.user_id
  LEFT JOIN meeting_file_search_index mfi ON m.id = mfi.meeting_id
  WHERE om.org_id = p_org_id
  GROUP BY om.user_id, fi.fathom_user_email, u.email, u.raw_user_meta_data
  HAVING COUNT(DISTINCT m.id) FILTER (WHERE m.transcript_text IS NOT NULL AND m.transcript_text != '') > 0
  ORDER BY full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- RLS Policies for org_file_search_stores
-- =============================================================================

ALTER TABLE org_file_search_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org store"
  ON org_file_search_stores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = org_file_search_stores.org_id
        AND organization_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all org stores"
  ON org_file_search_stores FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE org_file_search_stores IS 'One Google File Search store per organization for multi-tenant isolation';
COMMENT ON FUNCTION get_user_org_id IS 'Returns the primary organization ID for a user';
COMMENT ON FUNCTION get_org_file_search_store IS 'Returns the File Search store name for an organization';
COMMENT ON FUNCTION get_org_meeting_index_status IS 'Returns indexing status for an organization';
COMMENT ON FUNCTION get_org_team_members IS 'Returns team members within an organization with meeting counts';
