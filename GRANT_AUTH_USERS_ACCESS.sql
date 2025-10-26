-- Direct fix for "permission denied for table users"
-- This is the most common RLS issue in Supabase

-- Grant access to auth schema and users table
-- This is REQUIRED for RLS policies that reference user data
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT SELECT ON TABLE auth.users TO anon, authenticated;

-- Also grant access to other auth tables that might be referenced
GRANT SELECT ON TABLE auth.identities TO anon, authenticated;

-- Verify the grants were applied
SELECT
  schemaname,
  tablename,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE schemaname = 'auth'
  AND tablename = 'users'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;

-- Test that auth.uid() works
SELECT
  auth.uid() as current_user_id,
  'If you see a UUID above, auth is working' as status;

-- Test a simple query that should work after the grant
SELECT
  id,
  email,
  created_at
FROM auth.users
WHERE id = auth.uid();
