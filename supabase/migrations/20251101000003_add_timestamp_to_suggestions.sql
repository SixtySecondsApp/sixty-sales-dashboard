-- Add timestamp field to next_action_suggestions for click-to-play in Fathom
-- Stores the second in the meeting where this action item was discussed

ALTER TABLE next_action_suggestions
ADD COLUMN IF NOT EXISTS timestamp_seconds INTEGER;

COMMENT ON COLUMN next_action_suggestions.timestamp_seconds IS 'Second in the meeting recording where this action was discussed. Used for click-to-play in Fathom.';

-- Create index for performance when filtering by activity with timestamps
CREATE INDEX IF NOT EXISTS idx_next_action_suggestions_timestamp
ON next_action_suggestions(activity_id, timestamp_seconds)
WHERE timestamp_seconds IS NOT NULL;
