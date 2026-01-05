-- Add gladia_result_url column for async transcription polling
ALTER TABLE voice_recordings
ADD COLUMN IF NOT EXISTS gladia_result_url TEXT;

-- Add index for faster status lookups
CREATE INDEX IF NOT EXISTS idx_voice_recordings_status ON voice_recordings(status);
