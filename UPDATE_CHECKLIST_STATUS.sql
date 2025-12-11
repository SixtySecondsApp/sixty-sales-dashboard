-- Update P1 Launch Checklist Items to Pending QA
-- Run this in Supabase SQL Editor
-- Date: December 11, 2025

-- Update P1 items that are now complete and pending QA testing
UPDATE launch_checklist_items
SET 
  status = 'pending_qa',
  notes = CASE 
    WHEN title ILIKE '%North Star%' THEN 'Database migration, useActivationTracking hook, MeetingDetail integration - Dec 11'
    WHEN title ILIKE '%activation dashboard%' THEN 'Built at /platform/activation with glassmorphic design - Dec 11'
    WHEN title ILIKE '%usage limit%' OR title ILIKE '%warning email%' THEN 'Triggers at 80% usage, sends via Encharge, deployed to fathom-sync - Dec 11'
    WHEN title ILIKE '%trial%' AND title ILIKE '%upgrade%' THEN 'TRIAL_UPGRADE_TESTING.md checklist created - Dec 11'
    ELSE notes
  END,
  updated_at = NOW()
WHERE 
  title ILIKE '%North Star%' 
  OR title ILIKE '%activation dashboard%'
  OR title ILIKE '%usage limit%'
  OR title ILIKE '%warning email%'
  OR (title ILIKE '%trial%' AND title ILIKE '%upgrade%');

-- Also update any items that reference these P1 features
UPDATE launch_checklist_items
SET 
  status = 'pending_qa',
  notes = 'Edge function deployed with usage limit warning - Dec 11',
  updated_at = NOW()
WHERE 
  title ILIKE '%fathom%sync%'
  AND status = 'completed';

-- Verify the updates
SELECT id, title, status, notes, updated_at 
FROM launch_checklist_items 
WHERE status = 'pending_qa'
ORDER BY updated_at DESC;
