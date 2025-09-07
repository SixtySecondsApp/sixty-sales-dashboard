-- Manual SQL to add test_scenarios column to user_automation_rules table
-- Run this directly in your Supabase SQL Editor

-- Step 1: Add the column if it doesn't exist
ALTER TABLE public.user_automation_rules 
ADD COLUMN IF NOT EXISTS test_scenarios JSONB DEFAULT '[]'::jsonb;

-- Step 2: Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'user_automation_rules'
  AND column_name = 'test_scenarios';

-- Expected output: Should show the test_scenarios column with type 'jsonb'