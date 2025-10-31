-- Manual Test: Generate Next-Action Suggestions
-- Run this step-by-step in Supabase SQL Editor

-- STEP 1: Find a meeting with transcript
SELECT
  id,
  title,
  LENGTH(transcript_text) as transcript_length,
  owner_user_id
FROM meetings
WHERE transcript_text IS NOT NULL
ORDER BY created_at DESC
LIMIT 1;

-- STEP 2: Copy the meeting ID from above and paste it below (replace the placeholder)
-- Then uncomment and run this line:
-- SELECT regenerate_next_actions_for_activity('PASTE-MEETING-ID-HERE'::UUID, 'meeting');

-- STEP 3: Check if suggestions were created
-- Uncomment and run this after STEP 2:
-- SELECT * FROM next_action_suggestions ORDER BY created_at DESC LIMIT 5;

-- STEP 4: Check your pending count
-- SELECT get_pending_suggestions_count();
