-- ============================================================================
-- Fix roadmap RLS policies that incorrectly referenced OLD/NEW
-- ============================================================================
-- Some earlier migrations attempted to restrict UPDATE fields in an RLS policy
-- using OLD.* / NEW.*. Those identifiers only exist in triggers, not RLS policies,
-- and cause errors like:
--   ERROR: 42P01: missing FROM-clause entry for table "old"
--
-- This migration replaces those invalid policies with valid RLS policies.
-- ============================================================================

-- Ensure RLS is enabled (idempotent)
ALTER TABLE IF EXISTS public.roadmap_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.roadmap_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.roadmap_comments ENABLE ROW LEVEL SECURITY;

-- Drop the invalid policy if it exists (created by older migrations)
DROP POLICY IF EXISTS "Users can update their own suggestions" ON public.roadmap_suggestions;
DROP POLICY IF EXISTS "Users can update their own roadmap suggestions" ON public.roadmap_suggestions;

-- Recreate a valid policy: users can update only rows they submitted.
-- NOTE: RLS cannot safely restrict *which columns* may be updated (OLD/NEW is not available).
-- If you need field-level protections, implement them via column privileges or triggers.
CREATE POLICY "Users can update their own roadmap suggestions" ON public.roadmap_suggestions
  FOR UPDATE
  USING (submitted_by = auth.uid())
  WITH CHECK (submitted_by = auth.uid());

-- Make sure INSERT policy is correct and not overly permissive
DROP POLICY IF EXISTS "Users can create roadmap suggestions" ON public.roadmap_suggestions;
CREATE POLICY "Users can create roadmap suggestions" ON public.roadmap_suggestions
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND submitted_by = auth.uid());

-- Ensure votes policies exist (idempotent)
DROP POLICY IF EXISTS "Users can create roadmap votes" ON public.roadmap_votes;
CREATE POLICY "Users can create roadmap votes" ON public.roadmap_votes
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own votes" ON public.roadmap_votes;
CREATE POLICY "Users can delete their own votes" ON public.roadmap_votes
  FOR DELETE
  USING (user_id = auth.uid());

-- Comments policies (idempotent)
DROP POLICY IF EXISTS "Users can create comments" ON public.roadmap_comments;
CREATE POLICY "Users can create comments" ON public.roadmap_comments
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own comments" ON public.roadmap_comments;
CREATE POLICY "Users can update their own comments" ON public.roadmap_comments
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own comments" ON public.roadmap_comments;
CREATE POLICY "Users can delete their own comments" ON public.roadmap_comments
  FOR DELETE
  USING (user_id = auth.uid());





