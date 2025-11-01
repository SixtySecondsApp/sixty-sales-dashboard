-- Monitor suggestion creation in real-time

-- Check total suggestions in system
SELECT
  COUNT(*) as total_suggestions,
  COUNT(DISTINCT activity_id) as unique_activities,
  MAX(created_at) as most_recent
FROM next_action_suggestions;

-- Check suggestions for our test meeting
SELECT
  id,
  activity_id,
  title,
  action_type,
  urgency,
  confidence_score,
  created_at
FROM next_action_suggestions
WHERE activity_id = '72b97f50-a2a9-412e-8ed4-37f0b78ff811'
ORDER BY created_at DESC;

-- Check meeting metadata
SELECT
  id,
  title,
  next_actions_count,
  next_actions_generated_at,
  LENGTH(transcript_text) as transcript_length
FROM meetings
WHERE id = '72b97f50-a2a9-412e-8ed4-37f0b78ff811';
