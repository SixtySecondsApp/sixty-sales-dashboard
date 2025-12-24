-- ============================================================================
-- Migration: Reset Stuck Fathom Sync Status
-- ============================================================================
-- Problem: The fathom_org_sync_state.sync_status is stuck at 'syncing'
-- which prevents the Meetings UI from showing existing meetings.
--
-- This migration resets any stuck 'syncing' statuses to 'idle' if they've
-- been syncing for more than 10 minutes (indicating they're stuck).
-- ============================================================================

-- Reset stuck sync statuses
UPDATE fathom_org_sync_state
SET
  sync_status = 'idle',
  error_message = 'Reset from stuck syncing state',
  last_sync_completed_at = NOW()
WHERE
  sync_status = 'syncing'
  AND (
    -- Sync started more than 10 minutes ago
    last_sync_started_at < NOW() - INTERVAL '10 minutes'
    OR last_sync_started_at IS NULL
  );

-- Log how many were reset
DO $$
DECLARE
  reset_count INTEGER;
BEGIN
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  IF reset_count > 0 THEN
    RAISE NOTICE 'Reset % stuck fathom_org_sync_state records from syncing to idle', reset_count;
  END IF;
END $$;

-- Also add a check constraint to prevent future stuck states
-- by creating a function that auto-resets stuck syncs

CREATE OR REPLACE FUNCTION auto_reset_stuck_fathom_sync()
RETURNS TRIGGER AS $$
BEGIN
  -- If a sync has been running for more than 30 minutes, reset it
  IF NEW.sync_status = 'syncing'
     AND NEW.last_sync_started_at < NOW() - INTERVAL '30 minutes' THEN
    NEW.sync_status := 'idle';
    NEW.error_message := 'Auto-reset from stuck syncing state (exceeded 30 minute timeout)';
    NEW.last_sync_completed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_auto_reset_stuck_fathom_sync ON fathom_org_sync_state;

CREATE TRIGGER trigger_auto_reset_stuck_fathom_sync
  BEFORE UPDATE ON fathom_org_sync_state
  FOR EACH ROW
  EXECUTE FUNCTION auto_reset_stuck_fathom_sync();

COMMENT ON FUNCTION auto_reset_stuck_fathom_sync() IS
  'Automatically resets fathom sync status if stuck in syncing state for more than 30 minutes';
