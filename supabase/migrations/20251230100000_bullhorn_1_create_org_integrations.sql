-- ============================================================================
-- Migration: Bullhorn Org-wide Integration (OAuth + Webhooks + Sync Queue)
-- ============================================================================
-- Purpose:
-- - Store org-wide Bullhorn connection metadata (non-sensitive)
-- - Store OAuth credentials in service-role-only table (sensitive)
-- - Store OAuth state for CSRF protection (org-scoped)
-- - Provide mapping tables for Sixty<->Bullhorn object IDs
-- - Provide webhook idempotency store
-- - Provide DB-backed sync queue for rate limiting + retries
-- - Provide admin-configurable settings (status/stage mapping, field mapping, etc.)
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
CREATE TABLE IF NOT EXISTS public.bullhorn_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bullhorn_oauth_states_state
  ON public.bullhorn_oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_bullhorn_oauth_states_org_id
  ON public.bullhorn_oauth_states(org_id);
CREATE INDEX IF NOT EXISTS idx_bullhorn_oauth_states_expires_at
  ON public.bullhorn_oauth_states(expires_at);

CREATE OR REPLACE FUNCTION public.cleanup_expired_bullhorn_oauth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM public.bullhorn_oauth_states
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_bullhorn_oauth_states() TO service_role;

-- ----------------------------------------------------------------------------
-- 2) Org-scoped integration metadata (NON-SENSITIVE)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bullhorn_org_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connected_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Status
  is_active boolean NOT NULL DEFAULT true,
  is_connected boolean NOT NULL DEFAULT false,
  connected_at timestamptz,

  -- Bullhorn account metadata
  bullhorn_corp_id text,
  bullhorn_account_name text,
  rest_url text,

  -- Webhook routing token (stable per org; used in branded URL)
  webhook_token text NOT NULL UNIQUE,
  webhook_last_received_at timestamptz,

  -- Sync tracking
  last_sync_at timestamptz,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT bullhorn_org_integrations_org_id_unique UNIQUE (org_id)
);

CREATE INDEX IF NOT EXISTS idx_bullhorn_org_integrations_org_id
  ON public.bullhorn_org_integrations(org_id)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_bullhorn_org_integrations_webhook_token
  ON public.bullhorn_org_integrations(webhook_token);

DROP TRIGGER IF EXISTS update_bullhorn_org_integrations_updated_at ON public.bullhorn_org_integrations;
CREATE TRIGGER update_bullhorn_org_integrations_updated_at
  BEFORE UPDATE ON public.bullhorn_org_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 3) Org-scoped credentials (SENSITIVE, service-role-only)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bullhorn_org_credentials (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  bh_rest_token text NOT NULL,
  rest_url text NOT NULL,
  corp_token text,
  token_expires_at timestamptz NOT NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bullhorn_org_credentials_token_expires_at
  ON public.bullhorn_org_credentials(token_expires_at);

DROP TRIGGER IF EXISTS update_bullhorn_org_credentials_updated_at ON public.bullhorn_org_credentials;
CREATE TRIGGER update_bullhorn_org_credentials_updated_at
  BEFORE UPDATE ON public.bullhorn_org_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 4) Org-scoped sync state
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bullhorn_org_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- cursor/state per domain (JSON so we can evolve without migrations)
  cursors jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_sync_started_at timestamptz,
  last_sync_completed_at timestamptz,

  sync_status text NOT NULL DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error')),
  error_message text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT bullhorn_org_sync_state_org_id_unique UNIQUE (org_id)
);

CREATE INDEX IF NOT EXISTS idx_bullhorn_org_sync_state_org_id
  ON public.bullhorn_org_sync_state(org_id);
CREATE INDEX IF NOT EXISTS idx_bullhorn_org_sync_state_status
  ON public.bullhorn_org_sync_state(sync_status)
  WHERE sync_status = 'syncing';

DROP TRIGGER IF EXISTS update_bullhorn_org_sync_state_updated_at ON public.bullhorn_org_sync_state;
CREATE TRIGGER update_bullhorn_org_sync_state_updated_at
  BEFORE UPDATE ON public.bullhorn_org_sync_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 5) Object mappings (Sixty <-> Bullhorn IDs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bullhorn_object_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  object_type text NOT NULL CHECK (object_type IN ('candidate', 'client_contact', 'client_corporation', 'opportunity', 'placement', 'job_order', 'note', 'task', 'appointment')),

  -- Sixty identifiers
  sixty_id uuid,
  sixty_key text,

  -- Bullhorn identifier (entity id as string)
  bullhorn_id text NOT NULL,

  last_synced_at timestamptz,
  last_seen_modified_at timestamptz,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT bullhorn_object_mappings_unique_bullhorn UNIQUE (org_id, object_type, bullhorn_id)
);

-- Allow nullable sixty_id/sixty_key while keeping uniqueness meaningful
CREATE UNIQUE INDEX IF NOT EXISTS bullhorn_object_mappings_unique_sixty_id_not_null
  ON public.bullhorn_object_mappings(org_id, object_type, sixty_id)
  WHERE sixty_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bullhorn_object_mappings_unique_sixty_key_not_null
  ON public.bullhorn_object_mappings(org_id, object_type, sixty_key)
  WHERE sixty_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bullhorn_object_mappings_org_type
  ON public.bullhorn_object_mappings(org_id, object_type);
CREATE INDEX IF NOT EXISTS idx_bullhorn_object_mappings_bullhorn_id
  ON public.bullhorn_object_mappings(org_id, bullhorn_id);

DROP TRIGGER IF EXISTS update_bullhorn_object_mappings_updated_at ON public.bullhorn_object_mappings;
CREATE TRIGGER update_bullhorn_object_mappings_updated_at
  BEFORE UPDATE ON public.bullhorn_object_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 6) Webhook idempotency store
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bullhorn_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz DEFAULT now(),
  processed_at timestamptz,

  CONSTRAINT bullhorn_webhook_events_org_event_unique UNIQUE (org_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_bullhorn_webhook_events_org_received_at
  ON public.bullhorn_webhook_events(org_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_bullhorn_webhook_events_org_type
  ON public.bullhorn_webhook_events(org_id, event_type);

-- ----------------------------------------------------------------------------
-- 7) Sync queue (DB-backed, service role only)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bullhorn_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type IN (
    'sync_candidate',
    'sync_client_contact',
    'sync_client_corporation',
    'sync_opportunity',
    'sync_placement',
    'sync_job_order',
    'sync_note',
    'sync_task',
    'sync_appointment',
    'push_note'
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_bullhorn_sync_queue_dedupe_key
  ON public.bullhorn_sync_queue(org_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL AND dedupe_key <> '';

CREATE INDEX IF NOT EXISTS idx_bullhorn_sync_queue_ready
  ON public.bullhorn_sync_queue(run_after ASC, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_bullhorn_sync_queue_org
  ON public.bullhorn_sync_queue(org_id);
CREATE INDEX IF NOT EXISTS idx_bullhorn_sync_queue_job_type
  ON public.bullhorn_sync_queue(job_type);

-- ----------------------------------------------------------------------------
-- 8) Admin-configurable settings
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bullhorn_settings (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS update_bullhorn_settings_updated_at ON public.bullhorn_settings;
CREATE TRIGGER update_bullhorn_settings_updated_at
  BEFORE UPDATE ON public.bullhorn_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 9) Row Level Security
-- ----------------------------------------------------------------------------
ALTER TABLE public.bullhorn_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bullhorn_org_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bullhorn_org_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bullhorn_org_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bullhorn_object_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bullhorn_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bullhorn_sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bullhorn_settings ENABLE ROW LEVEL SECURITY;

-- bullhorn_oauth_states: service role only
DROP POLICY IF EXISTS "bullhorn_oauth_states_service_all" ON public.bullhorn_oauth_states;
CREATE POLICY "bullhorn_oauth_states_service_all"
  ON public.bullhorn_oauth_states
  FOR ALL
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

-- bullhorn_org_integrations: org members can select; org admins can manage
DROP POLICY IF EXISTS "bullhorn_org_integrations_select" ON public.bullhorn_org_integrations;
CREATE POLICY "bullhorn_org_integrations_select"
  ON public.bullhorn_org_integrations
  FOR SELECT
  USING (public.is_service_role() OR public.can_access_org_data(org_id));

DROP POLICY IF EXISTS "bullhorn_org_integrations_admin_all" ON public.bullhorn_org_integrations;
CREATE POLICY "bullhorn_org_integrations_admin_all"
  ON public.bullhorn_org_integrations
  FOR ALL
  USING (public.is_service_role() OR public.can_admin_org(org_id))
  WITH CHECK (public.is_service_role() OR public.can_admin_org(org_id));

-- bullhorn_org_credentials: service role only
DROP POLICY IF EXISTS "bullhorn_org_credentials_service_all" ON public.bullhorn_org_credentials;
CREATE POLICY "bullhorn_org_credentials_service_all"
  ON public.bullhorn_org_credentials
  FOR ALL
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

-- bullhorn_org_sync_state: org members can select; service role can write
DROP POLICY IF EXISTS "bullhorn_org_sync_state_select" ON public.bullhorn_org_sync_state;
CREATE POLICY "bullhorn_org_sync_state_select"
  ON public.bullhorn_org_sync_state
  FOR SELECT
  USING (public.is_service_role() OR public.can_access_org_data(org_id));

DROP POLICY IF EXISTS "bullhorn_org_sync_state_service_write" ON public.bullhorn_org_sync_state;
CREATE POLICY "bullhorn_org_sync_state_service_write"
  ON public.bullhorn_org_sync_state
  FOR ALL
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

-- bullhorn_object_mappings: service role only (avoid client tampering / loops)
DROP POLICY IF EXISTS "bullhorn_object_mappings_service_all" ON public.bullhorn_object_mappings;
CREATE POLICY "bullhorn_object_mappings_service_all"
  ON public.bullhorn_object_mappings
  FOR ALL
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

-- bullhorn_webhook_events: service role only
DROP POLICY IF EXISTS "bullhorn_webhook_events_service_all" ON public.bullhorn_webhook_events;
CREATE POLICY "bullhorn_webhook_events_service_all"
  ON public.bullhorn_webhook_events
  FOR ALL
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

-- bullhorn_sync_queue: service role only
DROP POLICY IF EXISTS "bullhorn_sync_queue_service_all" ON public.bullhorn_sync_queue;
CREATE POLICY "bullhorn_sync_queue_service_all"
  ON public.bullhorn_sync_queue
  FOR ALL
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

-- bullhorn_settings: org members can select; org admins can manage
DROP POLICY IF EXISTS "bullhorn_settings_select" ON public.bullhorn_settings;
CREATE POLICY "bullhorn_settings_select"
  ON public.bullhorn_settings
  FOR SELECT
  USING (public.is_service_role() OR public.can_access_org_data(org_id));

DROP POLICY IF EXISTS "bullhorn_settings_admin_all" ON public.bullhorn_settings;
CREATE POLICY "bullhorn_settings_admin_all"
  ON public.bullhorn_settings
  FOR ALL
  USING (public.is_service_role() OR public.can_admin_org(org_id))
  WITH CHECK (public.is_service_role() OR public.can_admin_org(org_id));

-- ----------------------------------------------------------------------------
-- 10) Comments
-- ----------------------------------------------------------------------------
COMMENT ON TABLE public.bullhorn_org_integrations IS 'Org-scoped Bullhorn integration metadata (non-sensitive). Stores webhook token for per-org routing.';
COMMENT ON TABLE public.bullhorn_org_credentials IS 'Org-scoped Bullhorn OAuth credentials (service-role-only). Stores access_token, refresh_token, bh_rest_token, and rest_url.';
COMMENT ON TABLE public.bullhorn_object_mappings IS 'Maps Sixty entities to Bullhorn objects for bidirectional sync and loop prevention.';
COMMENT ON TABLE public.bullhorn_sync_queue IS 'DB-backed queue for Bullhorn sync jobs (rate limited + retried by worker).';
COMMENT ON TABLE public.bullhorn_webhook_events IS 'Idempotency store for Bullhorn webhook deliveries.';
COMMENT ON TABLE public.bullhorn_settings IS 'Admin-configurable mapping/settings for Bullhorn sync.';
