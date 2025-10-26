-- Quick fix for missing function error
-- The trigger is failing because insights aggregation functions don't exist

-- Option 1: Disable the trigger temporarily (RECOMMENDED for now)
-- This allows AI analysis to complete without blocking

DROP TRIGGER IF EXISTS trigger_aggregate_meeting_insights ON meetings;

-- Verify trigger is removed
SELECT
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_aggregate_meeting_insights';

-- Should return 0 rows

-- Comment explaining why
COMMENT ON TABLE meetings IS
'Note: Meeting insights aggregation trigger temporarily disabled to allow AI analysis to complete. Will be re-enabled after full migration sync.';

-- Option 2: Apply the full migration (if you want insights aggregation working)
-- This requires running the migration file:
-- supabase/migrations/20251025000006_create_insights_aggregation_functions.sql
