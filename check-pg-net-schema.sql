-- Check pg_net table schema
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'net'
  AND table_name LIKE '%request%'
ORDER BY table_name, ordinal_position;
