-- Check if pg_net extension is enabled

-- Check extension status
SELECT
  extname,
  extversion,
  CASE
    WHEN extname = 'pg_net' THEN '✅ ENABLED'
    ELSE '❓ Unknown'
  END as status
FROM pg_extension
WHERE extname = 'pg_net';

-- If nothing returned above, pg_net is NOT enabled

-- Check if extension is available but not enabled
SELECT
  name,
  default_version,
  installed_version,
  CASE
    WHEN installed_version IS NULL THEN '❌ NOT INSTALLED'
    ELSE '✅ INSTALLED'
  END as status
FROM pg_available_extensions
WHERE name = 'pg_net';

-- Check net schema exists
SELECT
  schema_name,
  CASE
    WHEN schema_name = 'net' THEN '✅ Schema exists'
    ELSE 'checking...'
  END as status
FROM information_schema.schemata
WHERE schema_name = 'net';

-- If schema exists, check for http_post function
SELECT
  proname as function_name,
  pronargs as num_args,
  '✅ Function exists' as status
FROM pg_proc
WHERE proname = 'http_post'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'net');
