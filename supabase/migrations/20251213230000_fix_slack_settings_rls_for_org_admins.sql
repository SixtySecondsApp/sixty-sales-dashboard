-- ============================================================================
-- Fix Slack settings RLS for org admins + safe org status reader
-- ============================================================================
-- Problem:
-- - RLS policies introduced in 20251210000010 restricted Slack settings updates
--   to platform admins (profiles.is_admin) and/or service role.
-- - Org admins (organization_memberships.role in ('owner','admin')) could connect
--   Slack (via service role edge functions) but could NOT toggle settings or map
--   other users from the UI (authenticated client).
-- - Non-admin org members also need to READ connection status + feature summary
--   without exposing bot_access_token.
--
-- Solution:
-- 1) Add a SECURITY DEFINER RPC to read a safe subset of slack_org_settings.
-- 2) Update RLS policies:
--    - slack_org_settings: org admins can SELECT/UPDATE (service role always ok)
--    - slack_notification_settings: org members can SELECT; org admins can INSERT/UPDATE/DELETE
--    - slack_user_mappings: org members can SELECT; org admins can UPDATE (service role always ok)
--
-- Notes:
-- - Uses helper functions created in 20251213213000_fix_org_memberships_rls_recursion_regression.sql:
--   public.is_service_role(), public.is_admin_optimized(), public.is_org_member(), public.get_org_role()
-- ============================================================================

-- ------------------------------------------------------------
-- Safe read: Slack org connection status (NO token exposure)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_slack_org_settings_public(p_org_id uuid)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  slack_team_id text,
  slack_team_name text,
  is_connected boolean,
  connected_at timestamptz,
  connected_by uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.org_id,
    s.slack_team_id,
    s.slack_team_name,
    s.is_connected,
    s.connected_at,
    s.connected_by
  FROM public.slack_org_settings s
  WHERE s.org_id = p_org_id
    AND (
      public.is_service_role()
      OR public.is_admin_optimized()
      OR public.is_org_member(auth.uid(), p_org_id)
    )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_slack_org_settings_public(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_slack_org_settings_public(uuid)
  IS 'Returns safe Slack org connection info (no bot_access_token) for org members.';

-- ------------------------------------------------------------
-- RLS: slack_org_settings (keep token protected)
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.slack_org_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "slack_org_settings_select" ON public.slack_org_settings;
CREATE POLICY "slack_org_settings_select"
  ON public.slack_org_settings
  FOR SELECT
  USING (
    public.is_service_role()
    OR public.is_admin_optimized()
    OR public.get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "slack_org_settings_insert" ON public.slack_org_settings;
CREATE POLICY "slack_org_settings_insert"
  ON public.slack_org_settings
  FOR INSERT
  WITH CHECK (public.is_service_role());

DROP POLICY IF EXISTS "slack_org_settings_update" ON public.slack_org_settings;
CREATE POLICY "slack_org_settings_update"
  ON public.slack_org_settings
  FOR UPDATE
  USING (
    public.is_service_role()
    OR public.is_admin_optimized()
    OR public.get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  )
  WITH CHECK (
    public.is_service_role()
    OR public.is_admin_optimized()
    OR public.get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "slack_org_settings_delete" ON public.slack_org_settings;
CREATE POLICY "slack_org_settings_delete"
  ON public.slack_org_settings
  FOR DELETE
  USING (public.is_service_role() OR public.is_admin_optimized());

-- ------------------------------------------------------------
-- RLS: slack_notification_settings
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.slack_notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "slack_notification_settings_select" ON public.slack_notification_settings;
CREATE POLICY "slack_notification_settings_select"
  ON public.slack_notification_settings
  FOR SELECT
  USING (
    public.is_service_role()
    OR public.is_admin_optimized()
    OR public.is_org_member(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS "slack_notification_settings_insert" ON public.slack_notification_settings;
CREATE POLICY "slack_notification_settings_insert"
  ON public.slack_notification_settings
  FOR INSERT
  WITH CHECK (
    public.is_service_role()
    OR public.is_admin_optimized()
    OR public.get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "slack_notification_settings_update" ON public.slack_notification_settings;
CREATE POLICY "slack_notification_settings_update"
  ON public.slack_notification_settings
  FOR UPDATE
  USING (
    public.is_service_role()
    OR public.is_admin_optimized()
    OR public.get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  )
  WITH CHECK (
    public.is_service_role()
    OR public.is_admin_optimized()
    OR public.get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "slack_notification_settings_delete" ON public.slack_notification_settings;
CREATE POLICY "slack_notification_settings_delete"
  ON public.slack_notification_settings
  FOR DELETE
  USING (
    public.is_service_role()
    OR public.is_admin_optimized()
    OR public.get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  );

-- ------------------------------------------------------------
-- RLS: slack_user_mappings
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS public.slack_user_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "slack_user_mappings_select" ON public.slack_user_mappings;
CREATE POLICY "slack_user_mappings_select"
  ON public.slack_user_mappings
  FOR SELECT
  USING (
    public.is_service_role()
    OR public.is_admin_optimized()
    OR public.is_org_member(auth.uid(), org_id)
  );

-- Keep inserts service-role-only: Slack events/OAuth/self-map populate the table.
DROP POLICY IF EXISTS "slack_user_mappings_insert" ON public.slack_user_mappings;
CREATE POLICY "slack_user_mappings_insert"
  ON public.slack_user_mappings
  FOR INSERT
  WITH CHECK (public.is_service_role());

DROP POLICY IF EXISTS "slack_user_mappings_update" ON public.slack_user_mappings;
CREATE POLICY "slack_user_mappings_update"
  ON public.slack_user_mappings
  FOR UPDATE
  USING (
    public.is_service_role()
    OR public.is_admin_optimized()
    OR public.get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  )
  WITH CHECK (
    public.is_service_role()
    OR public.is_admin_optimized()
    OR public.get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "slack_user_mappings_delete" ON public.slack_user_mappings;
CREATE POLICY "slack_user_mappings_delete"
  ON public.slack_user_mappings
  FOR DELETE
  USING (public.is_service_role() OR public.is_admin_optimized());











