-- Check if the 4 suggestions were inserted

SELECT
  id,
  title,
  reasoning,
  action_type,
  urgency,
  confidence_score,
  status,
  created_at
FROM next_action_suggestions
WHERE activity_id = '72b97f50-a2a9-412e-8ed4-37f0b78ff811'
  AND activity_type = 'meeting'
ORDER BY created_at DESC;

-- Check meeting metadata
SELECT
  title,
  next_actions_count,
  next_actions_generated_at
FROM meetings
WHERE id = '72b97f50-a2a9-412e-8ed4-37f0b78ff811';

-- Check total suggestions in system
SELECT COUNT(*) as total_suggestions
FROM next_action_suggestions;
