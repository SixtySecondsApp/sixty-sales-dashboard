-- Migration: Revert Fathom Integration from Org-Scoped back to Per-User
--
-- Why: Fathom OAuth tokens only grant access to recordings owned by the authenticated user.
-- Using one user's token to access another team member's recordings causes 401 errors.
-- Each user must connect their own Fathom account.
--
-- This migration:
-- 1. Re-activates any per-user integrations that were deactivated during org migration
-- 2. Restores credentials from org tables for users who connected during org mode
-- 3. Keeps org tables intact for backwards compatibility (can be cleaned up later)

-- Re-activate any per-user integrations that were deactivated during the org migration
-- (The org migration set is_active = false for non-selected users)
UPDATE fathom_integrations
SET
  is_active = true,
  updated_at = now()
WHERE is_active = false
  AND refresh_token IS NOT NULL;  -- Only re-activate if they have valid tokens

-- For users who connected during org mode, we need to restore their credentials
-- from the org tables. This creates per-user records for org connectors.
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
  oi.scopes,
  true as is_active,
  now() as created_at,
  now() as updated_at
FROM fathom_org_integrations oi
JOIN fathom_org_credentials oc ON oc.org_id = oi.org_id
WHERE oi.connected_by_user_id IS NOT NULL
  AND oi.is_active = true
  -- Only insert if user doesn't already have a per-user integration
  AND NOT EXISTS (
    SELECT 1 FROM fathom_integrations fi
    WHERE fi.user_id = oi.connected_by_user_id
      AND fi.is_active = true
  );

-- Create sync state records for newly restored integrations
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
  );

-- Deactivate org-level integrations to prevent confusion
-- (keeping records for data preservation, just marking inactive)
UPDATE fathom_org_integrations
SET
  is_active = false,
  updated_at = now()
WHERE is_active = true;

-- Add helpful comment explaining the architectural decision
COMMENT ON TABLE fathom_integrations IS
'Per-user Fathom integrations. Each user connects their own Fathom account because OAuth tokens only grant access to recordings owned by the authenticated user.';

COMMENT ON TABLE fathom_org_integrations IS
'DEPRECATED: Org-scoped Fathom integrations. Kept for data preservation. New integrations should use per-user fathom_integrations table.';
