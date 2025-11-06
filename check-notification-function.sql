-- Check if create_task_creation_notification function exists

SELECT
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%notification%'
ORDER BY routine_name;
