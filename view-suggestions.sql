-- View the AI-generated suggestions

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
ORDER BY created_at DESC;
