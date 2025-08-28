-- Check the actual constraints on tasks and activities

-- 1. Check tasks status constraint
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'tasks'::regclass
  AND contype = 'c';

-- 2. Check what values exist in tasks status
SELECT DISTINCT status, COUNT(*) 
FROM tasks 
GROUP BY status;

-- 3. Check activities type values
SELECT DISTINCT type, COUNT(*)
FROM activities
GROUP BY type;

-- 4. Check if stages table exists and has data
SELECT * FROM stages LIMIT 5;

-- 5. Check deals columns to see if stage_id is nullable
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'deals'
  AND column_name IN ('stage_id', 'owner_id', 'company_id')
ORDER BY column_name;