-- URGENT FIX: Remove restrictive CHECK constraint on talk_time_judgement
-- This is blocking ALL AI analysis from being stored in the database
--
-- Error: new row violates check constraint "meetings_talk_time_judgement_check"
--
-- Run this SQL directly in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/editor

-- Drop the restrictive constraint
ALTER TABLE meetings
DROP CONSTRAINT IF EXISTS meetings_talk_time_judgement_check;

-- Verify it's gone
SELECT
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conname LIKE '%talk_time_judgement%';

-- Should return 0 rows if successfully removed

-- Add helpful comment
COMMENT ON COLUMN meetings.talk_time_judgement IS
'Natural language assessment of talk time balance from Claude AI (e.g., "Balanced conversation", "Rep talked too much", "Good listening")';

-- Test that it works now
SELECT 'Constraint removed successfully!' as status;
