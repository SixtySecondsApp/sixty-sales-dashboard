-- Fix calendar_events unique constraint to ensure only one exists
-- This migration consolidates the multiple unique indexes into a single, consistent one

-- Drop all existing unique indexes on calendar_events that might conflict
-- These may have WHERE clauses that prevent ON CONFLICT resolution
-- We drop them all to ensure a clean slate before creating unconditional indexes
DROP INDEX IF EXISTS idx_calendar_events_external_id;
DROP INDEX IF EXISTS idx_calendar_events_external_user_org_unique;
DROP INDEX IF EXISTS idx_calendar_events_external_id_user;
DROP INDEX IF EXISTS idx_calendar_events_user_external_unique;

-- Create a single unique index that works with or without org_id
-- This index uses (user_id, external_id) which is the most common pattern
-- and works even if org_id is NULL
-- NOTE: No WHERE clause - PostgreSQL cannot use partial indexes for ON CONFLICT resolution
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_user_external_unique 
  ON calendar_events(user_id, external_id);

-- Also create the org-scoped index for multi-tenant support (only if org_id column exists)
-- This allows the same external_id for different orgs
DO $$
BEGIN
  -- Check if org_id column exists before creating the org-scoped index
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'calendar_events' 
    AND column_name = 'org_id'
  ) THEN
    -- NOTE: No WHERE clause - PostgreSQL cannot use partial indexes for ON CONFLICT resolution
    -- Since org_id is NOT NULL after backfill migration, this works without WHERE clause
    CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_external_user_org_unique 
      ON calendar_events(external_id, user_id, org_id);
    
    COMMENT ON INDEX idx_calendar_events_external_user_org_unique IS 'Ensures calendar events are unique per external_id, user_id, and org_id (for multi-tenant)';
  END IF;
END $$;

-- Comments
COMMENT ON INDEX idx_calendar_events_user_external_unique IS 'Ensures calendar events are unique per user and external_id (works without org_id)';

