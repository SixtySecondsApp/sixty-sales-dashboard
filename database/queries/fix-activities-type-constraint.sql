-- Fix Activities Type Constraint
-- This script will check and fix the activities_type_check constraint

-- 1. Check current constraint definition
SELECT 
  '=== CURRENT CONSTRAINT ===' as section,
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'activities_type_check';

-- 2. Check what types currently exist in the table
SELECT 
  '=== EXISTING ACTIVITY TYPES ===' as section,
  type,
  COUNT(*) as count
FROM activities
GROUP BY type
ORDER BY count DESC;

-- 3. Drop the old constraint if it exists
ALTER TABLE activities 
DROP CONSTRAINT IF EXISTS activities_type_check;

-- 4. Add new constraint that includes all needed types
ALTER TABLE activities 
ADD CONSTRAINT activities_type_check 
CHECK (type IN ('call', 'email', 'meeting', 'task', 'proposal', 'sale', 'note', 'other', 'outbound'));

-- 5. Verify the new constraint
SELECT 
  '=== NEW CONSTRAINT ===' as section,
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'activities_type_check';

-- 6. Test inserting different types
SELECT '=== TESTING CONSTRAINT ===' as section;

-- Test with 'outbound' (should work)
INSERT INTO activities (
  user_id, type, client_name, sales_rep, details, date, status, subject
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'outbound',
  'Test Client',
  'test@example.com',
  'Test details',
  NOW(),
  'completed',
  'Test Outbound Activity'
);

-- Test with 'call' (should now work)
INSERT INTO activities (
  user_id, type, client_name, sales_rep, details, date, status, subject
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'call',
  'Test Client',
  'test@example.com',
  'Test details',
  NOW(),
  'completed',
  'Test Call Activity'
);

-- Clean up test data
DELETE FROM activities WHERE subject LIKE 'Test%Activity';

SELECT '✅ Activities type constraint fixed!' as result;