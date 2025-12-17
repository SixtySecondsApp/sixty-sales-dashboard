-- ============================================================================
-- Migration: Org-scoped SavvyCal Integrations
-- ============================================================================
-- Purpose:
-- - Store org-wide SavvyCal integration configuration (Personal Access Token)
-- - Enable per-org webhook URL tokens for multi-tenant external readiness
-- - Store secrets in a separate admin-only table
-- - Track webhook verification and last received timestamps
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Org-scoped integration metadata (NON-SENSITIVE)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.savvycal_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connected_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Status
  is_active boolean NOT NULL DEFAULT true,

  -- Webhook routing token (stable per-org, unique)
  webhook_token text NOT NULL UNIQUE,

  -- Webhook verification tracking
  webhook_configured_at timestamptz,
  webhook_last_received_at timestamptz,
  webhook_last_event_id text,

  -- Sync tracking
  last_sync_at timestamptz,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT savvycal_integrations_org_id_unique UNIQUE (org_id)
);

CREATE INDEX IF NOT EXISTS idx_savvycal_integrations_org_id
  ON public.savvycal_integrations(org_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_savvycal_integrations_webhook_token
  ON public.savvycal_integrations(webhook_token);

-- ----------------------------------------------------------------------------
-- 2) Org-scoped credentials (SENSITIVE, admin-only)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.savvycal_integration_secrets (
  integration_id uuid PRIMARY KEY REFERENCES public.savvycal_integrations(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- SavvyCal API credentials (Public Key + Private Key)
  api_public_key text,
  api_private_key text,

  -- Legacy: single token field (for backwards compatibility)
  api_token text,

  -- Optional webhook signature secret (for HMAC verification)
  webhook_secret text,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Keep org_id aligned with parent
  CONSTRAINT savvycal_integration_secrets_org_matches_parent
    FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_savvycal_integration_secrets_org_id
  ON public.savvycal_integration_secrets(org_id);

-- ----------------------------------------------------------------------------
-- 3) updated_at triggers
-- ----------------------------------------------------------------------------

-- Reuse existing update_updated_at_column() if present, else create
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

DROP TRIGGER IF EXISTS update_savvycal_integrations_updated_at ON public.savvycal_integrations;
CREATE TRIGGER update_savvycal_integrations_updated_at
  BEFORE UPDATE ON public.savvycal_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_savvycal_integration_secrets_updated_at ON public.savvycal_integration_secrets;
CREATE TRIGGER update_savvycal_integration_secrets_updated_at
  BEFORE UPDATE ON public.savvycal_integration_secrets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 4) Row Level Security
-- ----------------------------------------------------------------------------

ALTER TABLE public.savvycal_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savvycal_integration_secrets ENABLE ROW LEVEL SECURITY;

-- savvycal_integrations: org members can SELECT; org admins can manage; service role can manage
DROP POLICY IF EXISTS "savvycal_integrations_select" ON public.savvycal_integrations;
CREATE POLICY "savvycal_integrations_select"
  ON public.savvycal_integrations
  FOR SELECT
  USING (
    public.is_service_role()
    OR public.can_access_org_data(org_id)
  );

DROP POLICY IF EXISTS "savvycal_integrations_admin_insert" ON public.savvycal_integrations;
CREATE POLICY "savvycal_integrations_admin_insert"
  ON public.savvycal_integrations
  FOR INSERT
  WITH CHECK (
    public.is_service_role()
    OR public.can_admin_org(org_id)
  );

DROP POLICY IF EXISTS "savvycal_integrations_admin_update" ON public.savvycal_integrations;
CREATE POLICY "savvycal_integrations_admin_update"
  ON public.savvycal_integrations
  FOR UPDATE
  USING (
    public.is_service_role()
    OR public.can_admin_org(org_id)
  )
  WITH CHECK (
    public.is_service_role()
    OR public.can_admin_org(org_id)
  );

DROP POLICY IF EXISTS "savvycal_integrations_admin_delete" ON public.savvycal_integrations;
CREATE POLICY "savvycal_integrations_admin_delete"
  ON public.savvycal_integrations
  FOR DELETE
  USING (
    public.is_service_role()
    OR public.can_admin_org(org_id)
  );

-- savvycal_integration_secrets: org admins only (and service role)
DROP POLICY IF EXISTS "savvycal_integration_secrets_admin_all" ON public.savvycal_integration_secrets;
CREATE POLICY "savvycal_integration_secrets_admin_all"
  ON public.savvycal_integration_secrets
  FOR ALL
  USING (
    public.is_service_role()
    OR public.can_admin_org(org_id)
  )
  WITH CHECK (
    public.is_service_role()
    OR public.can_admin_org(org_id)
  );

-- ----------------------------------------------------------------------------
-- 5) Comments
-- ----------------------------------------------------------------------------

COMMENT ON TABLE public.savvycal_integrations IS 'Org-scoped SavvyCal integration metadata (non-sensitive). Stores webhook token for per-org routing.';
COMMENT ON COLUMN public.savvycal_integrations.webhook_token IS 'Unique token used in webhook URL for org identification.';
COMMENT ON COLUMN public.savvycal_integrations.webhook_configured_at IS 'Timestamp when webhook was verified as configured in SavvyCal.';
COMMENT ON COLUMN public.savvycal_integrations.webhook_last_received_at IS 'Timestamp of last successful webhook received from SavvyCal.';

COMMENT ON TABLE public.savvycal_integration_secrets IS 'Org-scoped SavvyCal credentials (admin-only). Stores Personal Access Token.';
COMMENT ON COLUMN public.savvycal_integration_secrets.api_token IS 'SavvyCal Personal Access Token (pt_secret_...).';
COMMENT ON COLUMN public.savvycal_integration_secrets.webhook_secret IS 'Optional secret for HMAC signature verification of webhooks.';





