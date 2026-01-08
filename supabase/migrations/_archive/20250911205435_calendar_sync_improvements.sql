-- Calendar Sync Improvements Migration
-- Adds support for efficient calendar event syncing and CRM integration

-- Add sync-related columns to calendar_events table
ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS external_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced' 
  CHECK (sync_status IN ('synced', 'pending', 'error', 'deleted')),
ADD COLUMN IF NOT EXISTS sync_error TEXT,
ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS original_start_time TIMESTAMPTZ, -- For recurring event tracking
ADD COLUMN IF NOT EXISTS etag TEXT, -- Google Calendar ETag for change detection
ADD COLUMN IF NOT EXISTS html_link TEXT, -- Link to event in Google Calendar
ADD COLUMN IF NOT EXISTS hangout_link TEXT, -- Google Meet link
ADD COLUMN IF NOT EXISTS creator_email TEXT,
ADD COLUMN IF NOT EXISTS organizer_email TEXT,
ADD COLUMN IF NOT EXISTS transparency TEXT DEFAULT 'opaque' 
  CHECK (transparency IN ('opaque', 'transparent')),
ADD COLUMN IF NOT EXISTS raw_data JSONB; -- Store complete Google Calendar response

-- Add sync tracking columns to calendar_calendars table
ALTER TABLE calendar_calendars
ADD COLUMN IF NOT EXISTS last_sync_token TEXT,
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS sync_frequency_minutes INT DEFAULT 5,
ADD COLUMN IF NOT EXISTS historical_sync_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS historical_sync_start_date DATE;

-- Create unique index for external_id to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_external_id 
  ON calendar_events(external_id, user_id) 
  WHERE external_id IS NOT NULL;

-- Add index for sync queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_sync_status 
  ON calendar_events(sync_status, user_id);

-- Add index for CRM linking queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_contact_id 
  ON calendar_events(contact_id) 
  WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_company_id 
  ON calendar_events(company_id) 
  WHERE company_id IS NOT NULL;

-- Add index for date range queries with user filtering
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_date_range 
  ON calendar_events(user_id, start_time, end_time);

-- Add index for organizer queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_organizer 
  ON calendar_events(organizer_email) 
  WHERE organizer_email IS NOT NULL;

-- Create table for sync logs
CREATE TABLE IF NOT EXISTS calendar_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_id UUID REFERENCES calendar_calendars(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'historical')),
  sync_status TEXT NOT NULL CHECK (sync_status IN ('started', 'completed', 'failed')),
  events_created INT DEFAULT 0,
  events_updated INT DEFAULT 0,
  events_deleted INT DEFAULT 0,
  events_skipped INT DEFAULT 0,
  error_message TEXT,
  sync_token_before TEXT,
  sync_token_after TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

-- Create index for sync log queries
CREATE INDEX idx_calendar_sync_logs_user_id ON calendar_sync_logs(user_id);
CREATE INDEX idx_calendar_sync_logs_calendar_id ON calendar_sync_logs(calendar_id);
CREATE INDEX idx_calendar_sync_logs_started_at ON calendar_sync_logs(started_at DESC);

-- Create function to auto-link events to contacts based on email
CREATE OR REPLACE FUNCTION auto_link_calendar_event_to_contact()
RETURNS TRIGGER AS $$
DECLARE
  v_contact_id UUID;
  v_company_id UUID;
BEGIN
  -- Only process if contact_id is not already set
  IF NEW.contact_id IS NULL AND NEW.organizer_email IS NOT NULL THEN
    -- Try to find contact by email
    SELECT id, company_id INTO v_contact_id, v_company_id
    FROM contacts
    WHERE email = NEW.organizer_email
      AND user_id = NEW.user_id
    LIMIT 1;
    
    IF v_contact_id IS NOT NULL THEN
      NEW.contact_id = v_contact_id;
      NEW.company_id = v_company_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-linking
CREATE TRIGGER auto_link_calendar_event
  BEFORE INSERT OR UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_calendar_event_to_contact();

-- Create view for calendar events with contact/company info
CREATE OR REPLACE VIEW calendar_events_with_contacts AS
SELECT 
  ce.*,
  COALESCE(c.full_name, CONCAT(c.first_name, ' ', c.last_name)) AS contact_name,
  c.email AS contact_email,
  c.phone AS contact_phone,
  co.name AS company_name,
  co.domain AS company_domain
FROM calendar_events ce
LEFT JOIN contacts c ON ce.contact_id = c.id
LEFT JOIN companies co ON ce.company_id = co.id;

-- Create function to get events in date range with efficient querying
CREATE OR REPLACE FUNCTION get_calendar_events_in_range(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_calendar_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  external_id TEXT,
  calendar_id UUID,
  title TEXT,
  description TEXT,
  location TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  all_day BOOLEAN,
  status TEXT,
  meeting_url TEXT,
  attendees_count INT,
  contact_id UUID,
  contact_name TEXT,
  company_id UUID,
  company_name TEXT,
  color TEXT,
  sync_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ce.id,
    ce.external_id,
    ce.calendar_id,
    ce.title,
    ce.description,
    ce.location,
    ce.start_time,
    ce.end_time,
    ce.all_day,
    ce.status,
    ce.meeting_url,
    ce.attendees_count,
    ce.contact_id,
    COALESCE(c.full_name, CONCAT(c.first_name, ' ', c.last_name))::TEXT AS contact_name,
    ce.company_id,
    co.name AS company_name,
    ce.color,
    ce.sync_status
  FROM calendar_events ce
  LEFT JOIN contacts c ON ce.contact_id = c.id
  LEFT JOIN companies co ON ce.company_id = co.id
  WHERE ce.user_id = p_user_id
    AND ce.sync_status != 'deleted'
    AND (
      (ce.start_time >= p_start_date AND ce.start_time < p_end_date)
      OR (ce.end_time > p_start_date AND ce.end_time <= p_end_date)
      OR (ce.start_time < p_start_date AND ce.end_time > p_end_date)
    )
    AND (p_calendar_ids IS NULL OR ce.calendar_id = ANY(p_calendar_ids))
  ORDER BY ce.start_time ASC;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT ALL ON calendar_sync_logs TO authenticated;
GRANT EXECUTE ON FUNCTION get_calendar_events_in_range TO authenticated;
GRANT SELECT ON calendar_events_with_contacts TO authenticated;

-- Add RLS policies for sync logs
ALTER TABLE calendar_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync logs" ON calendar_sync_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sync logs" ON calendar_sync_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE calendar_sync_logs IS 'Tracks calendar synchronization history and statistics';
COMMENT ON COLUMN calendar_events.external_updated_at IS 'Last modification time from Google Calendar';
COMMENT ON COLUMN calendar_events.sync_status IS 'Current synchronization status of the event';
COMMENT ON COLUMN calendar_events.etag IS 'Google Calendar ETag for detecting changes';
COMMENT ON COLUMN calendar_calendars.last_sync_token IS 'Google Calendar sync token for incremental updates';