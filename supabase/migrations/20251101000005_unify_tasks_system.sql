-- Unify Tasks System: Add references to AI suggestions and action items
-- This allows tasks to be created from both sources while maintaining traceability

-- Add reference columns to tasks table
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS suggestion_id UUID REFERENCES next_action_suggestions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS action_item_id UUID REFERENCES meeting_action_items(id) ON DELETE SET NULL;

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_tasks_suggestion_id
ON tasks(suggestion_id)
WHERE suggestion_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_action_item_id
ON tasks(action_item_id)
WHERE action_item_id IS NOT NULL;

-- Improve meeting_id index (if not already optimal)
CREATE INDEX IF NOT EXISTS idx_tasks_meeting_status
ON tasks(meeting_id, status)
WHERE meeting_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN tasks.suggestion_id IS 'Reference to the AI-generated suggestion that created this task (if applicable)';
COMMENT ON COLUMN tasks.action_item_id IS 'Reference to the meeting action item that created this task (if applicable)';

-- Create view for unified task queries with metadata
CREATE OR REPLACE VIEW unified_meeting_tasks AS
SELECT
  t.*,
  s.confidence_score,
  s.reasoning AS suggestion_reasoning,
  s.urgency,
  a.assignee_email AS action_item_assignee,
  a.category AS action_item_category,
  CASE
    WHEN t.suggestion_id IS NOT NULL THEN 'ai_suggestion'
    WHEN t.action_item_id IS NOT NULL THEN 'action_item'
    ELSE 'manual'
  END AS task_source_type
FROM tasks t
LEFT JOIN next_action_suggestions s ON t.suggestion_id = s.id
LEFT JOIN meeting_action_items a ON t.action_item_id = a.id;

-- Grant access to the view
GRANT SELECT ON unified_meeting_tasks TO authenticated;

-- Add constraint to prevent duplicate task creation from same source
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_unique_suggestion
ON tasks(suggestion_id)
WHERE suggestion_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_unique_action_item
ON tasks(action_item_id)
WHERE action_item_id IS NOT NULL;
