-- HubSpot outbound sync enqueue triggers
-- Enqueue sync jobs when Sixty entities change, using clerk_org_id -> hubspot_org_integrations mapping.

CREATE OR REPLACE FUNCTION public.enqueue_hubspot_contact_outbound()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  IF NEW.clerk_org_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT i.org_id
    INTO v_org_id
  FROM public.hubspot_org_integrations i
  WHERE i.clerk_org_id = NEW.clerk_org_id
    AND i.is_active = true
    AND i.is_connected = true
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.hubspot_sync_queue (
    org_id, clerk_org_id, job_type, priority, run_after, attempts, max_attempts, payload, dedupe_key
  )
  VALUES (
    v_org_id, NEW.clerk_org_id, 'sync_contact', 20, now(), 0, 10,
    jsonb_build_object('sixty_contact_id', NEW.id, 'source', 'db_trigger'),
    'contact_out:' || NEW.id
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

DROP TRIGGER IF EXISTS trg_enqueue_hubspot_contact_outbound ON public.contacts;
CREATE TRIGGER trg_enqueue_hubspot_contact_outbound
AFTER INSERT OR UPDATE OF email, first_name, last_name, phone, company, title, updated_at
ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_hubspot_contact_outbound();


CREATE OR REPLACE FUNCTION public.enqueue_hubspot_deal_outbound()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  IF NEW.clerk_org_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT i.org_id
    INTO v_org_id
  FROM public.hubspot_org_integrations i
  WHERE i.clerk_org_id = NEW.clerk_org_id
    AND i.is_active = true
    AND i.is_connected = true
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.hubspot_sync_queue (
    org_id, clerk_org_id, job_type, priority, run_after, attempts, max_attempts, payload, dedupe_key
  )
  VALUES (
    v_org_id, NEW.clerk_org_id, 'sync_deal', 20, now(), 0, 10,
    jsonb_build_object('sixty_deal_id', NEW.id, 'source', 'db_trigger'),
    'deal_out:' || NEW.id
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

DROP TRIGGER IF EXISTS trg_enqueue_hubspot_deal_outbound ON public.deals;
CREATE TRIGGER trg_enqueue_hubspot_deal_outbound
AFTER INSERT OR UPDATE OF name, value, expected_close_date, stage_id, primary_contact_id, updated_at
ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_hubspot_deal_outbound();


CREATE OR REPLACE FUNCTION public.enqueue_hubspot_task_outbound()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  IF NEW.clerk_org_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT i.org_id
    INTO v_org_id
  FROM public.hubspot_org_integrations i
  WHERE i.clerk_org_id = NEW.clerk_org_id
    AND i.is_active = true
    AND i.is_connected = true
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.hubspot_sync_queue (
    org_id, clerk_org_id, job_type, priority, run_after, attempts, max_attempts, payload, dedupe_key
  )
  VALUES (
    v_org_id, NEW.clerk_org_id, 'sync_task', 20, now(), 0, 10,
    jsonb_build_object('sixty_task_id', NEW.id, 'source', 'db_trigger'),
    'task_out:' || NEW.id
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

DROP TRIGGER IF EXISTS trg_enqueue_hubspot_task_outbound ON public.tasks;
CREATE TRIGGER trg_enqueue_hubspot_task_outbound
AFTER INSERT OR UPDATE OF title, description, due_date, completed, status, assigned_to, deal_id, contact_id, updated_at
ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_hubspot_task_outbound();


-- Proposals -> HubSpot Quotes (use meeting_id -> meetings.org_id to find org)
CREATE OR REPLACE FUNCTION public.enqueue_hubspot_proposal_quote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_clerk_org_id text;
BEGIN
  IF NEW.meeting_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT m.org_id, m.clerk_org_id
    INTO v_org_id, v_clerk_org_id
  FROM public.meetings m
  WHERE m.id = NEW.meeting_id
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Ensure HubSpot integration exists for org
  IF NOT EXISTS (
    SELECT 1 FROM public.hubspot_org_integrations i
    WHERE i.org_id = v_org_id AND i.is_active = true AND i.is_connected = true
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.hubspot_sync_queue (
    org_id, clerk_org_id, job_type, priority, run_after, attempts, max_attempts, payload, dedupe_key
  )
  VALUES (
    v_org_id, v_clerk_org_id, 'sync_quote', 30, now(), 0, 10,
    jsonb_build_object('sixty_proposal_id', NEW.id, 'source', 'db_trigger'),
    'proposal_quote:' || NEW.id
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

DROP TRIGGER IF EXISTS trg_enqueue_hubspot_proposal_quote ON public.proposals;
CREATE TRIGGER trg_enqueue_hubspot_proposal_quote
AFTER INSERT OR UPDATE OF status, title, content, updated_at
ON public.proposals
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_hubspot_proposal_quote();


