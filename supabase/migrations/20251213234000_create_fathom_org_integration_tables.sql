-- ============================================================================
-- Migration: Org-scoped Fathom Integrations
-- ============================================================================
-- Purpose:
-- - Move Fathom OAuth connection from per-user to per-organization
-- - Store OAuth credentials in a service-role-only table
-- - Expose only non-sensitive integration status to org members
-- - Track sync state per org
-- - Extend fathom_oauth_states with org_id for org-scoped OAuth callbacks
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Extend OAuth state table to include org_id
-- ----------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.fathom_oauth_states
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_fathom_oauth_states_org_id
  ON public.fathom_oauth_states(org_id);

-- ----------------------------------------------------------------------------
-- 1) Org-scoped integration metadata (NON-SENSITIVE)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fathom_org_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connected_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Fathom account info
  fathom_user_id text,
  fathom_user_email text,

  -- OAuth scopes
  scopes text[] DEFAULT ARRAY['public_api'],

  -- Status
  is_active boolean DEFAULT true,
  last_sync_at timestamptz,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT fathom_org_integrations_org_id_unique UNIQUE (org_id)
);

CREATE INDEX IF NOT EXISTS idx_fathom_org_integrations_org_id
  ON public.fathom_org_integrations(org_id)
  WHERE is_active = true;

-- NOTE: Do NOT enforce uniqueness of fathom_user_email across orgs.
-- The same Fathom account (email) can legitimately be connected to multiple orgs.
-- We keep a non-unique index to support lookups.
CREATE INDEX IF NOT EXISTS idx_fathom_org_integrations_email
  ON public.fathom_org_integrations(lower(fathom_user_email))
  WHERE fathom_user_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fathom_org_integrations_fathom_user_id
  ON public.fathom_org_integrations(fathom_user_id);

-- ----------------------------------------------------------------------------
-- 2) Org-scoped credentials (SENSITIVE, service-role-only)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fathom_org_credentials (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fathom_org_credentials_token_expires_at
  ON public.fathom_org_credentials(token_expires_at);

-- ----------------------------------------------------------------------------
-- 3) Org-scoped sync state
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fathom_org_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.fathom_org_integrations(id) ON DELETE CASCADE,

  -- Sync Status
  sync_status text NOT NULL DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error')),
  cursor_position text,

  last_successful_sync timestamptz,
  last_sync_started_at timestamptz,
  last_sync_completed_at timestamptz,

  -- Error Tracking
  error_message text,
  error_count integer DEFAULT 0,
  last_error_at timestamptz,

  -- Metrics
  meetings_synced integer DEFAULT 0,
  total_meetings_found integer DEFAULT 0,

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT fathom_org_sync_state_org_id_unique UNIQUE (org_id),
  CONSTRAINT fathom_org_sync_state_integration_id_unique UNIQUE (integration_id)
);

CREATE INDEX IF NOT EXISTS idx_fathom_org_sync_state_org_id
  ON public.fathom_org_sync_state(org_id);

CREATE INDEX IF NOT EXISTS idx_fathom_org_sync_state_status
  ON public.fathom_org_sync_state(sync_status)
  WHERE sync_status = 'syncing';

-- ----------------------------------------------------------------------------
-- 4) updated_at triggers (reuse existing update_fathom_updated_at() if present)
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'update_fathom_updated_at'
  ) THEN
    -- integrations
    DROP TRIGGER IF EXISTS update_fathom_org_integrations_updated_at ON public.fathom_org_integrations;
    CREATE TRIGGER update_fathom_org_integrations_updated_at
      BEFORE UPDATE ON public.fathom_org_integrations
      FOR EACH ROW
      EXECUTE FUNCTION public.update_fathom_updated_at();

    -- sync state
    DROP TRIGGER IF EXISTS update_fathom_org_sync_state_updated_at ON public.fathom_org_sync_state;
    CREATE TRIGGER update_fathom_org_sync_state_updated_at
      BEFORE UPDATE ON public.fathom_org_sync_state
      FOR EACH ROW
      EXECUTE FUNCTION public.update_fathom_updated_at();

    -- credentials
    DROP TRIGGER IF EXISTS update_fathom_org_credentials_updated_at ON public.fathom_org_credentials;
    CREATE TRIGGER update_fathom_org_credentials_updated_at
      BEFORE UPDATE ON public.fathom_org_credentials
      FOR EACH ROW
      EXECUTE FUNCTION public.update_fathom_updated_at();
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5) Row Level Security
-- ----------------------------------------------------------------------------

ALTER TABLE public.fathom_org_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fathom_org_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fathom_org_sync_state ENABLE ROW LEVEL SECURITY;

-- Helper: detect service role (inline to avoid dependency on custom helpers)
-- NOTE: current_setting('request.jwt.claims', true) can be NULL in some contexts.

-- fathom_org_integrations
DROP POLICY IF EXISTS "fathom_org_integrations_select" ON public.fathom_org_integrations;
CREATE POLICY "fathom_org_integrations_select"
  ON public.fathom_org_integrations
  FOR SELECT
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.org_id = fathom_org_integrations.org_id
        AND om.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "fathom_org_integrations_admin_insert" ON public.fathom_org_integrations;
CREATE POLICY "fathom_org_integrations_admin_insert"
  ON public.fathom_org_integrations
  FOR INSERT
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.org_id = fathom_org_integrations.org_id
        AND om.user_id = (select auth.uid())
        AND om.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "fathom_org_integrations_admin_update" ON public.fathom_org_integrations;
CREATE POLICY "fathom_org_integrations_admin_update"
  ON public.fathom_org_integrations
  FOR UPDATE
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.org_id = fathom_org_integrations.org_id
        AND om.user_id = (select auth.uid())
        AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.org_id = fathom_org_integrations.org_id
        AND om.user_id = (select auth.uid())
        AND om.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "fathom_org_integrations_admin_delete" ON public.fathom_org_integrations;
CREATE POLICY "fathom_org_integrations_admin_delete"
  ON public.fathom_org_integrations
  FOR DELETE
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.org_id = fathom_org_integrations.org_id
        AND om.user_id = (select auth.uid())
        AND om.role IN ('owner', 'admin')
    )
  );

-- fathom_org_credentials (service role only)
DROP POLICY IF EXISTS "fathom_org_credentials_service_all" ON public.fathom_org_credentials;
CREATE POLICY "fathom_org_credentials_service_all"
  ON public.fathom_org_credentials
  FOR ALL
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role')
  WITH CHECK (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- fathom_org_sync_state
DROP POLICY IF EXISTS "fathom_org_sync_state_select" ON public.fathom_org_sync_state;
CREATE POLICY "fathom_org_sync_state_select"
  ON public.fathom_org_sync_state
  FOR SELECT
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.org_id = fathom_org_sync_state.org_id
        AND om.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "fathom_org_sync_state_service_write" ON public.fathom_org_sync_state;
CREATE POLICY "fathom_org_sync_state_service_write"
  ON public.fathom_org_sync_state
  FOR INSERT
  WITH CHECK (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

DROP POLICY IF EXISTS "fathom_org_sync_state_service_update" ON public.fathom_org_sync_state;
CREATE POLICY "fathom_org_sync_state_service_update"
  ON public.fathom_org_sync_state
  FOR UPDATE
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role')
  WITH CHECK (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- ----------------------------------------------------------------------------
-- 6) Comments
-- ----------------------------------------------------------------------------

COMMENT ON TABLE public.fathom_org_integrations IS 'Org-scoped Fathom integration metadata (non-sensitive).';
COMMENT ON TABLE public.fathom_org_credentials IS 'Org-scoped Fathom OAuth credentials (service-role-only).';
COMMENT ON TABLE public.fathom_org_sync_state IS 'Tracks org-level Fathom sync progress and metrics.';

