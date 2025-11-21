-- Migration: Create Fathom Transcript Retry Jobs System
-- Purpose: Persistent retry queue for transcript fetching with 5×5min backoff
-- Date: 2025-01-25

-- ============================================================================
-- 1. Create transcript retry jobs table
-- ============================================================================

CREATE TABLE IF NOT EXISTS fathom_transcript_retry_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recording_id TEXT NOT NULL,
  attempt_count INTEGER DEFAULT 0 NOT NULL,
  max_attempts INTEGER DEFAULT 5 NOT NULL,
  next_retry_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ
);

-- ============================================================================
-- 2. Create indexes for efficient querying
-- ============================================================================

-- Ensure one job per meeting at a time (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_transcript_retry_jobs_unique_pending 
  ON fathom_transcript_retry_jobs(meeting_id) 
  WHERE status IN ('pending', 'processing');

-- Index for finding pending jobs ready to retry
CREATE INDEX IF NOT EXISTS idx_transcript_retry_jobs_pending 
  ON fathom_transcript_retry_jobs(status, next_retry_at)
  WHERE status IN ('pending', 'processing');

-- Index for finding jobs by meeting
CREATE INDEX IF NOT EXISTS idx_transcript_retry_jobs_meeting 
  ON fathom_transcript_retry_jobs(meeting_id);

-- Index for finding jobs by user
CREATE INDEX IF NOT EXISTS idx_transcript_retry_jobs_user 
  ON fathom_transcript_retry_jobs(user_id, status);

-- Index for finding failed jobs (monitoring)
CREATE INDEX IF NOT EXISTS idx_transcript_retry_jobs_failed 
  ON fathom_transcript_retry_jobs(status, updated_at)
  WHERE status = 'failed';

-- ============================================================================
-- 3. Add needs_transcript_retry flag to meetings (computed column via function)
-- ============================================================================

-- Function to check if meeting needs transcript retry
CREATE OR REPLACE FUNCTION meeting_needs_transcript_retry(meeting_row meetings)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT 
    meeting_row.transcript_text IS NULL 
    AND meeting_row.fathom_recording_id IS NOT NULL
    AND (
      meeting_row.transcript_fetch_attempts IS NULL 
      OR meeting_row.transcript_fetch_attempts < 5
    )
    AND NOT EXISTS (
      SELECT 1 
      FROM fathom_transcript_retry_jobs 
      WHERE meeting_id = meeting_row.id 
        AND status IN ('pending', 'processing')
    );
$$;

-- ============================================================================
-- 4. Update existing transcript retry index to reflect 5-attempt policy
-- ============================================================================

-- Drop old index if it exists with different condition
DROP INDEX IF EXISTS idx_meetings_transcript_retry;

-- Create updated index with 5-attempt policy
CREATE INDEX IF NOT EXISTS idx_meetings_transcript_retry
  ON meetings(last_transcript_fetch_at, transcript_fetch_attempts)
  WHERE transcript_text IS NULL 
    AND transcript_fetch_attempts < 5
    AND fathom_recording_id IS NOT NULL;

-- ============================================================================
-- 5. Create function to enqueue retry job (idempotent)
-- ============================================================================

CREATE OR REPLACE FUNCTION enqueue_transcript_retry(
  p_meeting_id UUID,
  p_user_id UUID,
  p_recording_id TEXT,
  p_initial_attempt_count INTEGER DEFAULT 1
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_id UUID;
  v_next_retry_at TIMESTAMPTZ;
  v_existing_job_id UUID;
BEGIN
  -- Calculate next retry time (5 minutes from now)
  v_next_retry_at := NOW() + INTERVAL '5 minutes';
  
  -- Check if there's already a pending or processing job for this meeting
  SELECT id INTO v_existing_job_id
  FROM fathom_transcript_retry_jobs
  WHERE meeting_id = p_meeting_id
    AND status IN ('pending', 'processing')
  LIMIT 1;
  
  IF v_existing_job_id IS NOT NULL THEN
    -- Update existing job
    UPDATE fathom_transcript_retry_jobs
    SET
      attempt_count = GREATEST(attempt_count, p_initial_attempt_count),
      next_retry_at = v_next_retry_at,
      updated_at = NOW(),
      recording_id = p_recording_id
    WHERE id = v_existing_job_id
    RETURNING id INTO v_job_id;
  ELSE
    -- Insert new job
    INSERT INTO fathom_transcript_retry_jobs (
      meeting_id,
      user_id,
      recording_id,
      attempt_count,
      max_attempts,
      next_retry_at,
      status,
      updated_at
    )
    VALUES (
      p_meeting_id,
      p_user_id,
      p_recording_id,
      p_initial_attempt_count,
      5,
      v_next_retry_at,
      'pending',
      NOW()
    )
    RETURNING id INTO v_job_id;
  END IF;
  
  RETURN v_job_id;
END;
$$;

-- ============================================================================
-- 6. Create function to mark job as completed
-- ============================================================================

CREATE OR REPLACE FUNCTION complete_transcript_retry_job(p_meeting_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE fathom_transcript_retry_jobs
  SET 
    status = 'completed',
    completed_at = NOW(),
    updated_at = NOW()
  WHERE meeting_id = p_meeting_id
    AND status IN ('pending', 'processing');
END;
$$;

-- ============================================================================
-- 7. Create function to get next batch of jobs ready for retry
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pending_transcript_retry_jobs(p_batch_size INTEGER DEFAULT 50)
RETURNS TABLE (
  id UUID,
  meeting_id UUID,
  user_id UUID,
  recording_id TEXT,
  attempt_count INTEGER,
  max_attempts INTEGER,
  next_retry_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rtj.id,
    rtj.meeting_id,
    rtj.user_id,
    rtj.recording_id,
    rtj.attempt_count,
    rtj.max_attempts,
    rtj.next_retry_at
  FROM fathom_transcript_retry_jobs rtj
  WHERE rtj.status = 'pending'
    AND rtj.next_retry_at <= NOW()
    AND rtj.attempt_count < rtj.max_attempts
  ORDER BY rtj.next_retry_at ASC
  LIMIT p_batch_size
  FOR UPDATE SKIP LOCKED;
END;
$$;

-- ============================================================================
-- 8. Enable Row Level Security
-- ============================================================================

ALTER TABLE fathom_transcript_retry_jobs ENABLE ROW LEVEL SECURITY;

-- Users can view their own retry jobs
CREATE POLICY "Users can view own retry jobs"
  ON fathom_transcript_retry_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all retry jobs
CREATE POLICY "Service role can manage retry jobs"
  ON fathom_transcript_retry_jobs
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- 9. Create updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_transcript_retry_job_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_transcript_retry_job_updated_at
  BEFORE UPDATE ON fathom_transcript_retry_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_transcript_retry_job_updated_at();

-- ============================================================================
-- 10. Comments for documentation
-- ============================================================================

COMMENT ON TABLE fathom_transcript_retry_jobs IS 'Queue for retrying transcript fetches with 5×5min backoff';
COMMENT ON COLUMN fathom_transcript_retry_jobs.attempt_count IS 'Number of retry attempts made (starts at 1 after initial webhook attempt)';
COMMENT ON COLUMN fathom_transcript_retry_jobs.max_attempts IS 'Maximum number of retry attempts (default: 5)';
COMMENT ON COLUMN fathom_transcript_retry_jobs.next_retry_at IS 'When to retry next (5 minutes after last attempt)';
COMMENT ON COLUMN fathom_transcript_retry_jobs.status IS 'Job status: pending, processing, completed, failed';
COMMENT ON FUNCTION enqueue_transcript_retry IS 'Idempotently enqueue a transcript retry job for a meeting';
COMMENT ON FUNCTION complete_transcript_retry_job IS 'Mark retry job as completed when transcript is successfully fetched';
COMMENT ON FUNCTION get_pending_transcript_retry_jobs IS 'Get next batch of jobs ready for retry (with row locking)';

-- ============================================================================
-- Migration Complete
-- ============================================================================

