-- Check recent meetings and their action items
SELECT 
  m.id,
  m.title,
  m.meeting_start,
  m.fathom_recording_id,
  m.sync_status,
  m.last_synced_at,
  COUNT(ai.id) as action_item_count
FROM meetings m
LEFT JOIN meeting_action_items ai ON ai.meeting_id = m.id
WHERE m.created_at > NOW() - INTERVAL '24 hours'
GROUP BY m.id, m.title, m.meeting_start, m.fathom_recording_id, m.sync_status, m.last_synced_at
ORDER BY m.meeting_start DESC
LIMIT 10;

-- Check total action items in system
SELECT COUNT(*) as total_action_items FROM meeting_action_items;

-- Check sample of recent action items if any exist
SELECT 
  ai.id,
  ai.title,
  ai.category,
  ai.completed,
  ai.ai_generated,
  ai.created_at,
  m.title as meeting_title
FROM meeting_action_items ai
JOIN meetings m ON m.id = ai.meeting_id
ORDER BY ai.created_at DESC
LIMIT 5;
