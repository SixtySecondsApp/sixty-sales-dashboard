-- Migration: Final Disable of Automatic Task Creation from Action Items
-- Purpose: Ensure tasks are only created manually via UI, never automatically
-- Date: 2025-01-15
--
-- This migration definitively drops all variants of the auto-create trigger
-- and ensures action items are stored with synced_to_task=false by default.
-- NOTE: Made conditional for staging compatibility

DO $$
BEGIN
  -- Only proceed if meeting_action_items table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meeting_action_items') THEN

    -- Drop ALL variants of the automatic trigger
    DROP TRIGGER IF EXISTS trigger_auto_create_task_from_action_item ON meeting_action_items;

    -- Drop trigger using dynamic SQL for extra safety
    IF EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trigger_auto_create_task_from_action_item'
      AND tgrelid = 'meeting_action_items'::regclass
    ) THEN
      DROP TRIGGER trigger_auto_create_task_from_action_item ON meeting_action_items;
    END IF;

    -- Ensure table defaults enforce manual task creation
    ALTER TABLE meeting_action_items
      ALTER COLUMN synced_to_task SET DEFAULT false,
      ALTER COLUMN task_id SET DEFAULT NULL;

    -- Update table comment
    COMMENT ON TABLE meeting_action_items IS
      'Action items from Fathom meetings. Tasks are created MANUALLY only when sales reps click "Create Task" button. No automatic task creation.';

    RAISE NOTICE 'Successfully configured meeting_action_items for manual task creation only.';
  ELSE
    RAISE NOTICE 'Skipping migration - meeting_action_items table does not exist';
  END IF;
END $$;

-- Update function comments if functions exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'auto_create_task_from_action_item') THEN
    COMMENT ON FUNCTION auto_create_task_from_action_item() IS
      'Manual task creation function - called explicitly via create-task-from-action-item edge function. NOT triggered automatically.';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'auto_create_task_from_action_item_v2') THEN
    COMMENT ON FUNCTION auto_create_task_from_action_item_v2() IS
      'Manual task creation function (v2) - called explicitly via create-task-from-action-item edge function. NOT triggered automatically.';
  END IF;
END $$;

-- Verify trigger is dropped (only if table exists)
DO $$
DECLARE
  trigger_count INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meeting_action_items') THEN
    SELECT COUNT(*) INTO trigger_count
    FROM pg_trigger
    WHERE tgname LIKE '%auto_create_task%'
      AND tgrelid = 'meeting_action_items'::regclass;

    IF trigger_count > 0 THEN
      RAISE WARNING 'Found % auto-create triggers still active on meeting_action_items. Manual review required.', trigger_count;
    ELSE
      RAISE NOTICE 'Successfully verified: No auto-create triggers active on meeting_action_items.';
    END IF;
  END IF;
END $$;
