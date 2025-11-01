-- Test direct Edge Function invocation via SQL
-- This helps debug what's happening

-- Step 1: Get meeting details
SELECT
  id,
  title,
  owner_user_id,
  LENGTH(transcript_text) as transcript_length,
  company_id,
  primary_contact_id
FROM meetings
WHERE id = '72b97f50-a2a9-412e-8ed4-37f0b78ff811';

-- Step 2: Check system config
SELECT
  key,
  LEFT(value, 50) as value_preview,
  LENGTH(value) as value_length
FROM system_config
ORDER BY key;

-- Step 3: Try synchronous call (this will wait for response)
SELECT regenerate_next_actions_for_activity(
  '72b97f50-a2a9-412e-8ed4-37f0b78ff811'::uuid,
  'meeting'
);

-- Step 4: Check if suggestions were created
SELECT
  id,
  meeting_id,
  suggestion_text,
  priority,
  created_at
FROM next_action_suggestions
WHERE meeting_id = '72b97f50-a2a9-412e-8ed4-37f0b78ff811'
ORDER BY created_at DESC;
