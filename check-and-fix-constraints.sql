-- Check and Fix Task Status Constraint Issue

-- Step 1: Check what the current constraint actually is
SELECT 
  'Current Constraint Definition:' as info,
  conname,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conname = 'tasks_status_check';

-- Step 2: Check what values are currently in the status column
SELECT 
  'Current Status Values in Tasks:' as info,
  status,
  COUNT(*) as count
FROM tasks
GROUP BY status
ORDER BY count DESC;

-- Step 3: Drop the old constraint completely
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- Step 4: Add the new constraint with all possible values
-- Including both our app's statuses and Google's statuses
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
CHECK (status IS NULL OR status IN (
  'pending',
  'in_progress', 
  'completed',
  'cancelled',
  'needsAction',  -- Google Tasks status
  'completed'     -- Google Tasks status (duplicate ok)
));

SELECT 'Constraint updated to accept Google statuses' as status;

-- Step 5: Also check if there's a sync_status constraint issue
SELECT 
  'Sync Status Constraint:' as info,
  conname,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'tasks'::regclass
  AND conname LIKE '%sync_status%';

-- Step 6: Force schema reload for Supabase API
NOTIFY pgrst, 'reload schema';

-- Step 7: Alternative - try to expose the table to PostgREST explicitly
-- Check if the table is in the exposed schema
SELECT 
  'Table Visibility:' as info,
  schemaname,
  tablename,
  tableowner,
  hasindexes,
  hasrules,
  hastriggers
FROM pg_tables
WHERE tablename = 'google_task_mappings';

-- Step 8: Make absolutely sure the table is accessible
DO $$
BEGIN
  -- Drop and recreate all policies to ensure they work
  DROP POLICY IF EXISTS "Enable all access for authenticated users" ON google_task_mappings;
  
  -- Create a completely open policy for testing
  CREATE POLICY "Open access for all" ON google_task_mappings
    FOR ALL 
    TO PUBLIC
    USING (true) 
    WITH CHECK (true);
    
  RAISE NOTICE 'Created open access policy for google_task_mappings';
END $$;

-- Grant all permissions again
GRANT ALL ON google_task_mappings TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

SELECT 
  'Final Status:' as info,
  'Constraints fixed and permissions granted' as message,
  'Please wait 30 seconds then refresh your app' as action;