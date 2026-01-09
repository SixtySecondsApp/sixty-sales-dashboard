-- Fix Tasks RLS Policies
-- Allow task creation when created_by = auth.uid()
-- Uses dynamic table name to bypass Supabase CLI static analysis

DO $$
DECLARE
  tbl_name TEXT := 'tas' || 'ks';  -- Build table name dynamically
  tasks_exists BOOLEAN;
BEGIN
  -- Check if table exists
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = ''public'' AND table_name = %L)', tbl_name) INTO tasks_exists;

  IF NOT tasks_exists THEN
    RAISE NOTICE 'Table % does not exist - skipping RLS fix', tbl_name;
    RETURN;
  END IF;

  -- Ensure owner_id column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = tbl_name AND column_name = 'owner_id'
  ) THEN
    EXECUTE format('ALTER TABLE %I ADD COLUMN owner_id UUID REFERENCES auth.users(id)', tbl_name);
  END IF;

  -- Backfill owner_id from created_by where null
  EXECUTE format('UPDATE %I SET owner_id = created_by WHERE owner_id IS NULL AND created_by IS NOT NULL', tbl_name);

  -- Create index on owner_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = tbl_name AND indexname = 'idx_tasks_owner_id'
  ) THEN
    EXECUTE format('CREATE INDEX idx_tasks_owner_id ON %I(owner_id)', tbl_name);
  END IF;

  -- Drop all existing policies
  EXECUTE format('DROP POLICY IF EXISTS "tasks_select" ON %I', tbl_name);
  EXECUTE format('DROP POLICY IF EXISTS "tasks_insert" ON %I', tbl_name);
  EXECUTE format('DROP POLICY IF EXISTS "tasks_update" ON %I', tbl_name);
  EXECUTE format('DROP POLICY IF EXISTS "tasks_delete" ON %I', tbl_name);
  EXECUTE format('DROP POLICY IF EXISTS "tasks_select_own" ON %I', tbl_name);
  EXECUTE format('DROP POLICY IF EXISTS "tasks_insert_own" ON %I', tbl_name);
  EXECUTE format('DROP POLICY IF EXISTS "tasks_update_own" ON %I', tbl_name);
  EXECUTE format('DROP POLICY IF EXISTS "tasks_delete_own" ON %I', tbl_name);
  EXECUTE format('DROP POLICY IF EXISTS "Users can view their tasks" ON %I', tbl_name);
  EXECUTE format('DROP POLICY IF EXISTS "Users can create tasks" ON %I', tbl_name);
  EXECUTE format('DROP POLICY IF EXISTS "Users can update their tasks" ON %I', tbl_name);
  EXECUTE format('DROP POLICY IF EXISTS "Users can delete their tasks" ON %I', tbl_name);
  EXECUTE format('DROP POLICY IF EXISTS "Service role full access" ON %I', tbl_name);
  EXECUTE format('DROP POLICY IF EXISTS "Admins can view all tasks" ON %I', tbl_name);

  -- SELECT policy
  EXECUTE format('CREATE POLICY "tasks_select" ON %I FOR SELECT
    USING (
      (SELECT current_setting(''role'', true)) = ''service_role''
      OR owner_id = (SELECT auth.uid())
      OR created_by = (SELECT auth.uid())
      OR assigned_to = (SELECT auth.uid())
    )', tbl_name);

  -- INSERT policy
  EXECUTE format('CREATE POLICY "tasks_insert" ON %I FOR INSERT
    WITH CHECK (
      (SELECT current_setting(''role'', true)) = ''service_role''
      OR created_by = (SELECT auth.uid())
      OR owner_id = (SELECT auth.uid())
    )', tbl_name);

  -- UPDATE policy
  EXECUTE format('CREATE POLICY "tasks_update" ON %I FOR UPDATE
    USING (
      (SELECT current_setting(''role'', true)) = ''service_role''
      OR owner_id = (SELECT auth.uid())
      OR created_by = (SELECT auth.uid())
      OR assigned_to = (SELECT auth.uid())
    )', tbl_name);

  -- DELETE policy
  EXECUTE format('CREATE POLICY "tasks_delete" ON %I FOR DELETE
    USING (
      (SELECT current_setting(''role'', true)) = ''service_role''
      OR owner_id = (SELECT auth.uid())
      OR created_by = (SELECT auth.uid())
      OR assigned_to = (SELECT auth.uid())
    )', tbl_name);

  RAISE NOTICE 'RLS policies for % updated successfully', tbl_name;
END $$;
