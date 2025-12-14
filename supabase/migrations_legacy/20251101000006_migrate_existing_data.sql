-- Migrate existing AI suggestions and action items to unified tasks table
-- This ensures historical data is converted to the new unified system

-- Step 1: Convert existing accepted AI suggestions to tasks
INSERT INTO tasks (
  title,
  description,
  task_type,
  priority,
  due_date,
  meeting_id,
  suggestion_id,
  assigned_to,
  created_by,
  source,
  metadata,
  created_at,
  updated_at
)
SELECT
  s.title,
  s.reasoning,
  s.action_type,
  -- Map urgency to priority
  CASE s.urgency
    WHEN 'critical' THEN 'urgent'
    WHEN 'high' THEN 'high'
    WHEN 'medium' THEN 'medium'
    ELSE 'low'
  END,
  s.recommended_deadline,
  s.activity_id AS meeting_id,
  s.id AS suggestion_id,
  m.owner_user_id AS assigned_to,
  m.owner_user_id AS created_by,
  'ai_suggestion',
  jsonb_build_object(
    'confidence_score', s.confidence_score,
    'timestamp_seconds', s.timestamp_seconds,
    'migrated_from', 'next_action_suggestions',
    'migration_date', NOW()
  ),
  s.created_at,
  s.updated_at
FROM next_action_suggestions s
JOIN meetings m ON s.activity_id = m.id
WHERE s.status = 'accepted'
  AND s.activity_type = 'meeting'
  AND NOT EXISTS (
    SELECT 1 FROM tasks t WHERE t.suggestion_id = s.id
  );

-- Step 2: Convert existing meeting action items to tasks
INSERT INTO tasks (
  title,
  description,
  task_type,
  priority,
  due_date,
  meeting_id,
  action_item_id,
  assigned_to,
  created_by,
  source,
  metadata,
  completed,
  created_at,
  updated_at
)
SELECT
  a.title,
  COALESCE(a.description, ''),
  -- Map category to task_type
  CASE LOWER(a.category)
    WHEN 'follow_up' THEN 'follow_up'
    WHEN 'follow-up' THEN 'follow_up'
    WHEN 'proposal' THEN 'proposal'
    WHEN 'demo' THEN 'demo'
    WHEN 'meeting' THEN 'meeting'
    ELSE 'general'
  END,
  COALESCE(a.priority, 'medium'),
  a.deadline_at AS due_date,
  a.meeting_id,
  a.id AS action_item_id,
  -- Try to match assignee by email, fallback to meeting owner
  COALESCE(
    (SELECT id FROM profiles WHERE email = a.assignee_email LIMIT 1),
    m.owner_user_id
  ) AS assigned_to,
  m.owner_user_id AS created_by,
  'fathom_action_item',
  jsonb_build_object(
    'assignee_email', a.assignee_email,
    'assignee_name', a.assignee_name,
    'timestamp_seconds', a.timestamp_seconds,
    'playback_url', a.playback_url,
    'ai_generated', a.ai_generated,
    'migrated_from', 'meeting_action_items',
    'migration_date', NOW()
  ),
  a.completed,
  a.created_at,
  a.updated_at
FROM meeting_action_items a
JOIN meetings m ON a.meeting_id = m.id
WHERE NOT EXISTS (
    SELECT 1 FROM tasks t WHERE t.action_item_id = a.id
  );

-- Step 3: Update task statuses based on completion
UPDATE tasks
SET status = CASE
  WHEN completed = true THEN 'completed'
  WHEN due_date < NOW() AND completed = false THEN 'overdue'
  ELSE status
END
WHERE (suggestion_id IS NOT NULL OR action_item_id IS NOT NULL)
  AND status = 'pending';

-- Step 4: Log migration statistics
DO $$
DECLARE
  suggestion_count INTEGER;
  action_item_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO suggestion_count
  FROM tasks WHERE suggestion_id IS NOT NULL;

  SELECT COUNT(*) INTO action_item_count
  FROM tasks WHERE action_item_id IS NOT NULL;

  RAISE NOTICE 'Migration Complete:';
  RAISE NOTICE '  - Migrated % AI suggestions to tasks', suggestion_count;
  RAISE NOTICE '  - Migrated % action items to tasks', action_item_count;
  RAISE NOTICE '  - Total unified tasks: %', suggestion_count + action_item_count;
END $$;
