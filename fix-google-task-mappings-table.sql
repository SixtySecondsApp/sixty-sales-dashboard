-- Fix google_task_mappings table structure and constraints
-- This fixes the 400 error when inserting mappings

-- Step 1: Check current structure of google_task_mappings
SELECT 
  'Current columns in google_task_mappings:' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'google_task_mappings'
ORDER BY ordinal_position;

-- Step 2: Check constraints
SELECT 
  'Current constraints on google_task_mappings:' as info,
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'google_task_mappings'::regclass;

-- Step 3: Add missing columns if they don't exist
ALTER TABLE google_task_mappings 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE google_task_mappings 
ADD COLUMN IF NOT EXISTS sync_direction TEXT DEFAULT 'bidirectional';

ALTER TABLE google_task_mappings 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE google_task_mappings 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Step 4: Fix any invalid google_list_id values
UPDATE google_task_mappings
SET google_list_id = '@default'
WHERE google_list_id = 'Business' 
   OR (google_list_id != '@default' AND LENGTH(google_list_id) < 20);

-- Step 5: Populate user_id if it's NULL (from task's assigned_to)
UPDATE google_task_mappings m
SET user_id = t.assigned_to
FROM tasks t
WHERE m.task_id = t.id
  AND m.user_id IS NULL;

-- Step 6: Create proper indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_task_mappings_task_id 
ON google_task_mappings(task_id);

CREATE INDEX IF NOT EXISTS idx_google_task_mappings_google_task_id 
ON google_task_mappings(google_task_id);

CREATE INDEX IF NOT EXISTS idx_google_task_mappings_user_id 
ON google_task_mappings(user_id);

CREATE INDEX IF NOT EXISTS idx_google_task_mappings_google_list_id 
ON google_task_mappings(google_list_id);

-- Step 7: Remove any duplicate mappings (keep the most recent)
DELETE FROM google_task_mappings a
USING google_task_mappings b
WHERE a.id < b.id
  AND a.task_id = b.task_id
  AND a.google_task_id = b.google_task_id;

-- Step 8: Ensure RLS is properly configured
ALTER TABLE google_task_mappings ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Users can manage their own mappings" ON google_task_mappings;
DROP POLICY IF EXISTS "Allow all for authenticated" ON google_task_mappings;
DROP POLICY IF EXISTS "Open access for all" ON google_task_mappings;

-- Create a proper RLS policy
CREATE POLICY "Users can manage their own mappings" ON google_task_mappings
  FOR ALL 
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Step 9: Grant necessary permissions
GRANT ALL ON google_task_mappings TO authenticated;
GRANT ALL ON google_task_mappings TO service_role;

-- Step 10: Check if we need a unique constraint
-- First drop any existing unique constraints that might be wrong
ALTER TABLE google_task_mappings 
DROP CONSTRAINT IF EXISTS google_task_mappings_task_id_key;

ALTER TABLE google_task_mappings 
DROP CONSTRAINT IF EXISTS google_task_mappings_google_task_id_key;

-- Add a proper composite unique constraint
ALTER TABLE google_task_mappings
DROP CONSTRAINT IF EXISTS google_task_mappings_unique;

ALTER TABLE google_task_mappings
ADD CONSTRAINT google_task_mappings_unique 
UNIQUE (task_id, google_task_id, google_list_id);

-- Step 11: Verify the fixes
SELECT 
  'Fixed columns in google_task_mappings:' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'google_task_mappings'
ORDER BY ordinal_position;

SELECT 
  'Fixed constraints:' as info,
  conname,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'google_task_mappings'::regclass;

-- Step 12: Check for any remaining issues
SELECT 
  'Mappings with invalid list IDs:' as check,
  COUNT(*) as count
FROM google_task_mappings
WHERE google_list_id != '@default' 
  AND LENGTH(google_list_id) < 20;

SELECT 
  'Mappings without user_id:' as check,
  COUNT(*) as count
FROM google_task_mappings
WHERE user_id IS NULL;

-- Final status
SELECT 
  '✅ google_task_mappings table fixed' as status,
  'Table structure and constraints are now correct' as result,
  'The 400 error should be resolved' as note;