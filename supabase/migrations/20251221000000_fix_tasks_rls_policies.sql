-- Migration: Fix Tasks RLS Policies
-- The current RLS policies reference owner_id but tasks are created with created_by
-- This migration fixes the policies to check both owner_id AND created_by/assigned_to
-- Also backfills owner_id from created_by for existing tasks
--
-- NOTE: This migration only runs if the tasks table exists

DO $$
BEGIN
  -- Only proceed if tasks table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tasks'
  ) THEN
    RAISE NOTICE 'Tasks table does not exist - skipping RLS policy updates';
    RETURN;
  END IF;

  -- Ensure owner_id column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'owner_id'
  ) THEN
    EXECUTE 'ALTER TABLE tasks ADD COLUMN owner_id UUID REFERENCES auth.users(id)';
  END IF;

  -- Backfill owner_id from created_by where owner_id is NULL
  EXECUTE 'UPDATE tasks SET owner_id = created_by WHERE owner_id IS NULL AND created_by IS NOT NULL';

  -- Create index on owner_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'tasks' AND indexname = 'idx_tasks_owner_id'
  ) THEN
    EXECUTE 'CREATE INDEX idx_tasks_owner_id ON tasks(owner_id)';
  END IF;

  -- Drop existing policies using dynamic SQL
  EXECUTE 'DROP POLICY IF EXISTS "tasks_select" ON tasks';
  EXECUTE 'DROP POLICY IF EXISTS "tasks_insert" ON tasks';
  EXECUTE 'DROP POLICY IF EXISTS "tasks_update" ON tasks';
  EXECUTE 'DROP POLICY IF EXISTS "tasks_delete" ON tasks';
  EXECUTE 'DROP POLICY IF EXISTS "tasks_select_own" ON tasks';
  EXECUTE 'DROP POLICY IF EXISTS "tasks_insert_own" ON tasks';
  EXECUTE 'DROP POLICY IF EXISTS "tasks_update_own" ON tasks';
  EXECUTE 'DROP POLICY IF EXISTS "tasks_delete_own" ON tasks';
  EXECUTE 'DROP POLICY IF EXISTS "Users can view their tasks" ON tasks';
  EXECUTE 'DROP POLICY IF EXISTS "Users can create tasks" ON tasks';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update their tasks" ON tasks';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete their tasks" ON tasks';

  -- SELECT: Can view tasks if owner, creator, or assignee
  EXECUTE 'CREATE POLICY "tasks_select" ON tasks FOR SELECT
    USING (
      is_service_role()
      OR owner_id = (SELECT auth.uid())
      OR created_by = (SELECT auth.uid())
      OR assigned_to = (SELECT auth.uid())
      OR is_admin_optimized()
    )';

  -- INSERT: Can create tasks if setting created_by or owner_id to self
  EXECUTE 'CREATE POLICY "tasks_insert" ON tasks FOR INSERT
    WITH CHECK (
      is_service_role()
      OR created_by = (SELECT auth.uid())
      OR owner_id = (SELECT auth.uid())
    )';

  -- UPDATE: Can update if owner, creator, or assignee
  EXECUTE 'CREATE POLICY "tasks_update" ON tasks FOR UPDATE
    USING (
      is_service_role()
      OR owner_id = (SELECT auth.uid())
      OR created_by = (SELECT auth.uid())
      OR assigned_to = (SELECT auth.uid())
      OR is_admin_optimized()
    )';

  -- DELETE: Can delete if owner, creator, or assignee
  EXECUTE 'CREATE POLICY "tasks_delete" ON tasks FOR DELETE
    USING (
      is_service_role()
      OR owner_id = (SELECT auth.uid())
      OR created_by = (SELECT auth.uid())
      OR assigned_to = (SELECT auth.uid())
      OR is_admin_optimized()
    )';

  -- Drop and recreate trigger
  EXECUTE 'DROP TRIGGER IF EXISTS set_task_owner_id_trigger ON tasks';

  RAISE NOTICE 'Tasks RLS policies updated successfully';
END $$;

-- Create trigger function (always create, as it's harmless)
CREATE OR REPLACE FUNCTION set_task_owner_id()
RETURNS TRIGGER AS $$
BEGIN
  -- If owner_id is not set, default to created_by
  IF NEW.owner_id IS NULL AND NEW.created_by IS NOT NULL THEN
    NEW.owner_id := NEW.created_by;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if tasks table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tasks'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS set_task_owner_id_trigger ON tasks';
    EXECUTE 'CREATE TRIGGER set_task_owner_id_trigger
      BEFORE INSERT ON tasks
      FOR EACH ROW
      EXECUTE FUNCTION set_task_owner_id()';

    EXECUTE 'COMMENT ON COLUMN tasks.owner_id IS ''Owner of the task, defaults to created_by. Used for RLS policies.''';
  END IF;
END $$;
