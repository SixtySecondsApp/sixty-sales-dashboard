-- Make org_id nullable in calendar_events table
-- Multi-tenancy is not yet implemented, org_id should be optional for now
-- This allows calendar sync to work without organization context

-- Add the column if it doesn't exist (no FK constraint since organizations table doesn't exist)
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS org_id UUID;

-- Add index for performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_calendar_events_org_id ON calendar_events(org_id);

-- Add comment explaining this is for future multi-tenancy
COMMENT ON COLUMN calendar_events.org_id IS 'Organization ID for future multi-tenancy support. Currently optional as single-tenant mode is active. No FK constraint as organizations table does not exist yet.';
