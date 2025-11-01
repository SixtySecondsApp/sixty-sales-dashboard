-- Test Edge Function after contacts column fix

-- Trigger suggestion generation
SELECT
  m.id,
  m.title,
  regenerate_next_actions_for_activity(m.id, 'meeting') as result
FROM meetings m
WHERE id = '72b97f50-a2a9-412e-8ed4-37f0b78ff811';

-- Wait a few seconds, then check for suggestions
SELECT
  id,
  activity_id,
  title,
  reasoning,
  action_type,
  urgency,
  confidence_score,
  created_at
FROM next_action_suggestions
WHERE activity_id = '72b97f50-a2a9-412e-8ed4-37f0b78ff811'
  AND activity_type = 'meeting'
ORDER BY created_at DESC;

-- Check meeting counts
SELECT
  id,
  title,
  next_actions_count,
  next_actions_generated_at
FROM meetings
WHERE id = '72b97f50-a2a9-412e-8ed4-37f0b78ff811';
