-- Create function to get calendar events in a date range
CREATE OR REPLACE FUNCTION get_calendar_events_in_range(
  p_user_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE,
  p_calendar_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  external_id TEXT,
  calendar_id UUID,
  title TEXT,
  description TEXT,
  location TEXT,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  all_day BOOLEAN,
  status TEXT,
  meeting_url TEXT,
  attendees_count INTEGER,
  contact_id UUID,
  contact_name TEXT,
  company_id UUID,
  company_name TEXT,
  color TEXT,
  sync_status TEXT,
  creator_email TEXT,
  organizer_email TEXT,
  html_link TEXT,
  raw_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
    c.first_name || ' ' || c.last_name as contact_name,
    comp.id as company_id,
    comp.name as company_name,
    ce.color,
    ce.sync_status,
    ce.creator_email,
    ce.organizer_email,
    ce.html_link,
    ce.raw_data
  FROM calendar_events ce
  LEFT JOIN contacts c ON c.id = ce.contact_id
  LEFT JOIN companies comp ON comp.id = c.company_id
  WHERE ce.user_id = p_user_id
    AND ce.start_time <= p_end_date
    AND ce.end_time >= p_start_date
    AND (p_calendar_ids IS NULL OR ce.calendar_id = ANY(p_calendar_ids))
  ORDER BY ce.start_time ASC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_calendar_events_in_range TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_calendar_events_in_range IS 'Retrieves calendar events for a user within a specified date range, with optional calendar filtering';