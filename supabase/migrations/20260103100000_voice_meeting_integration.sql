-- Migration: Voice Meeting Integration
-- Description: Add source_type and voice_recording_id to meetings table
-- to support voice recordings appearing in the meetings system
-- Date: 2026-01-03

-- Add source type column to identify meeting origin
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'fathom'
  CHECK (source_type IN ('fathom', 'voice'));

-- Add reference to voice_recordings table
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS voice_recording_id UUID REFERENCES voice_recordings(id) ON DELETE SET NULL;

-- Create index for voice recording lookups
CREATE INDEX IF NOT EXISTS idx_meetings_voice_recording_id
ON meetings(voice_recording_id)
WHERE voice_recording_id IS NOT NULL;

-- Create index for source type filtering
CREATE INDEX IF NOT EXISTS idx_meetings_source_type
ON meetings(source_type);

-- Add comments for documentation
COMMENT ON COLUMN meetings.source_type IS 'Source of meeting: fathom (video from Fathom.video) or voice (audio from Voice Recorder)';
COMMENT ON COLUMN meetings.voice_recording_id IS 'Reference to voice_recordings table when source_type is voice';

-- Note: voice_recordings.meeting_id already exists and will be updated
-- when a meeting is created from a voice recording, creating a bidirectional link:
-- meetings.voice_recording_id -> voice_recordings.id
-- voice_recordings.meeting_id -> meetings.id
