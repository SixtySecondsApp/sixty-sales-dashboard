-- Fix roadmap suggestions status constraint to remove 'rejected'
-- and handle any existing rejected suggestions

-- First, update any existing 'rejected' suggestions to 'completed'
UPDATE roadmap_suggestions 
SET status = 'completed', updated_at = NOW()
WHERE status = 'rejected';

-- Drop the old constraint
ALTER TABLE roadmap_suggestions 
DROP CONSTRAINT IF EXISTS roadmap_suggestions_status_check;

-- Add the new constraint without 'rejected'
ALTER TABLE roadmap_suggestions 
ADD CONSTRAINT roadmap_suggestions_status_check 
CHECK (status IN ('submitted', 'under_review', 'in_progress', 'testing', 'completed'));