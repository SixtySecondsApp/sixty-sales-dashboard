-- Migration: Create Meeting Intelligence RAG Tables
-- Purpose: Support Google File Search integration for cross-meeting semantic search
-- Date: 2025-11-27

-- =============================================================================
-- Table: user_file_search_stores
-- Purpose: Track each user's Google File Search store reference
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_file_search_stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  store_name TEXT NOT NULL,           -- Google File Search store ID (e.g., "fileSearchStores/abc123")
  display_name TEXT,                  -- Human-readable name
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'syncing', 'error')),
  total_files INTEGER DEFAULT 0,      -- Count of indexed files
  last_sync_at TIMESTAMPTZ,           -- Last successful sync timestamp
  error_message TEXT,                 -- Last error message if status='error'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_user_file_search_stores_user_id
  ON user_file_search_stores(user_id);

-- =============================================================================
-- Table: meeting_file_search_index
-- Purpose: Track which meetings are indexed in File Search
-- =============================================================================

CREATE TABLE IF NOT EXISTS meeting_file_search_index (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,           -- Reference to user's store
  file_name TEXT,                     -- Google file reference (e.g., "files/xyz")
  content_hash TEXT,                  -- MD5 hash for change detection
  indexed_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'indexing', 'indexed', 'failed')),
  error_message TEXT,                 -- Error details if status='failed'
  metadata JSONB DEFAULT '{}',        -- Additional indexing metadata
  UNIQUE(meeting_id, user_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_meeting_file_search_index_meeting_id
  ON meeting_file_search_index(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_file_search_index_user_id
  ON meeting_file_search_index(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_file_search_index_status
  ON meeting_file_search_index(status);

-- =============================================================================
-- Table: meeting_index_queue
-- Purpose: Queue for async meeting indexing with retry support
-- =============================================================================

CREATE TABLE IF NOT EXISTS meeting_index_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 0,         -- Higher = process first
  attempts INTEGER DEFAULT 0,         -- Retry count
  max_attempts INTEGER DEFAULT 3,     -- Max retries before giving up
  last_attempt_at TIMESTAMPTZ,        -- For exponential backoff
  error_message TEXT,                 -- Last error for debugging
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meeting_id)
);

-- Index for queue processing
CREATE INDEX IF NOT EXISTS idx_meeting_index_queue_priority
  ON meeting_index_queue(priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_meeting_index_queue_user_id
  ON meeting_index_queue(user_id);

-- =============================================================================
-- Table: meeting_intelligence_queries
-- Purpose: Log queries for analytics and debugging (optional)
-- =============================================================================

CREATE TABLE IF NOT EXISTS meeting_intelligence_queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  parsed_semantic_query TEXT,
  parsed_filters JSONB,
  results_count INTEGER,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user query history
CREATE INDEX IF NOT EXISTS idx_meeting_intelligence_queries_user_id
  ON meeting_intelligence_queries(user_id, created_at DESC);

-- =============================================================================
-- Row Level Security (RLS) Policies
-- =============================================================================

ALTER TABLE user_file_search_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_file_search_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_index_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_intelligence_queries ENABLE ROW LEVEL SECURITY;

-- user_file_search_stores: Users can only access their own store
CREATE POLICY "Users can view own file search store"
  ON user_file_search_stores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own file search store"
  ON user_file_search_stores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own file search store"
  ON user_file_search_stores FOR UPDATE
  USING (auth.uid() = user_id);

-- meeting_file_search_index: Users can only access their own index entries
CREATE POLICY "Users can view own meeting index"
  ON meeting_file_search_index FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meeting index"
  ON meeting_file_search_index FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meeting index"
  ON meeting_file_search_index FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own meeting index"
  ON meeting_file_search_index FOR DELETE
  USING (auth.uid() = user_id);

-- meeting_index_queue: Users can only access their own queue items
CREATE POLICY "Users can view own queue items"
  ON meeting_index_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own queue items"
  ON meeting_index_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own queue items"
  ON meeting_index_queue FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own queue items"
  ON meeting_index_queue FOR DELETE
  USING (auth.uid() = user_id);

-- meeting_intelligence_queries: Users can only access their own queries
CREATE POLICY "Users can view own queries"
  ON meeting_intelligence_queries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own queries"
  ON meeting_intelligence_queries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- Service Role Policies (for Edge Functions)
-- =============================================================================

-- Allow service role to manage all records (for edge functions)
CREATE POLICY "Service role can manage all file search stores"
  ON user_file_search_stores FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role can manage all meeting indexes"
  ON meeting_file_search_index FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role can manage all queue items"
  ON meeting_index_queue FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role can manage all queries"
  ON meeting_intelligence_queries FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =============================================================================
-- Trigger: Auto-queue meetings when transcript is populated
-- =============================================================================

CREATE OR REPLACE FUNCTION queue_meeting_for_indexing()
RETURNS TRIGGER AS $$
BEGIN
  -- Only queue when transcript goes from NULL/empty to having content
  IF (OLD.transcript_text IS NULL OR OLD.transcript_text = '')
     AND (NEW.transcript_text IS NOT NULL AND NEW.transcript_text != '')
     AND LENGTH(NEW.transcript_text) > 100 THEN

    INSERT INTO meeting_index_queue (meeting_id, user_id, priority)
    VALUES (NEW.id, NEW.owner_user_id, 0)
    ON CONFLICT (meeting_id) DO UPDATE SET
      attempts = 0,
      error_message = NULL,
      created_at = NOW();

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on meetings table
DROP TRIGGER IF EXISTS trigger_queue_meeting_index ON meetings;
CREATE TRIGGER trigger_queue_meeting_index
  AFTER UPDATE ON meetings
  FOR EACH ROW
  WHEN (OLD.transcript_text IS DISTINCT FROM NEW.transcript_text)
  EXECUTE FUNCTION queue_meeting_for_indexing();

-- =============================================================================
-- Helper Function: Get index status for a user
-- =============================================================================

CREATE OR REPLACE FUNCTION get_meeting_index_status(p_user_id UUID)
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
  LEFT JOIN meeting_file_search_index mfi ON m.id = mfi.meeting_id AND mfi.user_id = p_user_id
  LEFT JOIN meeting_index_queue miq ON m.id = miq.meeting_id
  WHERE m.owner_user_id = p_user_id
    AND m.transcript_text IS NOT NULL
    AND m.transcript_text != '';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Comments for documentation
-- =============================================================================

COMMENT ON TABLE user_file_search_stores IS 'Stores reference to each user''s Google File Search store for meeting RAG';
COMMENT ON TABLE meeting_file_search_index IS 'Tracks which meetings have been indexed to File Search';
COMMENT ON TABLE meeting_index_queue IS 'Queue for async processing of meeting indexing jobs';
COMMENT ON TABLE meeting_intelligence_queries IS 'Audit log of user queries for analytics';
COMMENT ON FUNCTION queue_meeting_for_indexing IS 'Auto-queues meetings for File Search indexing when transcript is populated';
COMMENT ON FUNCTION get_meeting_index_status IS 'Returns indexing status summary for a user';
