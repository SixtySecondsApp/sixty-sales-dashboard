-- Migration: Fix Fathom per-user migration
-- Ensures all users with org-level integrations get per-user records
--
-- This handles edge cases from the revert migration:
-- 1. Users whose connected_by_user_id wasn't properly set
-- 2. Users who connected during org-mode but don't have per-user records
-- 3. Users with multiple org memberships

-- Step 1: For each org integration, ensure the connected_by_user_id has a per-user record
INSERT INTO fathom_integrations (
  user_id,
  access_token,
  refresh_token,
  token_expires_at,
  fathom_user_id,
  fathom_user_email,
  scopes,
  is_active,
  created_at,
  updated_at
)
SELECT
  oi.connected_by_user_id as user_id,
  oc.access_token,
  oc.refresh_token,
  oc.token_expires_at,
  oi.fathom_user_id,
  oi.fathom_user_email,
  COALESCE(oi.scopes, ARRAY['public_api']::text[]),
  true as is_active,
  COALESCE(oi.created_at, now()) as created_at,
  now() as updated_at
FROM fathom_org_integrations oi
JOIN fathom_org_credentials oc ON oc.org_id = oi.org_id
WHERE oi.connected_by_user_id IS NOT NULL
  -- Only insert if user doesn't already have an active per-user integration
  AND NOT EXISTS (
    SELECT 1 FROM fathom_integrations fi
    WHERE fi.user_id = oi.connected_by_user_id
      AND fi.is_active = true
  )
ON CONFLICT (user_id) DO UPDATE SET
  -- If user has an inactive record, re-activate with current tokens
  access_token = EXCLUDED.access_token,
  refresh_token = EXCLUDED.refresh_token,
  token_expires_at = EXCLUDED.token_expires_at,
  fathom_user_id = COALESCE(EXCLUDED.fathom_user_id, fathom_integrations.fathom_user_id),
  fathom_user_email = COALESCE(EXCLUDED.fathom_user_email, fathom_integrations.fathom_user_email),
  is_active = true,
  updated_at = now();

-- Step 2: Create sync state records for any restored integrations that don't have one
INSERT INTO fathom_sync_state (
  user_id,
  integration_id,
  sync_status,
  meetings_synced,
  total_meetings_found,
  created_at,
  updated_at
)
SELECT
  fi.user_id,
  fi.id as integration_id,
  'idle' as sync_status,
  0 as meetings_synced,
  0 as total_meetings_found,
  now() as created_at,
  now() as updated_at
FROM fathom_integrations fi
WHERE fi.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM fathom_sync_state fs
    WHERE fs.user_id = fi.user_id
  )
ON CONFLICT (user_id) DO NOTHING;

-- Step 3: Also mark org integrations as inactive to avoid confusion
UPDATE fathom_org_integrations
SET is_active = false, updated_at = now()
WHERE is_active = true;

-- Log result
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM fathom_integrations
  WHERE is_active = true;
  RAISE NOTICE 'Total active per-user Fathom integrations: %', v_count;
END $$;
