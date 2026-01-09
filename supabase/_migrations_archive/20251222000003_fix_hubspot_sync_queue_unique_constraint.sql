-- Fix: Add unique constraint for ON CONFLICT clause
-- The trigger uses ON CONFLICT (org_id, dedupe_key) but needs a unique constraint

-- Drop the existing index if it exists (it may be a regular index, not unique)
DROP INDEX IF EXISTS idx_hubspot_sync_queue_dedupe_key;

-- Create a unique constraint on (org_id, dedupe_key) for ON CONFLICT clause
CREATE UNIQUE INDEX IF NOT EXISTS idx_hubspot_sync_queue_org_dedupe
  ON public.hubspot_sync_queue(org_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
