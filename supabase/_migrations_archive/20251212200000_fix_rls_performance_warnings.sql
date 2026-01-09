-- =============================================================================
-- Migration: Fix RLS Performance Warnings
-- Purpose: Optimize RLS policies by:
--   1. Wrapping auth.uid() with (select auth.uid()) for query plan caching
--   2. Consolidating duplicate permissive policies
-- Date: 2025-12-12
-- =============================================================================

-- =============================================================================
-- PART 1: Fix auth_rls_initplan warnings
-- Replace auth.uid() with (select auth.uid()) to cache the value per query
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: launch_checklist_items
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Platform admins can view launch checklist" ON launch_checklist_items;
DROP POLICY IF EXISTS "Platform admins can update launch checklist" ON launch_checklist_items;
DROP POLICY IF EXISTS "Platform admins can insert launch checklist" ON launch_checklist_items;

CREATE POLICY "Platform admins can view launch checklist"
  ON launch_checklist_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Platform admins can update launch checklist"
  ON launch_checklist_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Platform admins can insert launch checklist"
  ON launch_checklist_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.is_admin = true
    )
  );

-- -----------------------------------------------------------------------------
-- Table: meeting_workflow_results
-- Note: Preserving original business logic - org members view requires owner/admin/manager role
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can view workflow results" ON meeting_workflow_results;
DROP POLICY IF EXISTS "Users can view workflow results for their meetings" ON meeting_workflow_results;

CREATE POLICY "Org members can view workflow results"
  ON meeting_workflow_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships om
      WHERE om.org_id = meeting_workflow_results.org_id
        AND om.user_id = (select auth.uid())
        AND om.role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Users can view workflow results for their meetings"
  ON meeting_workflow_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM meetings
      WHERE meetings.id = meeting_workflow_results.meeting_id
        AND meetings.owner_user_id = (select auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- Table: email_logs
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "email_logs_admin_select" ON email_logs;
DROP POLICY IF EXISTS "email_logs_service_role" ON email_logs;
DROP POLICY IF EXISTS "email_logs_user_select" ON email_logs;

-- Consolidate into single SELECT policy with OR conditions for better performance
CREATE POLICY "email_logs_select"
  ON email_logs FOR SELECT
  USING (
    -- Service role access
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR
    -- User can view their own logs
    user_id = (select auth.uid())
    OR
    -- Platform admins can view all logs
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid())
      AND p.is_admin = true
    )
  );

-- Service role can do INSERT/UPDATE/DELETE
CREATE POLICY "email_logs_service_role_write"
  ON email_logs FOR ALL
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role')
  WITH CHECK (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- -----------------------------------------------------------------------------
-- Table: user_activation_events
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "activation_events_admin_select" ON user_activation_events;
DROP POLICY IF EXISTS "activation_events_user_insert" ON user_activation_events;
DROP POLICY IF EXISTS "activation_events_user_select" ON user_activation_events;

-- Consolidated SELECT policy
CREATE POLICY "activation_events_select"
  ON user_activation_events FOR SELECT
  USING (
    user_id = (select auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid())
      AND p.is_admin = true
    )
  );

-- INSERT policy for users
CREATE POLICY "activation_events_insert"
  ON user_activation_events FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Table: meetings_waitlist
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Platform admins can manage waitlist" ON meetings_waitlist;
DROP POLICY IF EXISTS "meetings_waitlist_insert" ON meetings_waitlist;
DROP POLICY IF EXISTS "meetings_waitlist_select" ON meetings_waitlist;
DROP POLICY IF EXISTS "meetings_waitlist_update" ON meetings_waitlist;
DROP POLICY IF EXISTS "meetings_waitlist_delete" ON meetings_waitlist;
DROP POLICY IF EXISTS "Anyone can signup for waitlist" ON meetings_waitlist;
DROP POLICY IF EXISTS "Anyone can view waitlist entries" ON meetings_waitlist;

-- Consolidated policies for waitlist
CREATE POLICY "meetings_waitlist_select"
  ON meetings_waitlist FOR SELECT
  USING (true); -- Anyone can view

CREATE POLICY "meetings_waitlist_insert"
  ON meetings_waitlist FOR INSERT
  WITH CHECK (true); -- Anyone can signup

-- Platform admins can manage (update/delete)
CREATE POLICY "meetings_waitlist_admin_manage"
  ON meetings_waitlist FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.is_admin = true
    )
  );

-- -----------------------------------------------------------------------------
-- Table: email_journeys
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "email_journeys_admin_insert" ON email_journeys;
DROP POLICY IF EXISTS "email_journeys_admin_select" ON email_journeys;
DROP POLICY IF EXISTS "email_journeys_admin_update" ON email_journeys;

CREATE POLICY "email_journeys_admin_all"
  ON email_journeys FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid())
      AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid())
      AND p.is_admin = true
    )
  );

-- -----------------------------------------------------------------------------
-- Table: email_sends
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "email_sends_admin_select" ON email_sends;
DROP POLICY IF EXISTS "email_sends_user_insert" ON email_sends;
DROP POLICY IF EXISTS "email_sends_user_select" ON email_sends;

-- Consolidated SELECT policy
CREATE POLICY "email_sends_select"
  ON email_sends FOR SELECT
  USING (
    user_id = (select auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid())
      AND p.is_admin = true
    )
  );

-- INSERT policy
CREATE POLICY "email_sends_insert"
  ON email_sends FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Table: pipeline_automation_rules
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Org admins can manage pipeline rules" ON pipeline_automation_rules;
DROP POLICY IF EXISTS "Org members can view pipeline rules" ON pipeline_automation_rules;

-- Consolidated SELECT policy
CREATE POLICY "pipeline_rules_select"
  ON pipeline_automation_rules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = pipeline_automation_rules.org_id
        AND organization_memberships.user_id = (select auth.uid())
    )
  );

-- Admin management policy
CREATE POLICY "pipeline_rules_admin_manage"
  ON pipeline_automation_rules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = pipeline_automation_rules.org_id
        AND organization_memberships.user_id = (select auth.uid())
        AND organization_memberships.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = pipeline_automation_rules.org_id
        AND organization_memberships.user_id = (select auth.uid())
        AND organization_memberships.role IN ('owner', 'admin')
    )
  );

-- -----------------------------------------------------------------------------
-- Table: pipeline_automation_log
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can view pipeline log" ON pipeline_automation_log;

CREATE POLICY "pipeline_log_select"
  ON pipeline_automation_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = pipeline_automation_log.org_id
        AND organization_memberships.user_id = (select auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- Table: encharge_email_templates
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "encharge_templates_admin_delete" ON encharge_email_templates;
DROP POLICY IF EXISTS "encharge_templates_admin_insert" ON encharge_email_templates;
DROP POLICY IF EXISTS "encharge_templates_admin_select" ON encharge_email_templates;
DROP POLICY IF EXISTS "encharge_templates_admin_update" ON encharge_email_templates;

CREATE POLICY "encharge_templates_admin_all"
  ON encharge_email_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid())
      AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid())
      AND p.is_admin = true
    )
  );

-- -----------------------------------------------------------------------------
-- Table: app_settings
-- Drop duplicates, keep consolidated policy
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "app_settings_admin_all" ON app_settings;
DROP POLICY IF EXISTS "app_settings_authenticated_read" ON app_settings;
DROP POLICY IF EXISTS "app_settings_select" ON app_settings;
DROP POLICY IF EXISTS "app_settings_insert" ON app_settings;
DROP POLICY IF EXISTS "app_settings_update" ON app_settings;
DROP POLICY IF EXISTS "app_settings_delete" ON app_settings;

-- Non-secret settings readable by authenticated users
CREATE POLICY "app_settings_authenticated_read"
  ON app_settings FOR SELECT TO authenticated
  USING (key NOT LIKE 'secret_%');

-- Admin users can manage all settings
CREATE POLICY "app_settings_admin_manage"
  ON app_settings FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND is_admin = true)
  );

-- -----------------------------------------------------------------------------
-- Table: meeting_structured_summaries
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can view structured summaries" ON meeting_structured_summaries;
DROP POLICY IF EXISTS "Service role can manage all structured summaries" ON meeting_structured_summaries;

-- Consolidated SELECT with service role
CREATE POLICY "structured_summaries_select"
  ON meeting_structured_summaries FOR SELECT
  USING (
    (select auth.jwt()->>'role') = 'service_role'
    OR
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = meeting_structured_summaries.org_id
        AND organization_memberships.user_id = (select auth.uid())
    )
  );

-- Service role can INSERT/UPDATE/DELETE
CREATE POLICY "structured_summaries_service_write"
  ON meeting_structured_summaries FOR ALL
  USING ((select auth.jwt()->>'role') = 'service_role')
  WITH CHECK ((select auth.jwt()->>'role') = 'service_role');

-- -----------------------------------------------------------------------------
-- Table: coaching_scorecard_templates
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Org admins can manage scorecard templates" ON coaching_scorecard_templates;
DROP POLICY IF EXISTS "Org members can view scorecard templates" ON coaching_scorecard_templates;
DROP POLICY IF EXISTS "Service role can manage all templates" ON coaching_scorecard_templates;

-- Consolidated SELECT
CREATE POLICY "scorecard_templates_select"
  ON coaching_scorecard_templates FOR SELECT
  USING (
    (select auth.jwt()->>'role') = 'service_role'
    OR
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = coaching_scorecard_templates.org_id
        AND organization_memberships.user_id = (select auth.uid())
    )
  );

-- Service role write access
CREATE POLICY "scorecard_templates_service_write"
  ON coaching_scorecard_templates FOR ALL
  USING ((select auth.jwt()->>'role') = 'service_role')
  WITH CHECK ((select auth.jwt()->>'role') = 'service_role');

-- Org admins can manage
CREATE POLICY "scorecard_templates_admin_manage"
  ON coaching_scorecard_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = coaching_scorecard_templates.org_id
        AND organization_memberships.user_id = (select auth.uid())
        AND organization_memberships.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = coaching_scorecard_templates.org_id
        AND organization_memberships.user_id = (select auth.uid())
        AND organization_memberships.role IN ('owner', 'admin')
    )
  );

-- -----------------------------------------------------------------------------
-- Table: meeting_scorecards
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can view meeting scorecards" ON meeting_scorecards;
DROP POLICY IF EXISTS "Service role can manage all scorecards" ON meeting_scorecards;

-- Consolidated SELECT
CREATE POLICY "meeting_scorecards_select"
  ON meeting_scorecards FOR SELECT
  USING (
    (select auth.jwt()->>'role') = 'service_role'
    OR
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = meeting_scorecards.org_id
        AND organization_memberships.user_id = (select auth.uid())
    )
  );

-- Service role write access
CREATE POLICY "meeting_scorecards_service_write"
  ON meeting_scorecards FOR ALL
  USING ((select auth.jwt()->>'role') = 'service_role')
  WITH CHECK ((select auth.jwt()->>'role') = 'service_role');

-- -----------------------------------------------------------------------------
-- Table: deal_risk_signals
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can view deal risk signals" ON deal_risk_signals;
DROP POLICY IF EXISTS "Org members can resolve risk signals" ON deal_risk_signals;
DROP POLICY IF EXISTS "Service role can manage all risk signals" ON deal_risk_signals;

-- Consolidated SELECT
CREATE POLICY "deal_risk_signals_select"
  ON deal_risk_signals FOR SELECT
  USING (
    (select auth.jwt()->>'role') = 'service_role'
    OR
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = deal_risk_signals.org_id
        AND organization_memberships.user_id = (select auth.uid())
    )
  );

-- Org members can update (resolve)
CREATE POLICY "deal_risk_signals_update"
  ON deal_risk_signals FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = deal_risk_signals.org_id
        AND organization_memberships.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = deal_risk_signals.org_id
        AND organization_memberships.user_id = (select auth.uid())
    )
  );

-- Service role can INSERT/DELETE
CREATE POLICY "deal_risk_signals_service_write"
  ON deal_risk_signals FOR ALL
  USING ((select auth.jwt()->>'role') = 'service_role')
  WITH CHECK ((select auth.jwt()->>'role') = 'service_role');

-- -----------------------------------------------------------------------------
-- Table: deal_risk_aggregates
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can view deal risk aggregates" ON deal_risk_aggregates;
DROP POLICY IF EXISTS "Service role can manage all risk aggregates" ON deal_risk_aggregates;

-- Consolidated SELECT
CREATE POLICY "deal_risk_aggregates_select"
  ON deal_risk_aggregates FOR SELECT
  USING (
    (select auth.jwt()->>'role') = 'service_role'
    OR
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = deal_risk_aggregates.org_id
        AND organization_memberships.user_id = (select auth.uid())
    )
  );

-- Service role write access
CREATE POLICY "deal_risk_aggregates_service_write"
  ON deal_risk_aggregates FOR ALL
  USING ((select auth.jwt()->>'role') = 'service_role')
  WITH CHECK ((select auth.jwt()->>'role') = 'service_role');

-- -----------------------------------------------------------------------------
-- Table: meeting_classifications
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can view meeting classifications" ON meeting_classifications;
DROP POLICY IF EXISTS "Service role can manage all classifications" ON meeting_classifications;

-- Consolidated SELECT
CREATE POLICY "meeting_classifications_select"
  ON meeting_classifications FOR SELECT
  USING (
    (select auth.jwt()->>'role') = 'service_role'
    OR
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = meeting_classifications.org_id
        AND organization_memberships.user_id = (select auth.uid())
    )
  );

-- Service role write access
CREATE POLICY "meeting_classifications_service_write"
  ON meeting_classifications FOR ALL
  USING ((select auth.jwt()->>'role') = 'service_role')
  WITH CHECK ((select auth.jwt()->>'role') = 'service_role');

-- -----------------------------------------------------------------------------
-- Table: meeting_aggregate_metrics
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can view aggregate metrics" ON meeting_aggregate_metrics;
DROP POLICY IF EXISTS "Service role can manage all aggregate metrics" ON meeting_aggregate_metrics;

-- Consolidated SELECT
CREATE POLICY "meeting_aggregate_metrics_select"
  ON meeting_aggregate_metrics FOR SELECT
  USING (
    (select auth.jwt()->>'role') = 'service_role'
    OR
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = meeting_aggregate_metrics.org_id
        AND organization_memberships.user_id = (select auth.uid())
    )
  );

-- Service role write access
CREATE POLICY "meeting_aggregate_metrics_service_write"
  ON meeting_aggregate_metrics FOR ALL
  USING ((select auth.jwt()->>'role') = 'service_role')
  WITH CHECK ((select auth.jwt()->>'role') = 'service_role');

-- -----------------------------------------------------------------------------
-- Table: org_call_types
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their org's call types" ON org_call_types;
DROP POLICY IF EXISTS "Org admins can insert call types" ON org_call_types;
DROP POLICY IF EXISTS "Org admins can update call types" ON org_call_types;
DROP POLICY IF EXISTS "Org admins can delete call types" ON org_call_types;

-- SELECT for all org members
CREATE POLICY "org_call_types_select"
  ON org_call_types FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = org_call_types.org_id
      AND organization_memberships.user_id = (select auth.uid())
    )
  );

-- INSERT for org admins
CREATE POLICY "org_call_types_insert"
  ON org_call_types FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = org_call_types.org_id
      AND organization_memberships.user_id = (select auth.uid())
      AND organization_memberships.role IN ('owner', 'admin')
    )
  );

-- UPDATE for org admins
CREATE POLICY "org_call_types_update"
  ON org_call_types FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = org_call_types.org_id
      AND organization_memberships.user_id = (select auth.uid())
      AND organization_memberships.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = org_call_types.org_id
      AND organization_memberships.user_id = (select auth.uid())
      AND organization_memberships.role IN ('owner', 'admin')
    )
  );

-- DELETE for org admins (non-system types only)
CREATE POLICY "org_call_types_delete"
  ON org_call_types FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = org_call_types.org_id
      AND organization_memberships.user_id = (select auth.uid())
      AND organization_memberships.role IN ('owner', 'admin')
    )
    AND is_system = false
  );

-- =============================================================================
-- PART 2: Clean up duplicate permissive policies for waitlist tables
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: waitlist_email_invites
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can create email invites" ON waitlist_email_invites;
DROP POLICY IF EXISTS "Anyone can view email invites" ON waitlist_email_invites;
DROP POLICY IF EXISTS "Anyone can update email invites" ON waitlist_email_invites;
DROP POLICY IF EXISTS "waitlist_email_invites_insert" ON waitlist_email_invites;
DROP POLICY IF EXISTS "waitlist_email_invites_select" ON waitlist_email_invites;
DROP POLICY IF EXISTS "waitlist_email_invites_update" ON waitlist_email_invites;

-- Single consolidated policies
CREATE POLICY "waitlist_email_invites_select"
  ON waitlist_email_invites FOR SELECT
  USING (true);

CREATE POLICY "waitlist_email_invites_insert"
  ON waitlist_email_invites FOR INSERT
  WITH CHECK (true);

CREATE POLICY "waitlist_email_invites_update"
  ON waitlist_email_invites FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- Notify completion
-- =============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ RLS performance optimizations applied successfully';
  RAISE NOTICE '  - auth.uid() wrapped with (select auth.uid()) for query plan caching';
  RAISE NOTICE '  - Duplicate permissive policies consolidated';
  RAISE NOTICE '  - 19 tables optimized';
END $$;
