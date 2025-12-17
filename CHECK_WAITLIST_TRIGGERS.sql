-- Check what triggers exist on meetings_waitlist table
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'meetings_waitlist'
ORDER BY trigger_name;

-- Check if waitlist_admin_actions table exists
SELECT 
  table_name,
  table_schema
FROM information_schema.tables
WHERE table_name = 'waitlist_admin_actions';

-- Check if the trigger function exists
SELECT 
  proname as function_name,
  prosrc as function_body
FROM pg_proc
WHERE proname = 'log_waitlist_admin_action';
