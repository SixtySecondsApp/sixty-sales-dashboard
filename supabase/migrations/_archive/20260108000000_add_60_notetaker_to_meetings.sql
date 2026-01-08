-- Migration: Add 60 Notetaker source type to meetings
-- Purpose: Extend meetings table to support MeetingBaaS recordings (60 Notetaker)
-- Date: 2026-01-08
--
-- This migration:
-- 1. Extends source_type CHECK constraint to include '60_notetaker'
-- 2. Adds MeetingBaaS-specific columns to meetings table
-- 3. Adds thumbnail support columns
-- 4. Creates indexes for efficient querying

-- =============================================================================
-- 1. Extend source_type CHECK constraint to include '60_notetaker'
-- =============================================================================

-- Drop the existing constraint first
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_source_type_check;

-- Add new constraint with '60_notetaker' included
ALTER TABLE meetings ADD CONSTRAINT meetings_source_type_check
  CHECK (source_type IN ('fathom', 'voice', '60_notetaker'));

-- =============================================================================
-- 2. Add MeetingBaaS-specific columns to meetings table
-- =============================================================================

-- Bot and recording identifiers
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS bot_id TEXT;

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS recording_s3_key TEXT;

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS recording_s3_url TEXT;

-- Transcript storage
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS transcript_json JSONB;

-- Meeting platform (where the meeting was held)
-- First drop any existing constraint to avoid conflicts
DO $$
BEGIN
  ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_meeting_platform_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS meeting_platform TEXT;

-- Add platform constraint after column exists
ALTER TABLE meetings ADD CONSTRAINT meetings_meeting_platform_check
  CHECK (meeting_platform IS NULL OR meeting_platform IN ('zoom', 'google_meet', 'microsoft_teams', 'fathom', 'voice'));

-- Meeting URL for joining
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS meeting_url TEXT;

-- Speaker information (JSONB array)
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS speakers JSONB;

-- Processing status for bot recordings
DO $$
BEGIN
  ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_processing_status_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'ready';

ALTER TABLE meetings ADD CONSTRAINT meetings_processing_status_check
  CHECK (processing_status IN ('pending', 'bot_joining', 'recording', 'processing', 'ready', 'failed'));

-- Error message for failed recordings
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Reference to recordings table for linking
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS recording_id UUID;

-- Add foreign key constraint if recordings table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recordings') THEN
    ALTER TABLE meetings
      ADD CONSTRAINT meetings_recording_id_fkey
      FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

-- =============================================================================
-- 3. Add thumbnail columns (for all source types)
-- =============================================================================

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS thumbnail_s3_key TEXT;

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- =============================================================================
-- 4. Create indexes for efficient querying
-- =============================================================================

-- Unique index on bot_id for fast lookup from webhooks
CREATE UNIQUE INDEX IF NOT EXISTS idx_meetings_bot_id_unique
  ON meetings(bot_id) WHERE bot_id IS NOT NULL;

-- Index on processing status for filtering
CREATE INDEX IF NOT EXISTS idx_meetings_processing_status
  ON meetings(processing_status);

-- Index on recording_id for joins
CREATE INDEX IF NOT EXISTS idx_meetings_recording_id
  ON meetings(recording_id) WHERE recording_id IS NOT NULL;

-- Index on meeting_platform
CREATE INDEX IF NOT EXISTS idx_meetings_meeting_platform
  ON meetings(meeting_platform) WHERE meeting_platform IS NOT NULL;

-- =============================================================================
-- 5. Update comments
-- =============================================================================

COMMENT ON COLUMN meetings.source_type IS 'Source of meeting: fathom (video from Fathom.video), voice (audio from Voice Recorder), or 60_notetaker (MeetingBaaS bot recordings)';
COMMENT ON COLUMN meetings.bot_id IS 'MeetingBaaS bot ID for 60_notetaker recordings';
COMMENT ON COLUMN meetings.recording_s3_key IS 'S3 key for stored recording file';
COMMENT ON COLUMN meetings.recording_s3_url IS 'Signed URL for recording playback';
COMMENT ON COLUMN meetings.transcript_json IS 'Full transcript with timestamps and speaker diarization';
COMMENT ON COLUMN meetings.meeting_platform IS 'Platform where meeting was held (zoom, google_meet, microsoft_teams, fathom, voice)';
COMMENT ON COLUMN meetings.meeting_url IS 'Meeting join URL';
COMMENT ON COLUMN meetings.speakers IS 'Speaker information array with identification details';
COMMENT ON COLUMN meetings.processing_status IS 'Processing status for bot recordings';
COMMENT ON COLUMN meetings.error_message IS 'Error message if recording/processing failed';
COMMENT ON COLUMN meetings.recording_id IS 'Reference to recordings table (if applicable)';
COMMENT ON COLUMN meetings.thumbnail_s3_key IS 'S3 key for video thumbnail image';
COMMENT ON COLUMN meetings.thumbnail_url IS 'Signed URL for thumbnail display';

-- =============================================================================
-- 6. Add AI analysis columns to recordings table (for parity)
-- =============================================================================

-- Add sentiment and coaching columns to recordings table for AI analysis
DO $$
BEGIN
  -- Only run if recordings table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recordings') THEN
    ALTER TABLE recordings
      ADD COLUMN IF NOT EXISTS sentiment_score NUMERIC
        CHECK (sentiment_score IS NULL OR (sentiment_score >= -1 AND sentiment_score <= 1));

    ALTER TABLE recordings
      ADD COLUMN IF NOT EXISTS coach_rating NUMERIC
        CHECK (coach_rating IS NULL OR (coach_rating >= 0 AND coach_rating <= 100));

    ALTER TABLE recordings
      ADD COLUMN IF NOT EXISTS coach_summary TEXT;

    ALTER TABLE recordings
      ADD COLUMN IF NOT EXISTS talk_time_rep_pct NUMERIC;

    ALTER TABLE recordings
      ADD COLUMN IF NOT EXISTS talk_time_customer_pct NUMERIC;

    ALTER TABLE recordings
      ADD COLUMN IF NOT EXISTS talk_time_judgement TEXT
        CHECK (talk_time_judgement IS NULL OR talk_time_judgement IN ('good', 'high', 'low'));

    -- Thumbnail support for recordings
    ALTER TABLE recordings
      ADD COLUMN IF NOT EXISTS thumbnail_s3_key TEXT;

    ALTER TABLE recordings
      ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

    -- Link to meetings table
    ALTER TABLE recordings
      ADD COLUMN IF NOT EXISTS meeting_id UUID;

    -- Add comments
    COMMENT ON COLUMN recordings.sentiment_score IS 'Overall sentiment score from -1 (negative) to 1 (positive)';
    COMMENT ON COLUMN recordings.coach_rating IS 'Sales coaching rating from 0-100';
    COMMENT ON COLUMN recordings.coach_summary IS 'AI-generated coaching feedback summary';
    COMMENT ON COLUMN recordings.talk_time_rep_pct IS 'Percentage of talk time by sales rep';
    COMMENT ON COLUMN recordings.talk_time_customer_pct IS 'Percentage of talk time by customer';
    COMMENT ON COLUMN recordings.talk_time_judgement IS 'Assessment of talk time balance: good, high, or low';
    COMMENT ON COLUMN recordings.thumbnail_s3_key IS 'S3 key for video thumbnail';
    COMMENT ON COLUMN recordings.thumbnail_url IS 'Signed URL for thumbnail display';
    COMMENT ON COLUMN recordings.meeting_id IS 'Reference to unified meetings table';
  END IF;
END $$;

-- =============================================================================
-- 7. Create helper function to sync recording to meeting
-- =============================================================================

CREATE OR REPLACE FUNCTION sync_recording_to_meeting()
RETURNS TRIGGER AS $$
BEGIN
  -- When a recording is created/updated with source = '60_notetaker',
  -- sync key fields to meetings table
  IF NEW.status = 'ready' AND NEW.meeting_id IS NULL THEN
    -- Create a meeting record if one doesn't exist
    INSERT INTO meetings (
      source_type,
      org_id,
      owner_user_id,
      title,
      meeting_start,
      meeting_end,
      duration_minutes,
      summary,
      transcript_json,
      sentiment_score,
      coach_rating,
      coach_summary,
      talk_time_rep_pct,
      talk_time_customer_pct,
      talk_time_judgement,
      bot_id,
      recording_s3_key,
      recording_s3_url,
      meeting_platform,
      meeting_url,
      speakers,
      processing_status,
      recording_id,
      thumbnail_s3_key,
      thumbnail_url
    ) VALUES (
      '60_notetaker',
      NEW.org_id,
      NEW.user_id,
      NEW.meeting_title,
      NEW.meeting_start_time,
      NEW.meeting_end_time,
      CASE WHEN NEW.meeting_duration_seconds IS NOT NULL
        THEN NEW.meeting_duration_seconds / 60
        ELSE NULL
      END,
      NEW.summary,
      NEW.transcript_json,
      NEW.sentiment_score,
      NEW.coach_rating,
      NEW.coach_summary,
      NEW.talk_time_rep_pct,
      NEW.talk_time_customer_pct,
      NEW.talk_time_judgement,
      NEW.bot_id,
      NEW.recording_s3_key,
      NEW.recording_s3_url,
      NEW.meeting_platform,
      NEW.meeting_url,
      NEW.speakers,
      NEW.status,
      NEW.id,
      NEW.thumbnail_s3_key,
      NEW.thumbnail_url
    )
    ON CONFLICT (bot_id) WHERE bot_id IS NOT NULL
    DO UPDATE SET
      title = EXCLUDED.title,
      meeting_start = EXCLUDED.meeting_start,
      meeting_end = EXCLUDED.meeting_end,
      duration_minutes = EXCLUDED.duration_minutes,
      summary = EXCLUDED.summary,
      transcript_json = EXCLUDED.transcript_json,
      sentiment_score = EXCLUDED.sentiment_score,
      coach_rating = EXCLUDED.coach_rating,
      coach_summary = EXCLUDED.coach_summary,
      talk_time_rep_pct = EXCLUDED.talk_time_rep_pct,
      talk_time_customer_pct = EXCLUDED.talk_time_customer_pct,
      talk_time_judgement = EXCLUDED.talk_time_judgement,
      recording_s3_key = EXCLUDED.recording_s3_key,
      recording_s3_url = EXCLUDED.recording_s3_url,
      speakers = EXCLUDED.speakers,
      processing_status = EXCLUDED.processing_status,
      thumbnail_s3_key = EXCLUDED.thumbnail_s3_key,
      thumbnail_url = EXCLUDED.thumbnail_url,
      updated_at = NOW()
    RETURNING id INTO NEW.meeting_id;

    -- Update the recording with the meeting_id
    -- (This will be done via the RETURNING clause above)
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_sync_recording_to_meeting ON recordings;

-- Create trigger only if recordings table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recordings') THEN
    CREATE TRIGGER trigger_sync_recording_to_meeting
      AFTER INSERT OR UPDATE ON recordings
      FOR EACH ROW
      WHEN (NEW.status = 'ready')
      EXECUTE FUNCTION sync_recording_to_meeting();
  END IF;
END $$;
