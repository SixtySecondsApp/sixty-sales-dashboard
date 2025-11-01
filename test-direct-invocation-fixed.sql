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
  activity_id,
  activity_type,
  title,
  reasoning,
  urgency,
  confidence_score,
  created_at
FROM next_action_suggestions
WHERE activity_id = '72b97f50-a2a9-412e-8ed4-37f0b78ff811'
  AND activity_type = 'meeting'
ORDER BY created_at DESC;

-- Step 5: Check counts on meetings table
SELECT
  id,
  title,
  next_actions_count,
  next_actions_generated_at
FROM meetings
WHERE id = '72b97f50-a2a9-412e-8ed4-37f0b78ff811';
