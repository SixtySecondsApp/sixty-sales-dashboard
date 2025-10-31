-- Comprehensive pg_net Extension Status Check

-- Check 1: Is extension installed?
SELECT
  'Extension Installed?' as check_name,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ YES - pg_net is installed'
    ELSE '❌ NO - pg_net is NOT installed'
  END as status
FROM pg_extension
WHERE extname = 'pg_net';

-- Check 2: Is extension available but not installed?
SELECT
  'Extension Available?' as check_name,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ YES - pg_net is available for installation'
    ELSE '❌ NO - pg_net is not available in this database'
  END as status,
  MAX(default_version) as version_available
FROM pg_available_extensions
WHERE name = 'pg_net';

-- Check 3: All installed extensions (for reference)
SELECT
  'All Extensions' as check_name,
  STRING_AGG(extname, ', ' ORDER BY extname) as installed_extensions
FROM pg_extension;

-- Check 4: Does net schema exist?
SELECT
  'net Schema Exists?' as check_name,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ YES - net schema exists'
    ELSE '❌ NO - net schema does not exist'
  END as status
FROM information_schema.schemata
WHERE schema_name = 'net';

-- Check 5: Does http_post function exist?
SELECT
  'http_post Function Exists?' as check_name,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ YES - net.http_post function exists'
    ELSE '❌ NO - net.http_post function does not exist'
  END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'net'
  AND p.proname = 'http_post';

-- Check 6: Current database and user info
SELECT
  'Database Info' as check_name,
  current_database() as database_name,
  current_user as current_user,
  session_user as session_user;

-- Check 7: Try to create extension (will fail if no permissions or already exists)
-- Uncomment below to try:
-- CREATE EXTENSION IF NOT EXISTS pg_net;
