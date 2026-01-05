-- Migration: Create Transcript Retry Monitoring Views and Queries
-- Purpose: Observability and monitoring for transcript retry system
-- Date: 2025-01-25
-- NOTE: Made conditional for staging compatibility - required tables may not exist yet

DO $$
BEGIN
  -- Only create views and functions if all required tables exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fathom_transcript_retry_jobs')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meetings')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN

    -- ============================================================================
    -- 1. Create view for failed retry jobs (monitoring)
    -- ============================================================================

    EXECUTE $view$
    CREATE OR REPLACE VIEW v_failed_transcript_retries AS
    SELECT
      rtj.id,
      rtj.meeting_id,
      m.title as meeting_title,
      m.fathom_recording_id,
      rtj.user_id,
      p.email as user_email,
      rtj.recording_id,
      rtj.attempt_count,
      rtj.max_attempts,
      rtj.last_error,
      rtj.created_at,
      rtj.updated_at,
      rtj.completed_at,
      EXTRACT(EPOCH FROM (NOW() - rtj.updated_at)) / 60 as minutes_since_last_update
    FROM fathom_transcript_retry_jobs rtj
    LEFT JOIN meetings m ON m.id = rtj.meeting_id
    LEFT JOIN profiles p ON p.id = rtj.user_id
    WHERE rtj.status = 'failed'
    ORDER BY rtj.updated_at DESC
    $view$;

    -- ============================================================================
    -- 2. Create view for pending retry jobs
    -- ============================================================================

    EXECUTE $view$
    CREATE OR REPLACE VIEW v_pending_transcript_retries AS
    SELECT
      rtj.id,
      rtj.meeting_id,
      m.title as meeting_title,
      m.fathom_recording_id,
      rtj.user_id,
      p.email as user_email,
      rtj.recording_id,
      rtj.attempt_count,
      rtj.max_attempts,
      rtj.next_retry_at,
      rtj.last_error,
      rtj.created_at,
      rtj.updated_at,
      CASE
        WHEN rtj.next_retry_at <= NOW() THEN 'ready'
        ELSE 'waiting'
      END as retry_status,
      EXTRACT(EPOCH FROM (rtj.next_retry_at - NOW())) / 60 as minutes_until_retry
    FROM fathom_transcript_retry_jobs rtj
    LEFT JOIN meetings m ON m.id = rtj.meeting_id
    LEFT JOIN profiles p ON p.id = rtj.user_id
    WHERE rtj.status IN ('pending', 'processing')
    ORDER BY rtj.next_retry_at ASC
    $view$;

    -- ============================================================================
    -- 3. Create view for retry job statistics
    -- ============================================================================

    EXECUTE $view$
    CREATE OR REPLACE VIEW v_transcript_retry_stats AS
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
      COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
      COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
      COUNT(*) FILTER (WHERE status IN ('pending', 'processing') AND next_retry_at <= NOW()) as ready_to_retry,
      AVG(attempt_count) FILTER (WHERE status = 'completed') as avg_attempts_to_complete,
      MAX(attempt_count) as max_attempts_made,
      COUNT(DISTINCT user_id) as unique_users_with_retries,
      COUNT(DISTINCT meeting_id) as unique_meetings_with_retries
    FROM fathom_transcript_retry_jobs
    $view$;

    -- Grant permissions on views
    GRANT SELECT ON v_failed_transcript_retries TO authenticated;
    GRANT SELECT ON v_pending_transcript_retries TO authenticated;
    GRANT SELECT ON v_transcript_retry_stats TO authenticated;

    -- Add comments on views
    COMMENT ON VIEW v_failed_transcript_retries IS 'View of all failed transcript retry jobs for monitoring';
    COMMENT ON VIEW v_pending_transcript_retries IS 'View of all pending/processing transcript retry jobs';
    COMMENT ON VIEW v_transcript_retry_stats IS 'Aggregate statistics for transcript retry system';

    RAISE NOTICE 'Created transcript retry monitoring views';
  ELSE
    RAISE NOTICE 'Skipping transcript retry monitoring views - required tables do not exist yet';
  END IF;
END $$;

-- ============================================================================
-- 4. Create function to get retry job summary for a meeting (conditional)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meetings')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fathom_transcript_retry_jobs') THEN

    CREATE OR REPLACE FUNCTION get_meeting_retry_status(p_meeting_id UUID)
    RETURNS TABLE (
      meeting_id UUID,
      has_transcript BOOLEAN,
      retry_job_status TEXT,
      attempt_count INTEGER,
      max_attempts INTEGER,
      next_retry_at TIMESTAMPTZ,
      last_error TEXT,
      transcript_fetch_attempts INTEGER,
      last_transcript_fetch_at TIMESTAMPTZ
    )
    LANGUAGE sql
    STABLE
    AS $func$
      SELECT
        m.id as meeting_id,
        (m.transcript_text IS NOT NULL) as has_transcript,
        COALESCE(rtj.status, 'none') as retry_job_status,
        COALESCE(rtj.attempt_count, 0) as attempt_count,
        COALESCE(rtj.max_attempts, 5) as max_attempts,
        rtj.next_retry_at,
        rtj.last_error,
        COALESCE(m.transcript_fetch_attempts, 0) as transcript_fetch_attempts,
        m.last_transcript_fetch_at
      FROM meetings m
      LEFT JOIN fathom_transcript_retry_jobs rtj ON rtj.meeting_id = m.id
        AND rtj.status IN ('pending', 'processing', 'failed')
      WHERE m.id = p_meeting_id;
    $func$;

    GRANT EXECUTE ON FUNCTION get_meeting_retry_status TO authenticated;
    COMMENT ON FUNCTION get_meeting_retry_status IS 'Get retry status and transcript fetch info for a specific meeting';

    RAISE NOTICE 'Created get_meeting_retry_status function';
  ELSE
    RAISE NOTICE 'Skipping get_meeting_retry_status function - required tables do not exist yet';
  END IF;
END $$;

-- ============================================================================
-- Migration Complete
-- ============================================================================

