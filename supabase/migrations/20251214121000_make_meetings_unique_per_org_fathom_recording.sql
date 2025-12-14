-- ============================================================================
-- Migration: Make Fathom meetings unique per org
-- ============================================================================
-- Problem:
--   meetings.fathom_recording_id has historically been globally unique.
--   With multi-tenant org_id + org-scoped integrations, the same Fathom account
--   can be connected to multiple orgs, and the same recording IDs would collide.
--
-- Fix:
--   Replace the global uniqueness with per-org uniqueness:
--     UNIQUE (org_id, fathom_recording_id)
--   scoped to rows where both org_id and fathom_recording_id are present.
--
-- Notes:
-- - This is required so upserts can use onConflict: 'org_id,fathom_recording_id'
-- - We keep non-unique indexes for lookup performance.
-- ============================================================================

BEGIN;

-- Drop legacy global uniqueness (name varies depending on how it was created)
ALTER TABLE public.meetings
  DROP CONSTRAINT IF EXISTS meetings_fathom_recording_id_key;

DROP INDEX IF EXISTS public.meetings_fathom_recording_id_key;
DROP INDEX IF EXISTS public.idx_meetings_fathom_recording_id;

-- Ensure helpful lookup index remains (non-unique)
CREATE INDEX IF NOT EXISTS idx_meetings_fathom_recording_id
  ON public.meetings(fathom_recording_id)
  WHERE fathom_recording_id IS NOT NULL;

-- New per-org uniqueness for Fathom recordings
CREATE UNIQUE INDEX IF NOT EXISTS uq_meetings_org_fathom_recording
  ON public.meetings(org_id, fathom_recording_id)
  WHERE org_id IS NOT NULL AND fathom_recording_id IS NOT NULL;

COMMIT;


