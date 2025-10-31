-- Manual test to generate suggestions for a meeting

-- Step 1: Find a meeting with transcript
SELECT 
  '=== STEP 1: Find Meeting with Content ===' as step,
  id,
  title,
  LENGTH(transcript_text) as transcript_chars,
  owner_user_id
FROM meetings 
WHERE transcript_text IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 1;

-- Step 2: Get the meeting ID from above and run this (replace MEETING-ID)
-- SELECT regenerate_next_actions_for_activity('MEETING-ID-HERE'::UUID, 'meeting');

-- Step 3: After running step 2, check if suggestions were created
-- SELECT * FROM next_action_suggestions ORDER BY created_at DESC LIMIT 5;

-- Alternative: Check Edge Function logs
-- supabase functions logs suggest-next-actions --limit 20
