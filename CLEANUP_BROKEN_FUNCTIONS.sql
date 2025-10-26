-- Cleanup broken functions from migration #8
-- Run this before re-applying MIGRATION_FIX_tasks_sync.sql

-- Drop triggers first
DROP TRIGGER IF EXISTS sync_action_item_on_insert ON meeting_action_items;
DROP TRIGGER IF EXISTS sync_action_item_on_update ON meeting_action_items;
DROP TRIGGER IF EXISTS sync_task_on_update ON tasks;

-- Drop trigger functions
DROP FUNCTION IF EXISTS trigger_sync_action_item_to_task();
DROP FUNCTION IF EXISTS trigger_sync_task_to_action_item();

-- Drop sync functions (these have the broken 'stage' reference)
DROP FUNCTION IF EXISTS sync_action_item_to_task(UUID);
DROP FUNCTION IF EXISTS sync_task_to_action_item(UUID);

-- Drop helper functions
DROP FUNCTION IF EXISTS is_internal_assignee(TEXT);
DROP FUNCTION IF EXISTS get_user_id_from_email(TEXT);

-- Verify cleanup
DO $$
BEGIN
  RAISE NOTICE 'Cleanup complete. Now run MIGRATION_FIX_tasks_sync.sql to recreate with correct column names.';
END $$;
