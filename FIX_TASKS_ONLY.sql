-- Fix Tasks Loading - "permission denied for table users"
-- Meetings are working, now fix tasks with profiles join

-- Ensure auth.users access is granted (may already be done)
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT SELECT ON auth.users TO anon, authenticated;

-- Fix profiles table RLS - allow all users to view all profiles
-- This is needed for task assignments (assignee and creator fields)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;

-- Create simple policy: all authenticated users can view all profiles
CREATE POLICY "profiles_select_all" ON profiles
  FOR SELECT
  USING (true);

-- Fix tasks table RLS
DROP POLICY IF EXISTS "Users can view tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view their assigned tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view their created tasks" ON tasks;

-- Create proper tasks policies
CREATE POLICY "tasks_select_policy" ON tasks
  FOR SELECT
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
  );

CREATE POLICY "tasks_insert_policy" ON tasks
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "tasks_update_policy" ON tasks
  FOR UPDATE
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
  );

CREATE POLICY "tasks_delete_policy" ON tasks
  FOR DELETE
  USING (created_by = auth.uid());

-- Service role access
CREATE POLICY "tasks_service_role_all" ON tasks
  FOR ALL
  USING (auth.role() = 'service_role');

-- Verify the fix with a test query
SELECT
  t.id,
  t.title,
  t.status,
  assignee.first_name || ' ' || assignee.last_name as assignee_name,
  creator.first_name || ' ' || creator.last_name as creator_name
FROM tasks t
LEFT JOIN profiles assignee ON assignee.id = t.assigned_to
LEFT JOIN profiles creator ON creator.id = t.created_by
WHERE t.assigned_to = auth.uid() OR t.created_by = auth.uid()
ORDER BY t.due_date
LIMIT 5;
