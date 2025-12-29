-- Migration: Fix Fathom org integration RLS claims cast
--
-- Symptom:
--   PostgREST /rest/v1/fathom_org_integrations SELECT returning 500
--   when request.jwt.claims is unexpectedly empty string.
--
-- Fix:
--   Use a safe cast for request.jwt.claims to avoid "invalid input syntax for type json".

BEGIN;

-- Helper expression (inlined): treat NULL/"" as {}
-- coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::json->>'role'

-- fathom_org_integrations
DROP POLICY IF EXISTS "fathom_org_integrations_select" ON public.fathom_org_integrations;
CREATE POLICY "fathom_org_integrations_select"
  ON public.fathom_org_integrations
  FOR SELECT
  USING (
    coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::json->>'role' = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.org_id = fathom_org_integrations.org_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "fathom_org_integrations_admin_insert" ON public.fathom_org_integrations;
CREATE POLICY "fathom_org_integrations_admin_insert"
  ON public.fathom_org_integrations
  FOR INSERT
  WITH CHECK (
    coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::json->>'role' = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.org_id = fathom_org_integrations.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "fathom_org_integrations_admin_update" ON public.fathom_org_integrations;
CREATE POLICY "fathom_org_integrations_admin_update"
  ON public.fathom_org_integrations
  FOR UPDATE
  USING (
    coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::json->>'role' = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.org_id = fathom_org_integrations.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::json->>'role' = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.org_id = fathom_org_integrations.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "fathom_org_integrations_admin_delete" ON public.fathom_org_integrations;
CREATE POLICY "fathom_org_integrations_admin_delete"
  ON public.fathom_org_integrations
  FOR DELETE
  USING (
    coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::json->>'role' = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.org_id = fathom_org_integrations.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- fathom_org_credentials (service role only)
DROP POLICY IF EXISTS "fathom_org_credentials_service_all" ON public.fathom_org_credentials;
CREATE POLICY "fathom_org_credentials_service_all"
  ON public.fathom_org_credentials
  FOR ALL
  USING (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::json->>'role' = 'service_role')
  WITH CHECK (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::json->>'role' = 'service_role');

-- fathom_org_sync_state
DROP POLICY IF EXISTS "fathom_org_sync_state_select" ON public.fathom_org_sync_state;
CREATE POLICY "fathom_org_sync_state_select"
  ON public.fathom_org_sync_state
  FOR SELECT
  USING (
    coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::json->>'role' = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.org_id = fathom_org_sync_state.org_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "fathom_org_sync_state_service_write" ON public.fathom_org_sync_state;
CREATE POLICY "fathom_org_sync_state_service_write"
  ON public.fathom_org_sync_state
  FOR INSERT
  WITH CHECK (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::json->>'role' = 'service_role');

DROP POLICY IF EXISTS "fathom_org_sync_state_service_update" ON public.fathom_org_sync_state;
CREATE POLICY "fathom_org_sync_state_service_update"
  ON public.fathom_org_sync_state
  FOR UPDATE
  USING (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::json->>'role' = 'service_role')
  WITH CHECK (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::json->>'role' = 'service_role');

COMMIT;












