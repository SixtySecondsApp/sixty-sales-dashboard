-- ============================================================================
-- Migration: Drop unique active email constraint for fathom_org_integrations
-- ============================================================================
-- Rationale:
-- - Fathom connections are org-scoped (one per org), but the same Fathom account
--   email may legitimately be used across multiple orgs (e.g., shared admin).
-- - The initial org integration migration added a partial unique index on email;
--   remove it to avoid blocking valid configurations and migrations.
-- ============================================================================

DROP INDEX IF EXISTS public.uq_fathom_org_integrations_active_email;

