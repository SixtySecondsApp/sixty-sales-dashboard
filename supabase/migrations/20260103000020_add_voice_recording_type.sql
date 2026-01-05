-- Migration: Add recording_type column to voice_recordings table
-- This distinguishes between external meetings and internal voice notes

-- Add recording_type column
ALTER TABLE voice_recordings
ADD COLUMN IF NOT EXISTS recording_type TEXT NOT NULL DEFAULT 'meeting'
CHECK (recording_type IN ('meeting', 'voice_note'));

-- Add index for filtering by type
CREATE INDEX IF NOT EXISTS idx_voice_recordings_type
ON voice_recordings(recording_type);

-- Add comment for documentation
COMMENT ON COLUMN voice_recordings.recording_type IS 'Type of recording: meeting (external calls, client meetings) or voice_note (internal notes, AI commands)';
