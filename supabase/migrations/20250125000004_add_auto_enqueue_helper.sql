-- Migration: Add Helper Function to Auto-Enqueue Retry Jobs
-- Purpose: Easier testing and bulk retry job creation
-- Date: 2025-01-25

-- ============================================================================
-- Create function to auto-enqueue retry jobs for meetings missing transcripts
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_enqueue_missing_transcript_retries(
  p_limit INTEGER DEFAULT 10,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  meeting_id UUID,
  user_id UUID,
  recording_id TEXT,
  job_id UUID,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_meeting RECORD;
  v_job_id UUID;
BEGIN
  -- Loop through meetings missing transcripts
  FOR v_meeting IN
    SELECT 
      m.id,
      m.owner_user_id,
      m.fathom_recording_id,
      COALESCE(m.transcript_fetch_attempts, 0) as attempts
    FROM meetings m
    WHERE m.transcript_text IS NULL
      AND m.fathom_recording_id IS NOT NULL
      AND m.owner_user_id IS NOT NULL
      AND (p_user_id IS NULL OR m.owner_user_id = p_user_id)
      AND (m.transcript_fetch_attempts IS NULL OR m.transcript_fetch_attempts < 5)
      AND NOT EXISTS (
        SELECT 1 FROM fathom_transcript_retry_jobs rtj
        WHERE rtj.meeting_id = m.id
          AND rtj.status IN ('pending', 'processing')
      )
    ORDER BY m.created_at DESC
    LIMIT p_limit
  LOOP
    -- Enqueue retry job
    BEGIN
      v_job_id := enqueue_transcript_retry(
        v_meeting.id,
        v_meeting.owner_user_id,
        v_meeting.fathom_recording_id,
        GREATEST(v_meeting.attempts, 1)
      );
      
      -- Return result
      meeting_id := v_meeting.id;
      user_id := v_meeting.owner_user_id;
      recording_id := v_meeting.fathom_recording_id;
      job_id := v_job_id;
      status := 'enqueued';
      RETURN NEXT;
      
    EXCEPTION WHEN OTHERS THEN
      -- Return error status
      meeting_id := v_meeting.id;
      user_id := v_meeting.owner_user_id;
      recording_id := v_meeting.fathom_recording_id;
      job_id := NULL;
      status := 'error: ' || SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
  
  RETURN;
END;
$$;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION auto_enqueue_missing_transcript_retries IS 
  'Automatically enqueue retry jobs for meetings missing transcripts. Use p_limit to control batch size, p_user_id to filter by user.';

-- ============================================================================
-- Migration Complete
-- ============================================================================

