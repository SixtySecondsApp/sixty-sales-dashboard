-- Migration: Merge Discovery Call and Discovery Meeting into Discovery
-- Date: 2025-07-01
-- Purpose: Unify discovery meeting types for consistency

-- First, let's create a backup of the current state (optional but recommended)
-- You can uncomment these lines if you want to create a backup table
-- CREATE TABLE activities_backup_20250701 AS SELECT * FROM activities WHERE type = 'meeting' AND details IN ('Discovery Call', 'Discovery Meeting');

-- Update all "Discovery Call" entries to "Discovery"
UPDATE activities
SET 
  details = 'Discovery',
  updated_at = NOW()
WHERE 
  type = 'meeting' 
  AND details = 'Discovery Call';

-- Update all "Discovery Meeting" entries to "Discovery"
UPDATE activities
SET 
  details = 'Discovery',
  updated_at = NOW()
WHERE 
  type = 'meeting' 
  AND details = 'Discovery Meeting';

-- Add a comment to document this change
COMMENT ON TABLE activities IS 'Meeting types unified on 2025-07-01: Discovery Call and Discovery Meeting merged into Discovery';

-- Verify the migration (this is just for logging, won't affect the migration)
DO $$
DECLARE
  discovery_count INTEGER;
  old_discovery_call_count INTEGER;
  old_discovery_meeting_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO discovery_count FROM activities WHERE type = 'meeting' AND details = 'Discovery';
  SELECT COUNT(*) INTO old_discovery_call_count FROM activities WHERE type = 'meeting' AND details = 'Discovery Call';
  SELECT COUNT(*) INTO old_discovery_meeting_count FROM activities WHERE type = 'meeting' AND details = 'Discovery Meeting';
  
  RAISE NOTICE 'Migration complete. Discovery: %, Discovery Call: %, Discovery Meeting: %', 
    discovery_count, old_discovery_call_count, old_discovery_meeting_count;
END $$;