-- Fix auto_link_calendar_event_to_contact trigger to use correct column name
-- IMPORTANT: contacts table uses owner_id NOT user_id (per CLAUDE.md documentation)
-- This was causing the trigger to fail to link calendar events to contacts

DROP FUNCTION IF EXISTS auto_link_calendar_event_to_contact() CASCADE;

CREATE OR REPLACE FUNCTION auto_link_calendar_event_to_contact()
RETURNS TRIGGER AS $$
DECLARE
  v_contact_id UUID;
  v_company_id UUID;
BEGIN
  -- Only process if contact_id is not already set
  IF NEW.contact_id IS NULL AND NEW.organizer_email IS NOT NULL THEN
    -- Try to find contact by email
    -- FIXED: Changed user_id to owner_id (contacts table uses owner_id)
    SELECT id, company_id INTO v_contact_id, v_company_id
    FROM contacts
    WHERE email = NEW.organizer_email
      AND owner_id = NEW.user_id
    LIMIT 1;

    IF v_contact_id IS NOT NULL THEN
      NEW.contact_id = v_contact_id;
      NEW.company_id = v_company_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger for auto-linking
CREATE TRIGGER auto_link_calendar_event
  BEFORE INSERT OR UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_calendar_event_to_contact();

-- Add comment explaining the fix
COMMENT ON FUNCTION auto_link_calendar_event_to_contact() IS 'Auto-links calendar events to contacts by email. Uses owner_id from contacts table, not user_id.';
