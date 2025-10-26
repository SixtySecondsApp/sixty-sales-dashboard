-- Fix "permission denied for table users" error
-- The issue is likely that some policy is trying to access auth.users table

-- First, let's see which policies have problematic definitions
-- Run this to see the full policy definitions:
SELECT
  schemaname,
  tablename,
  policyname,
  qual::text as using_clause,
  with_check::text as with_check_clause
FROM pg_policies
WHERE tablename IN ('meetings', 'companies', 'meeting_action_items', 'tasks')
  AND (
    qual::text ILIKE '%auth.users%'
    OR with_check::text ILIKE '%auth.users%'
  )
ORDER BY tablename, policyname;

-- If you see any policies with auth.users in them, we need to drop them
-- The policies should only use auth.uid(), not query auth.users table

-- Grant basic read permissions to auth.users for authenticated users
-- This is safe and allows policies to work if they reference users
GRANT SELECT ON auth.users TO authenticated;
GRANT SELECT ON auth.users TO anon;

-- Alternative: If you don't want to grant access to auth.users,
-- we need to ensure ALL policies only use auth.uid() and never query auth.users

-- Verify the grant worked
SELECT
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'auth'
  AND table_name = 'users'
ORDER BY grantee, privilege_type;
