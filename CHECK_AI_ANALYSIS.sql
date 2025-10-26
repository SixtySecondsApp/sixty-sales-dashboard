-- Check if AI Analysis has run on the test action item

SELECT
  id,
  title,
  assignee_email,
  sync_status,
  task_id,
  ai_task_type,
  ai_confidence_score,
  LEFT(ai_reasoning, 100) as reasoning_preview,
  ai_analyzed_at,
  created_at
FROM meeting_action_items
WHERE title = 'TEST: Send pricing proposal to Acme Corp'
ORDER BY created_at DESC
LIMIT 1;
