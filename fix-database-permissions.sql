-- ============================================================================
-- Fix "Database error granting use" - Comprehensive Permission Fix
-- ============================================================================
-- Run this in Supabase Dashboard → SQL Editor
-- This fixes all common permission issues

-- Step 1: Grant USAGE on schemas
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO service_role;

GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA auth TO anon;
GRANT USAGE ON SCHEMA auth TO service_role;

-- Step 2: Grant SELECT on auth.users (required for RLS policies)
GRANT SELECT ON auth.users TO authenticated;
GRANT SELECT ON auth.users TO anon;
GRANT SELECT ON auth.users TO service_role;

-- Step 3: Grant permissions on common tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Step 4: Grant permissions on sequences (for auto-increment IDs)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Step 5: Grant execute permissions on functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Step 6: Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;

-- Step 7: Verify permissions
DO $$
DECLARE
  v_schema_usage INTEGER;
  v_auth_users_access INTEGER;
BEGIN
  -- Check schema usage grants
  SELECT COUNT(*) INTO v_schema_usage
  FROM information_schema.role_table_grants
  WHERE grantee IN ('authenticated', 'anon', 'service_role')
    AND table_schema = 'public'
    AND privilege_type = 'USAGE';
  
  -- Check auth.users access
  SELECT COUNT(*) INTO v_auth_users_access
  FROM information_schema.role_table_grants
  WHERE grantee IN ('authenticated', 'anon')
    AND table_schema = 'auth'
    AND table_name = 'users'
    AND privilege_type = 'SELECT';
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PERMISSION FIX SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Schema usage grants: %', v_schema_usage;
  RAISE NOTICE 'Auth.users access: %', v_auth_users_access;
  RAISE NOTICE '';
  
  IF v_schema_usage > 0 AND v_auth_users_access >= 2 THEN
    RAISE NOTICE '✅ PERMISSIONS GRANTED SUCCESSFULLY';
  ELSE
    RAISE NOTICE '⚠️  SOME PERMISSIONS MAY BE MISSING';
  END IF;
  
  RAISE NOTICE '========================================';
END $$;
































