-- ============================================================================
-- HubSpot: advisory lock helpers for queue worker
-- ============================================================================
-- Purpose:
-- - Prevent multiple concurrent hubspot-process-queue workers from running at once
--   (best-effort global lock) to respect HubSpot API rate limits.
-- ============================================================================

BEGIN;

-- Global lock key (int8). Keep constant and unique-ish to this project.
-- If you need per-org locking later, we can add a function keyed by org_id hash.
CREATE OR REPLACE FUNCTION public.hubspot_try_acquire_worker_lock()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_try_advisory_lock(9112025121421);
$$;

CREATE OR REPLACE FUNCTION public.hubspot_release_worker_lock()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_advisory_unlock(9112025121421);
$$;

REVOKE ALL ON FUNCTION public.hubspot_try_acquire_worker_lock() FROM public;
REVOKE ALL ON FUNCTION public.hubspot_release_worker_lock() FROM public;
GRANT EXECUTE ON FUNCTION public.hubspot_try_acquire_worker_lock() TO service_role;
GRANT EXECUTE ON FUNCTION public.hubspot_release_worker_lock() TO service_role;

COMMIT;


