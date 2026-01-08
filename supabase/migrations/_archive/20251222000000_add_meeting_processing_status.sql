-- Migration: Add processing status columns to meetings table
-- Purpose: Track thumbnail, transcript, and summary processing states for improved UX

-- Add processing status enum type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meeting_processing_status') THEN
        CREATE TYPE meeting_processing_status AS ENUM ('pending', 'processing', 'complete', 'failed');
    END IF;
END
$$;

-- Add status columns to meetings table
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS thumbnail_status meeting_processing_status DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS transcript_status meeting_processing_status DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS summary_status meeting_processing_status DEFAULT 'pending';

-- Indexes for efficient filtering of pending/processing items
CREATE INDEX IF NOT EXISTS idx_meetings_thumbnail_status
  ON meetings(thumbnail_status) WHERE thumbnail_status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_meetings_transcript_status
  ON meetings(transcript_status) WHERE transcript_status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_meetings_summary_status
  ON meetings(summary_status) WHERE summary_status IN ('pending', 'processing');

-- Backfill existing meetings based on current data
UPDATE meetings SET
  thumbnail_status = CASE
    WHEN thumbnail_url IS NOT NULL AND thumbnail_url NOT LIKE '%dummyimage.com%' THEN 'complete'::meeting_processing_status
    ELSE 'pending'::meeting_processing_status
  END,
  transcript_status = CASE
    WHEN transcript_text IS NOT NULL AND transcript_text != '' THEN 'complete'::meeting_processing_status
    ELSE 'pending'::meeting_processing_status
  END,
  summary_status = CASE
    WHEN summary IS NOT NULL AND summary != '' THEN 'complete'::meeting_processing_status
    ELSE 'pending'::meeting_processing_status
  END
WHERE thumbnail_status IS NULL
   OR transcript_status IS NULL
   OR summary_status IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN meetings.thumbnail_status IS 'Processing status for video thumbnail generation';
COMMENT ON COLUMN meetings.transcript_status IS 'Processing status for transcript fetching from Fathom';
COMMENT ON COLUMN meetings.summary_status IS 'Processing status for AI-generated meeting summary';
