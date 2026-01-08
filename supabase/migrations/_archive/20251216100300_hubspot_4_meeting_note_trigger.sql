-- HubSpot: enqueue meeting summary writeback as Notes
-- When a meeting summary is generated/updated, enqueue a push_note job for the org.

CREATE OR REPLACE FUNCTION public.enqueue_hubspot_meeting_note()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_hubspot boolean;
BEGIN
  -- Only when we have an org context
  IF NEW.org_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only enqueue when summary becomes available/changes
  IF (NEW.summary IS NULL OR btrim(NEW.summary) = '') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (OLD.summary IS NOT DISTINCT FROM NEW.summary)
       AND (OLD.next_actions_generated_at IS NOT DISTINCT FROM NEW.next_actions_generated_at)
       AND (OLD.next_steps_oneliner IS NOT DISTINCT FROM NEW.next_steps_oneliner) THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM public.hubspot_org_integrations i
    WHERE i.org_id = NEW.org_id
      AND i.is_active = true
      AND i.is_connected = true
  ) INTO has_hubspot;

  IF NOT has_hubspot THEN
    RETURN NEW;
  END IF;

  -- Enqueue writeback job (idempotent via dedupe_key)
  INSERT INTO public.hubspot_sync_queue (
    org_id,
    clerk_org_id,
    job_type,
    priority,
    run_after,
    attempts,
    max_attempts,
    payload,
    dedupe_key
  )
  VALUES (
    NEW.org_id,
    NEW.clerk_org_id,
    'push_note',
    50,
    now(),
    0,
    10,
    jsonb_build_object('meeting_id', NEW.id),
    'meeting_note:' || NEW.id
  )
  ON CONFLICT (org_id, dedupe_key) DO UPDATE SET
    run_after = EXCLUDED.run_after,
    payload = EXCLUDED.payload,
    attempts = 0,
    last_error = NULL,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_hubspot_meeting_note ON public.meetings;
CREATE TRIGGER trg_enqueue_hubspot_meeting_note
AFTER INSERT OR UPDATE OF summary, next_actions_generated_at, next_steps_oneliner
ON public.meetings
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_hubspot_meeting_note();


