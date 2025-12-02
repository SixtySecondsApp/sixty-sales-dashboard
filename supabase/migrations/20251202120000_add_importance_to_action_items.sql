-- ============================================================================
-- Add Importance Column to Action Items, Suggestions, and Tasks
-- ============================================================================
-- Purpose: Add importance level (high/medium/low) to support user-controlled
--          auto-sync based on importance filtering
-- ============================================================================

-- Add importance to meeting_action_items table
ALTER TABLE meeting_action_items
ADD COLUMN IF NOT EXISTS importance TEXT CHECK (importance IN ('high', 'medium', 'low'));

COMMENT ON COLUMN meeting_action_items.importance IS 'Importance level for auto-sync filtering: high (critical), medium (standard), low (optional)';

-- Add importance to next_action_suggestions table
ALTER TABLE next_action_suggestions
ADD COLUMN IF NOT EXISTS importance TEXT CHECK (importance IN ('high', 'medium', 'low'));

COMMENT ON COLUMN next_action_suggestions.importance IS 'Importance level for auto-sync filtering: high (critical), medium (standard), low (optional)';

-- Add importance to tasks table (denormalized for filtering)
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS importance TEXT CHECK (importance IN ('high', 'medium', 'low'));

COMMENT ON COLUMN tasks.importance IS 'Denormalized importance level from action item for efficient filtering';

-- Add indexes for filtering by importance
CREATE INDEX IF NOT EXISTS idx_tasks_importance ON tasks(importance) WHERE importance IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_action_items_importance ON meeting_action_items(importance) WHERE importance IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_suggestions_importance ON next_action_suggestions(importance) WHERE importance IS NOT NULL;

-- Backfill existing records with default 'medium' importance
-- Note: We default to 'medium' for all existing records since we don't have
-- enough historical data to accurately classify importance levels
UPDATE tasks
SET importance = 'medium'
WHERE importance IS NULL;

UPDATE meeting_action_items
SET importance = 'medium'
WHERE importance IS NULL;

UPDATE next_action_suggestions
SET importance = 'medium'
WHERE importance IS NULL;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Count tasks by importance
DO $$
DECLARE
  high_count INTEGER;
  medium_count INTEGER;
  low_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO high_count FROM tasks WHERE importance = 'high';
  SELECT COUNT(*) INTO medium_count FROM tasks WHERE importance = 'medium';
  SELECT COUNT(*) INTO low_count FROM tasks WHERE importance = 'low';

  RAISE NOTICE 'Task importance distribution: High=%, Medium=%, Low=%',
    high_count, medium_count, low_count;
END $$;
