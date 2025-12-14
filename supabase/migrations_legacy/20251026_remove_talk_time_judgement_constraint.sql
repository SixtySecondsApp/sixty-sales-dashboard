-- Remove restrictive CHECK constraint on talk_time_judgement
-- Migration: 20251026_remove_talk_time_judgement_constraint
--
-- Issue: Claude AI returns natural language assessments like:
--   "Well-balanced conversation with good listening"
--   "Balanced conversation"
--   "Rep talked too much"
--   "Good listening"
--
-- But the constraint only allowed: 'good', 'high', 'low'
-- This caused all AI analysis UPDATEs to fail with:
--   ERROR 23514: new row violates check constraint "meetings_talk_time_judgement_check"

-- Drop the restrictive constraint
ALTER TABLE meetings
DROP CONSTRAINT IF EXISTS meetings_talk_time_judgement_check;

-- Add comment explaining the field accepts natural language
COMMENT ON COLUMN meetings.talk_time_judgement IS
'Natural language assessment of talk time balance from Claude AI (e.g., "Balanced conversation", "Rep talked too much", "Good listening")';
