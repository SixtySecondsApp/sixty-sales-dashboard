-- ============================================================================
-- Migration: Fix internal_users RLS policies
-- ============================================================================
-- Issue: RLS was blocking authenticated users from reading internal_users table
-- This prevented the app from detecting internal users correctly
-- ============================================================================

-- Drop existing policies that may be malformed
DROP POLICY IF EXISTS "authenticated_read_internal_users" ON internal_users;
DROP POLICY IF EXISTS "service_role_manage_internal_users" ON internal_users;
DROP POLICY IF EXISTS "Allow authenticated to read internal_users" ON internal_users;
DROP POLICY IF EXISTS "Allow service role full access" ON internal_users;
DROP POLICY IF EXISTS "Allow anon to read internal_users" ON internal_users;

-- Recreate policies correctly
CREATE POLICY "Allow authenticated to read internal_users"
ON internal_users
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow service role full access"
ON internal_users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Also allow anon to read (for pre-auth checks if needed)
CREATE POLICY "Allow anon to read internal_users"
ON internal_users
FOR SELECT
TO anon
USING (true);

-- Verification
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count 
  FROM pg_policies 
  WHERE tablename = 'internal_users';
  
  RAISE NOTICE 'internal_users table now has % RLS policies ✓', v_count;
END;
$$;

