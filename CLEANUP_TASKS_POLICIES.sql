-- Cleanup duplicate RLS policies on tasks table
-- This will remove all old policies and keep only the essential ones

-- Drop ALL existing policies
DROP POLICY IF EXISTS "tasks_full_access" ON tasks;
DROP POLICY IF EXISTS "tasks_service_role_all" ON tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks they created" ON tasks;
DROP POLICY IF EXISTS "tasks_delete_policy" ON tasks;
DROP POLICY IF EXISTS "Allow all inserts" ON tasks;
DROP POLICY IF EXISTS "Users can create tasks" ON tasks;
DROP POLICY IF EXISTS "tasks_insert_policy" ON tasks;
DROP POLICY IF EXISTS "Users can view own assigned tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view tasks they created" ON tasks;
DROP POLICY IF EXISTS "Users can view their tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view their tasks with meetings" ON tasks;
DROP POLICY IF EXISTS "tasks_select_policy" ON tasks;
DROP POLICY IF EXISTS "Users can update own assigned tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON tasks;
DROP POLICY IF EXISTS "tasks_update_policy" ON tasks;

-- Create clean, minimal set of policies

-- INSERT: Allow all inserts (needed for Edge Functions)
CREATE POLICY "Allow all inserts"
  ON tasks
  FOR INSERT
  WITH CHECK (true);

-- SELECT: Users can view tasks they're assigned to or created
CREATE POLICY "Users can view own tasks"
  ON tasks
  FOR SELECT
  USING (auth.uid() = assigned_to OR auth.uid() = created_by);

-- UPDATE: Users can update tasks they're assigned to or created
CREATE POLICY "Users can update own tasks"
  ON tasks
  FOR UPDATE
  USING (auth.uid() = assigned_to OR auth.uid() = created_by);

-- DELETE: Users can delete tasks they're assigned to or created
CREATE POLICY "Users can delete own tasks"
  ON tasks
  FOR DELETE
  USING (auth.uid() = assigned_to OR auth.uid() = created_by);

-- Verify final state
SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'tasks'
ORDER BY cmd, policyname;
