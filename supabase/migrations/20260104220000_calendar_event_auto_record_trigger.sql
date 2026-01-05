-- Migration: Real-time trigger for auto-recording new calendar events
-- Purpose: Immediately deploy recording bot when new meetings are synced
-- Date: 2026-01-04
--
-- This trigger fires when new calendar events are inserted and checks if
-- they should be auto-recorded based on org settings. If so, it queues
-- a bot deployment immediately rather than waiting for the cron job.

-- =============================================================================
-- 1. Create function to check and trigger auto-record
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_auto_record_for_new_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  org_settings jsonb;
  auto_record_enabled boolean;
  auto_record_external_only boolean;
  auto_record_lead_time_minutes integer;
  company_domain text;
  has_external boolean;
  attendee_email text;
  supabase_url text;
  service_role_key text;
  request_id bigint;
  minutes_until_start integer;
BEGIN
  -- Only process events with meeting URLs
  IF NEW.meeting_url IS NULL OR NEW.meeting_url = '' THEN
    RETURN NEW;
  END IF;

  -- Only process events starting in the future
  IF NEW.start_time <= NOW() THEN
    RETURN NEW;
  END IF;

  -- Get org settings
  SELECT
    o.recording_settings,
    o.company_domain
  INTO org_settings, company_domain
  FROM organizations o
  WHERE o.id = NEW.org_id;

  -- Check if auto-record is enabled
  auto_record_enabled := COALESCE((org_settings->>'auto_record_enabled')::boolean, false);
  IF NOT auto_record_enabled THEN
    RETURN NEW;
  END IF;

  -- Get configuration
  auto_record_external_only := COALESCE((org_settings->>'auto_record_external_only')::boolean, true);
  auto_record_lead_time_minutes := COALESCE((org_settings->>'auto_record_lead_time_minutes')::integer, 2);

  -- Check if external-only is enabled
  IF auto_record_external_only AND company_domain IS NOT NULL THEN
    -- Check attendees for external participants
    has_external := false;

    IF NEW.attendees IS NOT NULL THEN
      FOR attendee_email IN
        SELECT jsonb_array_elements_text(
          CASE
            WHEN jsonb_typeof(NEW.attendees) = 'array' THEN
              (SELECT jsonb_agg(
                CASE
                  WHEN jsonb_typeof(elem) = 'object' THEN elem->>'email'
                  ELSE elem
                END
              ) FROM jsonb_array_elements(NEW.attendees) AS elem)
            ELSE '[]'::jsonb
          END
        )
      LOOP
        -- Check if this attendee is external (not matching company domain)
        IF attendee_email IS NOT NULL
           AND attendee_email NOT LIKE '%@' || company_domain
           AND attendee_email NOT LIKE '%.' || company_domain THEN
          has_external := true;
          EXIT;
        END IF;
      END LOOP;
    END IF;

    IF NOT has_external THEN
      -- No external attendees, skip recording
      RETURN NEW;
    END IF;
  END IF;

  -- Calculate minutes until meeting starts
  minutes_until_start := EXTRACT(EPOCH FROM (NEW.start_time - NOW())) / 60;

  -- Only trigger if meeting is within the next hour (cron handles farther out meetings)
  -- This prevents unnecessary API calls for meetings scheduled far in advance
  IF minutes_until_start > 60 THEN
    RETURN NEW;
  END IF;

  -- Queue the bot deployment via pg_net
  -- Get service role key from vault
  BEGIN
    SELECT decrypted_secret INTO service_role_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    service_role_key := NULL;
  END;

  IF service_role_key IS NULL THEN
    -- Can't deploy without service role key, let cron job handle it
    RAISE WARNING 'Auto-record trigger: service_role_key not found in vault';
    RETURN NEW;
  END IF;

  -- Get Supabase URL
  supabase_url := 'https://' ||
    regexp_replace(current_database(), '^postgres_', '') ||
    '.supabase.co';

  -- Call deploy-recording-bot edge function
  BEGIN
    SELECT extensions.http_post(
      url := supabase_url || '/functions/v1/deploy-recording-bot',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key,
        'x-user-id', NEW.user_id::text
      ),
      body := jsonb_build_object(
        'meeting_url', NEW.meeting_url,
        'meeting_title', COALESCE(NEW.title, 'Meeting'),
        'calendar_event_id', NEW.id::text
      )
    ) INTO request_id;

    RAISE LOG 'Auto-record triggered for event %, request_id: %', NEW.id, request_id;
  EXCEPTION WHEN OTHERS THEN
    -- Don't fail the insert if the bot deployment fails
    RAISE WARNING 'Failed to trigger auto-record for event %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- 2. Create the trigger
-- =============================================================================

DROP TRIGGER IF EXISTS auto_record_new_calendar_event ON calendar_events;

CREATE TRIGGER auto_record_new_calendar_event
  AFTER INSERT ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_record_for_new_event();

-- =============================================================================
-- 3. Also trigger on updates (meeting URL might be added later)
-- =============================================================================

DROP TRIGGER IF EXISTS auto_record_updated_calendar_event ON calendar_events;

CREATE TRIGGER auto_record_updated_calendar_event
  AFTER UPDATE OF meeting_url ON calendar_events
  FOR EACH ROW
  WHEN (OLD.meeting_url IS DISTINCT FROM NEW.meeting_url AND NEW.meeting_url IS NOT NULL)
  EXECUTE FUNCTION trigger_auto_record_for_new_event();

-- =============================================================================
-- 4. Add index for efficient trigger queries
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_calendar_events_upcoming_with_url
  ON calendar_events(org_id, start_time)
  WHERE meeting_url IS NOT NULL AND start_time > NOW();

-- =============================================================================
-- 5. Grant permissions
-- =============================================================================

GRANT EXECUTE ON FUNCTION trigger_auto_record_for_new_event() TO postgres;

-- =============================================================================
-- 6. Documentation
-- =============================================================================

COMMENT ON FUNCTION trigger_auto_record_for_new_event() IS
'Trigger function that auto-deploys recording bots for new calendar events.
Fires on INSERT and UPDATE (when meeting_url changes).

Conditions for triggering:
1. Event has a meeting URL
2. Event is in the future (within 60 minutes)
3. Auto-record is enabled for the org
4. If external-only is set, event has external attendees

Requires service_role_key in vault for API calls.
See: supabase/functions/deploy-recording-bot/index.ts';
