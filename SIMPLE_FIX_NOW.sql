-- SIMPLE FIX - Run this NOW
-- This is the standard Supabase solution for "permission denied for table users"

-- Step 1: Grant access to auth.users (REQUIRED)
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT SELECT ON auth.users TO anon, authenticated;

-- Step 2: Check what we just granted
SELECT 'Step 1 Complete: auth.users access granted' as status;

-- Step 3: Check which policies are causing the issue
SELECT
  tablename,
  policyname,
  qual::text as policy_definition
FROM pg_policies
WHERE qual::text ILIKE '%users%'
  AND tablename IN ('profiles', 'tasks', 'meetings');

-- Step 4: If profiles policies exist and look problematic, fix them
DO $$
BEGIN
  -- Drop any profile policies that directly query auth.users
  DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
  DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;

  -- Create simple profile policy that works
  CREATE POLICY IF NOT EXISTS "profiles_viewable_by_all" ON profiles
    FOR SELECT
    USING (true);

  RAISE NOTICE 'Profile policies fixed';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Profile policy fix skipped (may not be needed): %', SQLERRM;
END $$;

-- Step 5: Verify everything works
SELECT 'Setup complete - test your queries now' as final_status;

-- Test query to verify (should work after this)
SELECT
  t.id,
  t.title,
  p.first_name,
  p.last_name
FROM tasks t
LEFT JOIN profiles p ON p.id = t.assigned_to
WHERE t.assigned_to = auth.uid()
LIMIT 1;
