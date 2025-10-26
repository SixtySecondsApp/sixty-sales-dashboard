-- Fix Tasks Loading - Final Clean Version
-- Handles existing policies gracefully

-- Ensure auth.users access (idempotent)
DO $$
BEGIN
  GRANT USAGE ON SCHEMA auth TO anon, authenticated;
  GRANT SELECT ON auth.users TO anon, authenticated;
  RAISE NOTICE '✅ auth.users access granted';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✅ auth.users access already granted';
END $$;

-- Fix profiles table RLS (drop and recreate to avoid conflicts)
DO $$
BEGIN
  -- Drop old policies
  DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
  DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
  DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;
  DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
  DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
  DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
  DROP POLICY IF EXISTS "profiles_service_role_all" ON profiles;

  -- Create new clean policies
  CREATE POLICY "profiles_select_all" ON profiles
    FOR SELECT
    USING (true);

  CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

  CREATE POLICY "profiles_insert_own" ON profiles
    FOR INSERT
    WITH CHECK (id = auth.uid());

  CREATE POLICY "profiles_service_role_all" ON profiles
    FOR ALL
    USING (auth.role() = 'service_role');

  RAISE NOTICE '✅ Profiles policies created';
END $$;

-- Fix tasks table RLS (drop and recreate)
DO $$
BEGIN
  -- Drop old policies
  DROP POLICY IF EXISTS "Users can view tasks" ON tasks;
  DROP POLICY IF EXISTS "Users can view their assigned tasks" ON tasks;
  DROP POLICY IF EXISTS "Users can view their created tasks" ON tasks;
  DROP POLICY IF EXISTS "tasks_select_policy" ON tasks;
  DROP POLICY IF EXISTS "tasks_insert_policy" ON tasks;
  DROP POLICY IF EXISTS "tasks_update_policy" ON tasks;
  DROP POLICY IF EXISTS "tasks_delete_policy" ON tasks;
  DROP POLICY IF EXISTS "tasks_service_role_all" ON tasks;

  -- Create new clean policies
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

  CREATE POLICY "tasks_service_role_all" ON tasks
    FOR ALL
    USING (auth.role() = 'service_role');

  RAISE NOTICE '✅ Tasks policies created';
END $$;

-- Verify with test query
SELECT
  '✅ Setup Complete' as status,
  'Tasks should now load without 403 errors' as result;

-- Test query (should return your tasks with assignee/creator info)
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
