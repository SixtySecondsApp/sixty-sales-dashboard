-- Check all pg_net tables
SELECT
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'net'
ORDER BY table_name;
