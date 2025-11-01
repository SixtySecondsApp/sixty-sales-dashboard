-- Test the complete Fathom sync → automatic suggestion flow

-- Step 1: Find a meeting that doesn't have suggestions yet
SELECT
  id,
  title,
  LENGTH(transcript_text) as has_transcript,
  next_actions_count,
  next_actions_generated_at
FROM meetings
WHERE transcript_text IS NOT NULL
  AND next_actions_generated_at IS NULL
LIMIT 1;

-- Step 2: Simulate what fathom-sync does when it fetches a transcript
-- This UPDATE should trigger automatic suggestion generation
-- (Replace the UUID with a meeting ID from Step 1)

/*
UPDATE meetings
SET
  transcript_text = transcript_text,  -- Trigger the UPDATE OF transcript_text
  updated_at = NOW()
WHERE id = 'REPLACE-WITH-MEETING-ID';
*/

-- Step 3: Wait 10-15 seconds, then check if suggestions were auto-created
/*
SELECT
  id,
  title,
  action_type,
  urgency,
  confidence_score,
  created_at
FROM next_action_suggestions
WHERE activity_id = 'REPLACE-WITH-MEETING-ID'
ORDER BY created_at DESC;
*/

-- Step 4: Verify meeting metadata was updated
/*
SELECT
  title,
  next_actions_count,
  next_actions_generated_at
FROM meetings
WHERE id = 'REPLACE-WITH-MEETING-ID';
*/
