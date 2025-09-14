-- Check the structure of google_tasks_sync_status table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'google_tasks_sync_status'
ORDER BY ordinal_position;