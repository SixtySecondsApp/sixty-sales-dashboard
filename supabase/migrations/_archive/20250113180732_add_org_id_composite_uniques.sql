-- Multi-Tenant Architecture: Update composite unique constraints to include org_id
-- This ensures uniqueness is scoped per organization
-- NOTE: All operations are conditional on table existence

-- Calendar events: composite unique on (external_id, user_id, org_id)
DO $$
BEGIN
  -- Only proceed if calendar_events table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'calendar_events') THEN
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

    -- Create new composite unique constraint with org_id
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_calendar_events_external_user_org_unique') THEN
      CREATE UNIQUE INDEX idx_calendar_events_external_user_org_unique
      ON calendar_events(external_id, user_id, org_id)
      WHERE external_id IS NOT NULL;
    END IF;
  END IF;
END $$;

-- Google integrations: composite unique on (user_id, email, org_id) if not already org-scoped
DO $$
BEGIN
  -- Only proceed if google_integrations table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'google_integrations') THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'google_integrations_user_id_email_key'
      AND conrelid = 'google_integrations'::regclass
    ) THEN
      ALTER TABLE google_integrations DROP CONSTRAINT google_integrations_user_id_email_key;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_google_integrations_user_email_org_unique') THEN
      CREATE UNIQUE INDEX idx_google_integrations_user_email_org_unique
      ON google_integrations(user_id, email, org_id)
      WHERE email IS NOT NULL;
    END IF;
  END IF;
END $$;

-- Calendar calendars: composite unique on (user_id, external_id, org_id)
DO $$
BEGIN
  -- Only proceed if calendar_calendars table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'calendar_calendars') THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'calendar_calendars_user_id_external_id_key'
      AND conrelid = 'calendar_calendars'::regclass
    ) THEN
      ALTER TABLE calendar_calendars DROP CONSTRAINT calendar_calendars_user_id_external_id_key;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_calendar_calendars_user_external_org_unique') THEN
      CREATE UNIQUE INDEX idx_calendar_calendars_user_external_org_unique
      ON calendar_calendars(user_id, external_id, org_id)
      WHERE external_id IS NOT NULL;
    END IF;
  END IF;
END $$;

-- Leads: composite unique on (external_id, org_id) if external_id is unique
DO $$
BEGIN
  -- Only proceed if leads table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leads') THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'leads_external_id_key'
      AND conrelid = 'leads'::regclass
    ) THEN
      ALTER TABLE leads DROP CONSTRAINT leads_external_id_key;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_leads_external_org_unique') THEN
      CREATE UNIQUE INDEX idx_leads_external_org_unique
      ON leads(external_id, org_id)
      WHERE external_id IS NOT NULL;
    END IF;
  END IF;
END $$;

-- Comments (only add if indexes exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_calendar_events_external_user_org_unique') THEN
    COMMENT ON INDEX idx_calendar_events_external_user_org_unique IS 'Ensures calendar events are unique per external_id, user_id, and org_id';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_google_integrations_user_email_org_unique') THEN
    COMMENT ON INDEX idx_google_integrations_user_email_org_unique IS 'Ensures Google integrations are unique per user, email, and org_id';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_calendar_calendars_user_external_org_unique') THEN
    COMMENT ON INDEX idx_calendar_calendars_user_external_org_unique IS 'Ensures calendar calendars are unique per user, external_id, and org_id';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_leads_external_org_unique') THEN
    COMMENT ON INDEX idx_leads_external_org_unique IS 'Ensures leads are unique per external_id and org_id';
  END IF;
END $$;
