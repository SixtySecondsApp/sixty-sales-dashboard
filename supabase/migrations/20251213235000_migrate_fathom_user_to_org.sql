-- ============================================================================
-- Migration: Migrate per-user Fathom integrations to org-scoped integration
-- ============================================================================
-- Strategy: "pick latest" per org
-- - For each org, choose the most recently updated active fathom_integrations row
--   among users in that org.
-- - Create/Upsert org integration + org credentials from the chosen row.
-- - Initialize org sync state.
-- - Deactivate other user-level integrations for users in that org.
--
-- Notes:
-- - If a user belongs to multiple orgs, their single user-level integration may
--   be copied into multiple orgs (acceptable).
-- - This migration is written to be idempotent.
-- ============================================================================

DO $$
DECLARE
  v_migrated_count integer := 0;
BEGIN
  WITH picked AS (
    SELECT DISTINCT ON (om.org_id)
      om.org_id,
      fi.user_id as connected_by_user_id,
      fi.access_token,
      fi.refresh_token,
      fi.token_expires_at,
      fi.fathom_user_id,
      fi.fathom_user_email,
      fi.scopes,
      fi.last_sync_at,
      fi.created_at,
      fi.updated_at
    FROM public.organization_memberships om
    JOIN public.fathom_integrations fi
      ON fi.user_id = om.user_id
    WHERE fi.is_active = true
    ORDER BY
      om.org_id,
      fi.updated_at DESC NULLS LAST,
      fi.created_at DESC
  ),
  upsert_org AS (
    INSERT INTO public.fathom_org_integrations (
      org_id,
      connected_by_user_id,
      fathom_user_id,
      fathom_user_email,
      scopes,
      is_active,
      last_sync_at,
      created_at,
      updated_at
    )
    SELECT
      p.org_id,
      p.connected_by_user_id,
      p.fathom_user_id,
      p.fathom_user_email,
      COALESCE(p.scopes, ARRAY['public_api']::text[]),
      true,
      p.last_sync_at,
      COALESCE(p.created_at, now()),
      COALESCE(p.updated_at, now())
    FROM picked p
    ON CONFLICT (org_id)
    DO UPDATE SET
      connected_by_user_id = EXCLUDED.connected_by_user_id,
      fathom_user_id = EXCLUDED.fathom_user_id,
      fathom_user_email = EXCLUDED.fathom_user_email,
      scopes = EXCLUDED.scopes,
      is_active = true,
      last_sync_at = EXCLUDED.last_sync_at,
      updated_at = now()
    RETURNING id, org_id
  )
  INSERT INTO public.fathom_org_credentials (
    org_id,
    access_token,
    refresh_token,
    token_expires_at,
    updated_at
  )
  SELECT
    p.org_id,
    p.access_token,
    p.refresh_token,
    p.token_expires_at,
    now()
  FROM picked p
  ON CONFLICT (org_id)
  DO UPDATE SET
    access_token = EXCLUDED.access_token,
    refresh_token = EXCLUDED.refresh_token,
    token_expires_at = EXCLUDED.token_expires_at,
    updated_at = now();

  -- Initialize org sync state (best-effort)
  WITH active_org AS (
    SELECT id, org_id
    FROM public.fathom_org_integrations
    WHERE is_active = true
  )
  INSERT INTO public.fathom_org_sync_state (
    org_id,
    integration_id,
    sync_status,
    meetings_synced,
    total_meetings_found,
    created_at,
    updated_at
  )
  SELECT
    a.org_id,
    a.id,
    'idle',
    0,
    0,
    now(),
    now()
  FROM active_org a
  ON CONFLICT (org_id)
  DO UPDATE SET
    integration_id = EXCLUDED.integration_id,
    updated_at = now();

  -- Deactivate non-selected user integrations per org
  WITH picked_user AS (
    SELECT DISTINCT ON (om.org_id)
      om.org_id,
      fi.user_id as chosen_user_id
    FROM public.organization_memberships om
    JOIN public.fathom_integrations fi
      ON fi.user_id = om.user_id
    WHERE fi.is_active = true
    ORDER BY
      om.org_id,
      fi.updated_at DESC NULLS LAST,
      fi.created_at DESC
  )
  UPDATE public.fathom_integrations fi
  SET is_active = false,
      updated_at = now()
  FROM public.organization_memberships om
  JOIN picked_user pu
    ON pu.org_id = om.org_id
  WHERE fi.user_id = om.user_id
    AND fi.is_active = true
    AND fi.user_id <> pu.chosen_user_id;

  GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
  RAISE NOTICE 'Migrated org integrations; deactivated % extra user integrations', v_migrated_count;
END $$;

