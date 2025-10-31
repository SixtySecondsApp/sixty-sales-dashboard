-- SIMPLE: Force Generate Next-Actions for ALL Meetings with Transcripts
-- Copy and paste this into Supabase SQL Editor

-- Check how many meetings will be processed
SELECT
  COUNT(*) as meetings_to_process,
  SUM(LENGTH(transcript_text)) as total_transcript_chars
FROM meetings
WHERE transcript_text IS NOT NULL;

-- Generate suggestions for ALL meetings with transcripts
-- This will take ~2 seconds per meeting
SELECT
  m.id,
  m.title,
  regenerate_next_actions_for_activity(m.id, 'meeting') as triggered
FROM meetings m
WHERE m.transcript_text IS NOT NULL
ORDER BY m.created_at DESC;

-- Wait 30 seconds for Edge Functions to complete, then run:
-- SELECT COUNT(*) FROM next_action_suggestions WHERE activity_type = 'meeting';
