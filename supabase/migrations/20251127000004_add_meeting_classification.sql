-- Phase 4.2: Meeting Type Classification
-- Add meeting_type and classification_confidence columns to meetings table

ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS meeting_type TEXT CHECK (
  meeting_type IN ('discovery', 'demo', 'negotiation', 'closing', 'follow_up', 'general')
);

ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS classification_confidence NUMERIC(3,2) CHECK (
  classification_confidence >= 0 AND classification_confidence <= 1
);

-- Add index for meeting type queries
CREATE INDEX IF NOT EXISTS idx_meetings_meeting_type 
ON meetings(meeting_type) 
WHERE meeting_type IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN meetings.meeting_type IS 'Auto-classified meeting type: discovery, demo, negotiation, closing, follow_up, or general';
COMMENT ON COLUMN meetings.classification_confidence IS 'Confidence score (0-1) for the meeting type classification';

