-- Debug script to check registration_url column and test insert
-- Run this in Supabase SQL Editor

-- 1. Verify the column exists and its properties
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'meetings_waitlist'
AND column_name = 'registration_url';

-- 2. Check if there are any constraints on the column
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'meetings_waitlist'::regclass
AND array_to_string(conkey, ',') IN (
  SELECT string_agg(attnum::text, ',')
  FROM pg_attribute
  WHERE attrelid = 'meetings_waitlist'::regclass
  AND attname = 'registration_url'
);

-- 3. Test a direct insert to see if registration_url is saved
-- (Use a test email that doesn't exist)
INSERT INTO meetings_waitlist (
  email,
  full_name,
  company_name,
  meeting_recorder_tool,
  crm_tool,
  task_manager_tool,
  registration_url
) VALUES (
  'test-registration-url-' || extract(epoch from now())::text || '@test.com',
  'Test User',
  'Test Company',
  'Fathom',
  'Salesforce',
  'Monday',
  '/waitlist'
)
RETURNING id, email, registration_url, created_at;

-- 4. Check the most recent entry to see registration_url
SELECT 
  id,
  email,
  registration_url,
  created_at
FROM meetings_waitlist
ORDER BY created_at DESC
LIMIT 1;


