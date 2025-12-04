-- Run this in Supabase SQL Editor to force PostgREST to reload its schema cache
-- This is a harmless DDL change that triggers a cache refresh

-- 1. Make a trivial schema change (forces PostgREST to reload)
COMMENT ON TABLE profiles IS 'User profiles table - cache reload triggered';

-- 2. Verify the change worked
SELECT
  schemaname,
  tablename,
  obj_description((schemaname || '.' || tablename)::regclass) as comment
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'profiles';

-- 3. Check that profiles table is accessible
SELECT COUNT(*) as profile_count FROM profiles;

-- Success message
SELECT 'Schema cache reload triggered successfully!' as status;
