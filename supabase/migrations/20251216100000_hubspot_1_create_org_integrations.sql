-- ============================================================================
-- Migration: HubSpot Org-wide Integration (OAuth + Webhooks + Sync Queue)
-- ============================================================================
-- Purpose:
-- - Store org-wide HubSpot connection metadata (non-sensitive)
-- - Store OAuth credentials in service-role-only table (sensitive)
-- - Store OAuth state for CSRF protection (org-scoped)
-- - Provide mapping tables for Sixty<->HubSpot object IDs
-- - Provide webhook idempotency store
-- - Provide DB-backed sync queue for rate limiting + retries
-- - Provide admin-configurable settings (pipeline/stage mapping, field mapping, etc.)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) updated_at trigger helper (reuse if present)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'update_updated_at_column'
  ) THEN
    CREATE OR REPLACE FUNCTION public.update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1) OAuth state table (org-scoped)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hubspot_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  redirect_uri text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hubspot_oauth_states_state
  ON public.hubspot_oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_hubspot_oauth_states_org_id
  ON public.hubspot_oauth_states(org_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_oauth_states_expires_at
  ON public.hubspot_oauth_states(expires_at);

CREATE OR REPLACE FUNCTION public.cleanup_expired_hubspot_oauth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM public.hubspot_oauth_states
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_hubspot_oauth_states() TO service_role;

-- ----------------------------------------------------------------------------
-- 2) Org-scoped integration metadata (NON-SENSITIVE)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hubspot_org_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connected_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Status
  is_active boolean NOT NULL DEFAULT true,
  is_connected boolean NOT NULL DEFAULT false,
  connected_at timestamptz,

  -- HubSpot account metadata
  hubspot_portal_id text,
  hubspot_hub_id text,
  hubspot_account_name text,

  -- Scopes granted
  scopes text[] DEFAULT '{}'::text[],

  -- Webhook routing token (stable per org; used in branded URL)
  webhook_token text NOT NULL UNIQUE,
  webhook_last_received_at timestamptz,
  webhook_last_event_id text,

  -- Sync tracking
  last_sync_at timestamptz,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT hubspot_org_integrations_org_id_unique UNIQUE (org_id)
);

CREATE INDEX IF NOT EXISTS idx_hubspot_org_integrations_org_id
  ON public.hubspot_org_integrations(org_id)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_hubspot_org_integrations_webhook_token
  ON public.hubspot_org_integrations(webhook_token);

DROP TRIGGER IF EXISTS update_hubspot_org_integrations_updated_at ON public.hubspot_org_integrations;
CREATE TRIGGER update_hubspot_org_integrations_updated_at
  BEFORE UPDATE ON public.hubspot_org_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 3) Org-scoped credentials (SENSITIVE, service-role-only)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hubspot_org_credentials (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hubspot_org_credentials_token_expires_at
  ON public.hubspot_org_credentials(token_expires_at);

DROP TRIGGER IF EXISTS update_hubspot_org_credentials_updated_at ON public.hubspot_org_credentials;
CREATE TRIGGER update_hubspot_org_credentials_updated_at
  BEFORE UPDATE ON public.hubspot_org_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 4) Org-scoped sync state
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hubspot_org_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- cursor/state per domain (JSON so we can evolve without migrations)
  cursors jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_successful_sync timestamptz,
  last_sync_started_at timestamptz,
  last_sync_completed_at timestamptz,

  sync_status text NOT NULL DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error')),
  error_message text,
  error_count integer NOT NULL DEFAULT 0,
  last_error_at timestamptz,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT hubspot_org_sync_state_org_id_unique UNIQUE (org_id)
);

CREATE INDEX IF NOT EXISTS idx_hubspot_org_sync_state_org_id
  ON public.hubspot_org_sync_state(org_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_org_sync_state_status
  ON public.hubspot_org_sync_state(sync_status)
  WHERE sync_status = 'syncing';

DROP TRIGGER IF EXISTS update_hubspot_org_sync_state_updated_at ON public.hubspot_org_sync_state;
CREATE TRIGGER update_hubspot_org_sync_state_updated_at
  BEFORE UPDATE ON public.hubspot_org_sync_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 5) Object mappings (Sixty <-> HubSpot IDs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hubspot_object_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  object_type text NOT NULL CHECK (object_type IN ('contact', 'deal', 'task', 'note', 'quote', 'line_item', 'custom', 'form_submission')),

  -- Sixty identifiers
  sixty_id uuid,
  sixty_key text,

  -- HubSpot identifier (CRM object id as string)
  hubspot_id text NOT NULL,

  last_synced_at timestamptz,
  last_seen_hubspot_modified_at timestamptz,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT hubspot_object_mappings_unique_hubspot UNIQUE (org_id, object_type, hubspot_id),
  CONSTRAINT hubspot_object_mappings_unique_sixty_id UNIQUE (org_id, object_type, sixty_id),
  CONSTRAINT hubspot_object_mappings_unique_sixty_key UNIQUE (org_id, object_type, sixty_key)
);

-- Allow nullable sixty_id/sixty_key while keeping uniqueness meaningful
CREATE UNIQUE INDEX IF NOT EXISTS hubspot_object_mappings_unique_sixty_id_not_null
  ON public.hubspot_object_mappings(org_id, object_type, sixty_id)
  WHERE sixty_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS hubspot_object_mappings_unique_sixty_key_not_null
  ON public.hubspot_object_mappings(org_id, object_type, sixty_key)
  WHERE sixty_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hubspot_object_mappings_org_type
  ON public.hubspot_object_mappings(org_id, object_type);
CREATE INDEX IF NOT EXISTS idx_hubspot_object_mappings_hubspot_id
  ON public.hubspot_object_mappings(org_id, hubspot_id);

DROP TRIGGER IF EXISTS update_hubspot_object_mappings_updated_at ON public.hubspot_object_mappings;
CREATE TRIGGER update_hubspot_object_mappings_updated_at
  BEFORE UPDATE ON public.hubspot_object_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 6) Webhook idempotency store
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hubspot_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id text NOT NULL,
  event_type text NOT NULL,
  occurred_at timestamptz,
  payload_hash text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz DEFAULT now(),
  processed_at timestamptz,

  CONSTRAINT hubspot_webhook_events_org_event_unique UNIQUE (org_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_hubspot_webhook_events_org_received_at
  ON public.hubspot_webhook_events(org_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_hubspot_webhook_events_org_type
  ON public.hubspot_webhook_events(org_id, event_type);

-- ----------------------------------------------------------------------------
-- 7) Sync queue (DB-backed, service role only)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hubspot_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type IN (
    'sync_contact',
    'sync_deal',
    'sync_task',
    'push_note',
    'sync_quote',
    'sync_line_item',
    'poll_form_submissions',
    'ensure_properties',
    'sync_custom_object'
  )),
  priority integer NOT NULL DEFAULT 0,
  run_after timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 10,
  last_error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text,
  created_at timestamptz DEFAULT now()
);

-- Dedupe key is optional; if present, prevent duplicate queued work items per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_hubspot_sync_queue_dedupe_key
  ON public.hubspot_sync_queue(org_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL AND dedupe_key <> '';

CREATE INDEX IF NOT EXISTS idx_hubspot_sync_queue_ready
  ON public.hubspot_sync_queue(run_after ASC, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_hubspot_sync_queue_org
  ON public.hubspot_sync_queue(org_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_sync_queue_job_type
  ON public.hubspot_sync_queue(job_type);

-- ----------------------------------------------------------------------------
-- 8) Admin-configurable settings
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hubspot_settings (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS update_hubspot_settings_updated_at ON public.hubspot_settings;
CREATE TRIGGER update_hubspot_settings_updated_at
  BEFORE UPDATE ON public.hubspot_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 9) Row Level Security
-- ----------------------------------------------------------------------------
ALTER TABLE public.hubspot_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hubspot_org_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hubspot_org_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hubspot_org_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hubspot_object_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hubspot_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hubspot_sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hubspot_settings ENABLE ROW LEVEL SECURITY;

-- hubspot_oauth_states: service role only
DROP POLICY IF EXISTS "hubspot_oauth_states_service_all" ON public.hubspot_oauth_states;
CREATE POLICY "hubspot_oauth_states_service_all"
  ON public.hubspot_oauth_states
  FOR ALL
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

-- hubspot_org_integrations: org members can select; org admins can manage; service role can manage
DROP POLICY IF EXISTS "hubspot_org_integrations_select" ON public.hubspot_org_integrations;
CREATE POLICY "hubspot_org_integrations_select"
  ON public.hubspot_org_integrations
  FOR SELECT
  USING (public.is_service_role() OR public.can_access_org_data(org_id));

DROP POLICY IF EXISTS "hubspot_org_integrations_admin_all" ON public.hubspot_org_integrations;
CREATE POLICY "hubspot_org_integrations_admin_all"
  ON public.hubspot_org_integrations
  FOR ALL
  USING (public.is_service_role() OR public.can_admin_org(org_id))
  WITH CHECK (public.is_service_role() OR public.can_admin_org(org_id));

-- hubspot_org_credentials: service role only
DROP POLICY IF EXISTS "hubspot_org_credentials_service_all" ON public.hubspot_org_credentials;
CREATE POLICY "hubspot_org_credentials_service_all"
  ON public.hubspot_org_credentials
  FOR ALL
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

-- hubspot_org_sync_state: org members can select; service role can write
DROP POLICY IF EXISTS "hubspot_org_sync_state_select" ON public.hubspot_org_sync_state;
CREATE POLICY "hubspot_org_sync_state_select"
  ON public.hubspot_org_sync_state
  FOR SELECT
  USING (public.is_service_role() OR public.can_access_org_data(org_id));

DROP POLICY IF EXISTS "hubspot_org_sync_state_service_write" ON public.hubspot_org_sync_state;
CREATE POLICY "hubspot_org_sync_state_service_write"
  ON public.hubspot_org_sync_state
  FOR ALL
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

-- hubspot_object_mappings: service role only (avoid client tampering / loops)
DROP POLICY IF EXISTS "hubspot_object_mappings_service_all" ON public.hubspot_object_mappings;
CREATE POLICY "hubspot_object_mappings_service_all"
  ON public.hubspot_object_mappings
  FOR ALL
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

-- hubspot_webhook_events: service role only
DROP POLICY IF EXISTS "hubspot_webhook_events_service_all" ON public.hubspot_webhook_events;
CREATE POLICY "hubspot_webhook_events_service_all"
  ON public.hubspot_webhook_events
  FOR ALL
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

-- hubspot_sync_queue: service role only
DROP POLICY IF EXISTS "hubspot_sync_queue_service_all" ON public.hubspot_sync_queue;
CREATE POLICY "hubspot_sync_queue_service_all"
  ON public.hubspot_sync_queue
  FOR ALL
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

-- hubspot_settings: org members can select; org admins can manage; service role can manage
DROP POLICY IF EXISTS "hubspot_settings_select" ON public.hubspot_settings;
CREATE POLICY "hubspot_settings_select"
  ON public.hubspot_settings
  FOR SELECT
  USING (public.is_service_role() OR public.can_access_org_data(org_id));

DROP POLICY IF EXISTS "hubspot_settings_admin_all" ON public.hubspot_settings;
CREATE POLICY "hubspot_settings_admin_all"
  ON public.hubspot_settings
  FOR ALL
  USING (public.is_service_role() OR public.can_admin_org(org_id))
  WITH CHECK (public.is_service_role() OR public.can_admin_org(org_id));

-- ----------------------------------------------------------------------------
-- 10) Comments
-- ----------------------------------------------------------------------------
COMMENT ON TABLE public.hubspot_org_integrations IS 'Org-scoped HubSpot integration metadata (non-sensitive). Stores webhook token for per-org routing.';
COMMENT ON TABLE public.hubspot_org_credentials IS 'Org-scoped HubSpot OAuth credentials (service-role-only).';
COMMENT ON TABLE public.hubspot_object_mappings IS 'Maps Sixty entities to HubSpot objects for bidirectional sync and loop prevention.';
COMMENT ON TABLE public.hubspot_sync_queue IS 'DB-backed queue for HubSpot sync jobs (rate limited + retried by worker).';
COMMENT ON TABLE public.hubspot_webhook_events IS 'Idempotency store for HubSpot webhook deliveries.';
COMMENT ON TABLE public.hubspot_settings IS 'Admin-configurable mapping/settings for HubSpot sync.';

