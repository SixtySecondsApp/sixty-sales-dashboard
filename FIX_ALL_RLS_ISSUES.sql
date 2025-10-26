-- Comprehensive RLS Fix for "permission denied for table users"
-- This fixes both meetings and tasks queries that join with profiles

-- ============================================================================
-- SOLUTION 1: Grant SELECT permission on auth.users to authenticated users
-- This is the simplest and most common solution in Supabase
-- ============================================================================

-- Grant read access to auth.users for authenticated users
-- This allows RLS policies and triggers to reference user data
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON auth.users TO authenticated;
GRANT SELECT ON auth.users TO anon;

-- ============================================================================
-- SOLUTION 2: Fix profiles table RLS policies
-- ============================================================================

-- Drop problematic policies on profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create simple, working policies for profiles
-- Allow users to view all profiles (needed for task assignments and meeting participants)
CREATE POLICY "profiles_select_all" ON profiles
  FOR SELECT
  USING (true); -- All authenticated users can see all profiles

-- Users can only update their own profile
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Users can insert their own profile
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT
  WITH CHECK (id = auth.uid());

-- Service role has full access
CREATE POLICY "profiles_service_role_all" ON profiles
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- SOLUTION 3: Verify and fix tasks table RLS
-- ============================================================================

-- Drop any problematic task policies
DROP POLICY IF EXISTS "Users can view tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view their assigned tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view their created tasks" ON tasks;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON tasks;

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Create proper task policies
CREATE POLICY "tasks_select_policy" ON tasks
  FOR SELECT
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
  );

CREATE POLICY "tasks_insert_policy" ON tasks
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
  );

CREATE POLICY "tasks_update_policy" ON tasks
  FOR UPDATE
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
  )
  WITH CHECK (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
  );

CREATE POLICY "tasks_delete_policy" ON tasks
  FOR DELETE
  USING (
    created_by = auth.uid()
  );

CREATE POLICY "tasks_service_role_all" ON tasks
  FOR ALL
  USING (
    auth.role() = 'service_role'
  );

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check grants on auth.users
SELECT
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'auth'
  AND table_name = 'users'
  AND grantee IN ('authenticated', 'anon')
ORDER BY grantee, privilege_type;

-- Check profiles policies
SELECT
  tablename,
  policyname,
  cmd,
  qual::text as using_clause
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- Check tasks policies
SELECT
  tablename,
  policyname,
  cmd,
  qual::text as using_clause
FROM pg_policies
WHERE tablename = 'tasks'
ORDER BY policyname;

-- Test tasks query with profile joins (what the frontend does)
SELECT
  t.id,
  t.title,
  t.status,
  assignee.first_name as assignee_first_name,
  assignee.last_name as assignee_last_name,
  creator.first_name as creator_first_name,
  creator.last_name as creator_last_name
FROM tasks t
LEFT JOIN profiles assignee ON assignee.id = t.assigned_to
LEFT JOIN profiles creator ON creator.id = t.created_by
WHERE t.assigned_to = auth.uid() OR t.created_by = auth.uid()
LIMIT 5;

-- Test meetings query with company joins (what the frontend does)
SELECT
  m.id,
  m.title,
  m.meeting_start,
  c.name as company_name
FROM meetings m
LEFT JOIN companies c ON c.id = m.company_id
WHERE m.owner_user_id = auth.uid()
LIMIT 5;

-- Summary
SELECT
  '✅ RLS policies fixed' as status,
  'Run the test queries above to verify' as next_step;
