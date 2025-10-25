-- Add missing Fathom API fields to meetings table
-- These fields are available in the Fathom API but weren't being captured

ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS fathom_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS transcript_language TEXT DEFAULT 'en',
ADD COLUMN IF NOT EXISTS calendar_invitees_type TEXT CHECK (calendar_invitees_type IN ('all_internal', 'one_or_more_external')),
ADD COLUMN IF NOT EXISTS fathom_user_id TEXT;

-- Add index for filtering by invitee type
CREATE INDEX IF NOT EXISTS idx_meetings_invitees_type
ON meetings(calendar_invitees_type)
WHERE calendar_invitees_type IS NOT NULL;

-- Add index for language filtering
CREATE INDEX IF NOT EXISTS idx_meetings_language
ON meetings(transcript_language)
WHERE transcript_language IS NOT NULL;

-- Add comments
COMMENT ON COLUMN meetings.fathom_created_at IS 'Timestamp when the recording was created in Fathom (may differ from meeting_start)';
COMMENT ON COLUMN meetings.transcript_language IS 'Language code for the transcript (e.g., en, es, fr)';
COMMENT ON COLUMN meetings.calendar_invitees_type IS 'Type of invitees: all_internal or one_or_more_external';
COMMENT ON COLUMN meetings.fathom_user_id IS 'Fathom user ID who owns this recording';
