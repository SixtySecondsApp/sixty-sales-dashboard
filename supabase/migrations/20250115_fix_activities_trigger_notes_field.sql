-- Migration: Fix activities trigger to use 'details' instead of 'notes'
-- Description: The trigger function references NEW.notes but activities table uses 'details' field
-- Date: 2025-01-15
-- Issue: Failed to create proposal: record "new" has no field "notes"

-- Fix the trigger function to use 'details' instead of 'notes'
CREATE OR REPLACE FUNCTION trigger_suggest_next_actions_for_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate suggestions for certain activity types
  IF TG_OP = 'INSERT' AND NEW.type IN ('email', 'proposal', 'call', 'demo') THEN

    -- Check if activity has details (not notes - activities table uses 'details' field)
    IF NEW.details IS NOT NULL AND LENGTH(NEW.details) > 50 THEN

      -- Call Edge Function asynchronously
      PERFORM call_suggest_next_actions_async(
        NEW.id,
        'activity',
        NEW.user_id
      );

    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the comment to reflect the fix
COMMENT ON FUNCTION trigger_suggest_next_actions_for_activity IS
  'Trigger function to auto-generate suggestions for important activities (email, proposal, call, demo). Uses details field, not notes.';

