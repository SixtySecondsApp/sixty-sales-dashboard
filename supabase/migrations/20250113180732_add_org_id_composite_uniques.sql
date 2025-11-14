-- Multi-Tenant Architecture: Update composite unique constraints to include org_id
-- This ensures uniqueness is scoped per organization

-- Calendar events: composite unique on (external_id, user_id, org_id)
-- Drop existing unique constraint if it exists (may be on external_id alone or external_id + user_id)
DO $$
BEGIN
  -- Check if unique constraint exists on external_id alone
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'calendar_events_external_id_key' 
    AND conrelid = 'calendar_events'::regclass
  ) THEN
    ALTER TABLE calendar_events DROP CONSTRAINT calendar_events_external_id_key;
  END IF;
  
  -- Check if unique constraint exists on external_id + user_id
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'calendar_events_external_id_user_id_key' 
    AND conrelid = 'calendar_events'::regclass
  ) THEN
    ALTER TABLE calendar_events DROP CONSTRAINT calendar_events_external_id_user_id_key;
  END IF;
END $$;

-- Create new composite unique constraint with org_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_external_user_org_unique 
ON calendar_events(external_id, user_id, org_id) 
WHERE external_id IS NOT NULL;

-- Google integrations: composite unique on (user_id, email, org_id) if not already org-scoped
-- Note: May need to adjust based on existing schema
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'google_integrations_user_id_email_key' 
    AND conrelid = 'google_integrations'::regclass
  ) THEN
    ALTER TABLE google_integrations DROP CONSTRAINT google_integrations_user_id_email_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_google_integrations_user_email_org_unique 
ON google_integrations(user_id, email, org_id) 
WHERE email IS NOT NULL;

-- Calendar calendars: composite unique on (user_id, external_id, org_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'calendar_calendars_user_id_external_id_key' 
    AND conrelid = 'calendar_calendars'::regclass
  ) THEN
    ALTER TABLE calendar_calendars DROP CONSTRAINT calendar_calendars_user_id_external_id_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_calendars_user_external_org_unique 
ON calendar_calendars(user_id, external_id, org_id) 
WHERE external_id IS NOT NULL;

-- Leads: composite unique on (external_id, org_id) if external_id is unique
-- Note: Check existing schema - leads may have external_id as unique already
-- We'll add org_id to make it org-scoped
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'leads_external_id_key' 
    AND conrelid = 'leads'::regclass
  ) THEN
    ALTER TABLE leads DROP CONSTRAINT leads_external_id_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_external_org_unique 
ON leads(external_id, org_id) 
WHERE external_id IS NOT NULL;

-- Smart task templates: if there's a unique constraint on name or similar, add org_id
-- This ensures templates are unique per org
-- Note: Adjust based on actual schema

-- Comments
COMMENT ON INDEX idx_calendar_events_external_user_org_unique IS 'Ensures calendar events are unique per external_id, user_id, and org_id';
COMMENT ON INDEX idx_google_integrations_user_email_org_unique IS 'Ensures Google integrations are unique per user, email, and org_id';
COMMENT ON INDEX idx_calendar_calendars_user_external_org_unique IS 'Ensures calendar calendars are unique per user, external_id, and org_id';
COMMENT ON INDEX idx_leads_external_org_unique IS 'Ensures leads are unique per external_id and org_id';






