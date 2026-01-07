-- =============================================================================
-- Add UPDATE policy for hitl_pending_approvals to allow users to action their own approvals
-- =============================================================================

-- Users can update (approve/reject) their own pending approvals
DROP POLICY IF EXISTS "hitl_approvals_user_update" ON hitl_pending_approvals;
CREATE POLICY "hitl_approvals_user_update" ON hitl_pending_approvals
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Org members can update pending approvals for their org
DROP POLICY IF EXISTS "hitl_approvals_org_update" ON hitl_pending_approvals;
CREATE POLICY "hitl_approvals_org_update" ON hitl_pending_approvals
  FOR UPDATE
  USING (
    org_id IN (
      SELECT om.org_id FROM organization_memberships om
      WHERE om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT om.org_id FROM organization_memberships om
      WHERE om.user_id = auth.uid()
    )
  );
