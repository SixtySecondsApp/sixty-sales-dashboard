-- Migration: Create voice_recordings table for use60 Voice feature
-- This table stores voice recordings with transcription and AI analysis data

-- Create voice_recordings table
CREATE TABLE IF NOT EXISTS voice_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Recording metadata
  title TEXT NOT NULL DEFAULT 'Untitled Recording',
  audio_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  duration_seconds INTEGER,

  -- Processing status
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'transcribing', 'analyzing', 'completed', 'failed')),
  error_message TEXT,

  -- Transcription data
  transcript_text TEXT,
  transcript_segments JSONB, -- Array of {speaker, speaker_id, text, start_time, end_time, confidence}
  speakers JSONB, -- Array of {id, name, initials, color}
  language TEXT DEFAULT 'en',

  -- AI analysis (populated by separate edge function)
  summary TEXT,
  action_items JSONB, -- Array of {id, text, owner, deadline, done, priority}
  key_topics JSONB, -- Array of strings
  sentiment_score NUMERIC(3,2), -- -1 to 1

  -- Meeting association (optional)
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,

  -- Timestamps
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_voice_recordings_org_id ON voice_recordings(org_id);
CREATE INDEX idx_voice_recordings_user_id ON voice_recordings(user_id);
CREATE INDEX idx_voice_recordings_status ON voice_recordings(status);
CREATE INDEX idx_voice_recordings_recorded_at ON voice_recordings(recorded_at DESC);
CREATE INDEX idx_voice_recordings_meeting_id ON voice_recordings(meeting_id) WHERE meeting_id IS NOT NULL;

-- Enable RLS
ALTER TABLE voice_recordings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view recordings in their org
CREATE POLICY "Users can view org recordings"
  ON voice_recordings
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_users WHERE user_id = auth.uid()
    )
  );

-- Users can insert their own recordings
CREATE POLICY "Users can create recordings"
  ON voice_recordings
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    org_id IN (
      SELECT org_id FROM org_users WHERE user_id = auth.uid()
    )
  );

-- Users can update their own recordings
CREATE POLICY "Users can update own recordings"
  ON voice_recordings
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own recordings
CREATE POLICY "Users can delete own recordings"
  ON voice_recordings
  FOR DELETE
  USING (user_id = auth.uid());

-- Updated_at trigger
CREATE TRIGGER voice_recordings_updated_at
  BEFORE UPDATE ON voice_recordings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE voice_recordings IS 'Stores voice recordings from use60 Voice feature with transcriptions and AI analysis';
COMMENT ON COLUMN voice_recordings.status IS 'Processing status: uploaded -> transcribing -> analyzing -> completed/failed';
COMMENT ON COLUMN voice_recordings.transcript_segments IS 'Array of speaker-attributed transcript segments with timestamps';
COMMENT ON COLUMN voice_recordings.speakers IS 'Array of detected speakers with names and colors';
COMMENT ON COLUMN voice_recordings.action_items IS 'AI-extracted action items from the recording';
