-- Test automatic trigger when transcript is updated

-- First, let's check which meetings have transcripts but no suggestions yet
SELECT
  m.id,
  m.title,
  LENGTH(m.transcript_text) as transcript_length,
  m.next_actions_count,
  m.next_actions_generated_at
FROM meetings m
WHERE m.transcript_text IS NOT NULL
  AND m.next_actions_generated_at IS NULL
ORDER BY m.meeting_start DESC
LIMIT 5;

-- To test the automatic trigger, pick one meeting ID from above and run:
-- (Replace the UUID with an actual meeting ID)
/*
UPDATE meetings
SET transcript_text = transcript_text || ' '
WHERE id = 'REPLACE-WITH-MEETING-ID';

-- Wait 10-15 seconds, then check if suggestions were auto-generated:
SELECT
  COUNT(*) as suggestion_count
FROM next_action_suggestions
WHERE activity_id = 'REPLACE-WITH-MEETING-ID';
*/
