-- Final test after JSON parsing fix

-- Trigger suggestion generation
SELECT
  m.id,
  m.title,
  regenerate_next_actions_for_activity(m.id, 'meeting') as result
FROM meetings m
WHERE id = '72b97f50-a2a9-412e-8ed4-37f0b78ff811';

-- WAIT 10-15 SECONDS, then check for suggestions:

-- Check suggestions created
SELECT
  id,
  title,
  reasoning,
  action_type,
  urgency,
  confidence_score,
  created_at
FROM next_action_suggestions
WHERE activity_id = '72b97f50-a2a9-412e-8ed4-37f0b78ff811'
ORDER BY created_at DESC;

-- Check meeting metadata
SELECT
  title,
  next_actions_count,
  next_actions_generated_at
FROM meetings
WHERE id = '72b97f50-a2a9-412e-8ed4-37f0b78ff811';
