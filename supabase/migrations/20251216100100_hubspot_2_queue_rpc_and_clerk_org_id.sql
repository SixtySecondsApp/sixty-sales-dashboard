-- ============================================================================
-- HubSpot: Queue RPC helpers + clerk_org_id plumbing
-- ============================================================================
-- Purpose:
-- - Add optional clerk_org_id columns to HubSpot integration tables so we can
--   align with the rest of the app's multi-tenant schema (many tables use clerk_org_id).
-- - Add a safe dequeue RPC for hubspot_sync_queue using SKIP LOCKED.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) Add clerk_org_id columns (idempotent)
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.hubspot_oauth_states
  ADD COLUMN IF NOT EXISTS clerk_org_id text;

ALTER TABLE IF EXISTS public.hubspot_org_integrations
  ADD COLUMN IF NOT EXISTS clerk_org_id text;

ALTER TABLE IF EXISTS public.hubspot_org_sync_state
  ADD COLUMN IF NOT EXISTS clerk_org_id text;

ALTER TABLE IF EXISTS public.hubspot_object_mappings
  ADD COLUMN IF NOT EXISTS clerk_org_id text;

ALTER TABLE IF EXISTS public.hubspot_webhook_events
  ADD COLUMN IF NOT EXISTS clerk_org_id text;

ALTER TABLE IF EXISTS public.hubspot_sync_queue
  ADD COLUMN IF NOT EXISTS clerk_org_id text;

ALTER TABLE IF EXISTS public.hubspot_settings
  ADD COLUMN IF NOT EXISTS clerk_org_id text;

CREATE INDEX IF NOT EXISTS idx_hubspot_org_integrations_clerk_org_id
  ON public.hubspot_org_integrations(clerk_org_id)
  WHERE clerk_org_id IS NOT NULL AND clerk_org_id <> '';

CREATE INDEX IF NOT EXISTS idx_hubspot_sync_queue_clerk_org_id
  ON public.hubspot_sync_queue(clerk_org_id)
  WHERE clerk_org_id IS NOT NULL AND clerk_org_id <> '';

-- ----------------------------------------------------------------------------
-- 2) Queue dequeue RPC (service role only)
-- ----------------------------------------------------------------------------
-- Dequeues (DELETE ... RETURNING) up to p_limit jobs that are ready to run.
-- Uses FOR UPDATE SKIP LOCKED to support concurrent workers.
CREATE OR REPLACE FUNCTION public.hubspot_dequeue_jobs(
  p_limit integer DEFAULT 10,
  p_org_id uuid DEFAULT NULL
)
RETURNS SETOF public.hubspot_sync_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM public.hubspot_sync_queue
    WHERE run_after <= now()
      AND attempts < max_attempts
      AND (p_org_id IS NULL OR org_id = p_org_id)
    ORDER BY priority DESC, run_after ASC, created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(p_limit, 50))
  )
  DELETE FROM public.hubspot_sync_queue q
  USING picked
  WHERE q.id = picked.id
  RETURNING q.*;
END;
$$;

REVOKE ALL ON FUNCTION public.hubspot_dequeue_jobs(integer, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.hubspot_dequeue_jobs(integer, uuid) TO service_role;

COMMIT;


