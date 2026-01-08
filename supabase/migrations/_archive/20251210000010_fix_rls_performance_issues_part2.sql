-- Migration: Fix RLS Performance Issues - Part 2
-- Covers remaining tables not included in Part 1
-- Applied: 2025-12-10
--
-- This migration continues the RLS optimization for additional tables

-- ============================================================================
-- TABLE: api_key_usage
-- ============================================================================

DROP POLICY IF EXISTS "api_key_usage_select" ON api_key_usage;
DROP POLICY IF EXISTS "api_key_usage_insert" ON api_key_usage;
DROP POLICY IF EXISTS "api_key_usage_update" ON api_key_usage;
DROP POLICY IF EXISTS "api_key_usage_delete" ON api_key_usage;

DROP POLICY IF EXISTS "api_key_usage_select" ON api_key_usage;
CREATE POLICY "api_key_usage_select" ON api_key_usage FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM api_keys ak
      WHERE ak.id = api_key_usage.api_key_id
      AND ak.user_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "api_key_usage_insert" ON api_key_usage;
CREATE POLICY "api_key_usage_insert" ON api_key_usage FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "api_key_usage_update" ON api_key_usage;
CREATE POLICY "api_key_usage_update" ON api_key_usage FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "api_key_usage_delete" ON api_key_usage;
CREATE POLICY "api_key_usage_delete" ON api_key_usage FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: api_requests
-- ============================================================================

DROP POLICY IF EXISTS "api_requests_select" ON api_requests;
DROP POLICY IF EXISTS "api_requests_insert" ON api_requests;
DROP POLICY IF EXISTS "api_requests_update" ON api_requests;
DROP POLICY IF EXISTS "api_requests_delete" ON api_requests;

DROP POLICY IF EXISTS "api_requests_select" ON api_requests;
CREATE POLICY "api_requests_select" ON api_requests FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "api_requests_insert" ON api_requests;
CREATE POLICY "api_requests_insert" ON api_requests FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "api_requests_update" ON api_requests;
CREATE POLICY "api_requests_update" ON api_requests FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "api_requests_delete" ON api_requests;
CREATE POLICY "api_requests_delete" ON api_requests FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: action_items
-- ============================================================================

DROP POLICY IF EXISTS "action_items_select" ON action_items;
DROP POLICY IF EXISTS "action_items_insert" ON action_items;
DROP POLICY IF EXISTS "action_items_update" ON action_items;
DROP POLICY IF EXISTS "action_items_delete" ON action_items;

DROP POLICY IF EXISTS "action_items_select" ON action_items;
CREATE POLICY "action_items_select" ON action_items FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "action_items_insert" ON action_items;
CREATE POLICY "action_items_insert" ON action_items FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "action_items_update" ON action_items;
CREATE POLICY "action_items_update" ON action_items FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "action_items_delete" ON action_items;
CREATE POLICY "action_items_delete" ON action_items FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

-- ============================================================================
-- TABLE: activity_sync_rules
-- ============================================================================

DROP POLICY IF EXISTS "activity_sync_rules_select" ON activity_sync_rules;
DROP POLICY IF EXISTS "activity_sync_rules_insert" ON activity_sync_rules;
DROP POLICY IF EXISTS "activity_sync_rules_update" ON activity_sync_rules;
DROP POLICY IF EXISTS "activity_sync_rules_delete" ON activity_sync_rules;

DROP POLICY IF EXISTS "activity_sync_rules_select" ON activity_sync_rules;
CREATE POLICY "activity_sync_rules_select" ON activity_sync_rules FOR SELECT
  USING (is_service_role() OR owner_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "activity_sync_rules_insert" ON activity_sync_rules;
CREATE POLICY "activity_sync_rules_insert" ON activity_sync_rules FOR INSERT
  WITH CHECK (is_service_role() OR owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "activity_sync_rules_update" ON activity_sync_rules;
CREATE POLICY "activity_sync_rules_update" ON activity_sync_rules FOR UPDATE
  USING (is_service_role() OR owner_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "activity_sync_rules_delete" ON activity_sync_rules;
CREATE POLICY "activity_sync_rules_delete" ON activity_sync_rules FOR DELETE
  USING (is_service_role() OR owner_id = (SELECT auth.uid()) OR is_admin_optimized());

-- ============================================================================
-- TABLE: ai_cost_events
-- ============================================================================

DROP POLICY IF EXISTS "ai_cost_events_select" ON ai_cost_events;
DROP POLICY IF EXISTS "ai_cost_events_insert" ON ai_cost_events;
DROP POLICY IF EXISTS "ai_cost_events_update" ON ai_cost_events;
DROP POLICY IF EXISTS "ai_cost_events_delete" ON ai_cost_events;

DROP POLICY IF EXISTS "ai_cost_events_select" ON ai_cost_events;
CREATE POLICY "ai_cost_events_select" ON ai_cost_events FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "ai_cost_events_insert" ON ai_cost_events;
CREATE POLICY "ai_cost_events_insert" ON ai_cost_events FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "ai_cost_events_update" ON ai_cost_events;
CREATE POLICY "ai_cost_events_update" ON ai_cost_events FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "ai_cost_events_delete" ON ai_cost_events;
CREATE POLICY "ai_cost_events_delete" ON ai_cost_events FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: ai_insights
-- ============================================================================

DROP POLICY IF EXISTS "ai_insights_select" ON ai_insights;
DROP POLICY IF EXISTS "ai_insights_insert" ON ai_insights;
DROP POLICY IF EXISTS "ai_insights_update" ON ai_insights;
DROP POLICY IF EXISTS "ai_insights_delete" ON ai_insights;

DROP POLICY IF EXISTS "ai_insights_select" ON ai_insights;
CREATE POLICY "ai_insights_select" ON ai_insights FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "ai_insights_insert" ON ai_insights;
CREATE POLICY "ai_insights_insert" ON ai_insights FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "ai_insights_update" ON ai_insights;
CREATE POLICY "ai_insights_update" ON ai_insights FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "ai_insights_delete" ON ai_insights;
CREATE POLICY "ai_insights_delete" ON ai_insights FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

-- ============================================================================
-- TABLE: ai_prompt_templates
-- ============================================================================

DROP POLICY IF EXISTS "ai_prompt_templates_select" ON ai_prompt_templates;
DROP POLICY IF EXISTS "ai_prompt_templates_insert" ON ai_prompt_templates;
DROP POLICY IF EXISTS "ai_prompt_templates_update" ON ai_prompt_templates;
DROP POLICY IF EXISTS "ai_prompt_templates_delete" ON ai_prompt_templates;

DROP POLICY IF EXISTS "ai_prompt_templates_select" ON ai_prompt_templates;
CREATE POLICY "ai_prompt_templates_select" ON ai_prompt_templates FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized() OR is_public = true);

DROP POLICY IF EXISTS "ai_prompt_templates_insert" ON ai_prompt_templates;
CREATE POLICY "ai_prompt_templates_insert" ON ai_prompt_templates FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "ai_prompt_templates_update" ON ai_prompt_templates;
CREATE POLICY "ai_prompt_templates_update" ON ai_prompt_templates FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "ai_prompt_templates_delete" ON ai_prompt_templates;
CREATE POLICY "ai_prompt_templates_delete" ON ai_prompt_templates FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

-- ============================================================================
-- TABLE: ai_usage_logs
-- ============================================================================

DROP POLICY IF EXISTS "ai_usage_logs_select" ON ai_usage_logs;
DROP POLICY IF EXISTS "ai_usage_logs_insert" ON ai_usage_logs;
DROP POLICY IF EXISTS "ai_usage_logs_update" ON ai_usage_logs;
DROP POLICY IF EXISTS "ai_usage_logs_delete" ON ai_usage_logs;

DROP POLICY IF EXISTS "ai_usage_logs_select" ON ai_usage_logs;
CREATE POLICY "ai_usage_logs_select" ON ai_usage_logs FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "ai_usage_logs_insert" ON ai_usage_logs;
CREATE POLICY "ai_usage_logs_insert" ON ai_usage_logs FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "ai_usage_logs_update" ON ai_usage_logs;
CREATE POLICY "ai_usage_logs_update" ON ai_usage_logs FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "ai_usage_logs_delete" ON ai_usage_logs;
CREATE POLICY "ai_usage_logs_delete" ON ai_usage_logs FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: app_settings
-- ============================================================================

DROP POLICY IF EXISTS "app_settings_select" ON app_settings;
DROP POLICY IF EXISTS "app_settings_insert" ON app_settings;
DROP POLICY IF EXISTS "app_settings_update" ON app_settings;
DROP POLICY IF EXISTS "app_settings_delete" ON app_settings;

DROP POLICY IF EXISTS "app_settings_select" ON app_settings;
CREATE POLICY "app_settings_select" ON app_settings FOR SELECT
  USING (is_service_role() OR is_admin_optimized() OR key NOT LIKE 'secret_%');

DROP POLICY IF EXISTS "app_settings_insert" ON app_settings;
CREATE POLICY "app_settings_insert" ON app_settings FOR INSERT
  WITH CHECK (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "app_settings_update" ON app_settings;
CREATE POLICY "app_settings_update" ON app_settings FOR UPDATE
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "app_settings_delete" ON app_settings;
CREATE POLICY "app_settings_delete" ON app_settings FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: billing_history
-- ============================================================================

DROP POLICY IF EXISTS "billing_history_select" ON billing_history;
DROP POLICY IF EXISTS "billing_history_insert" ON billing_history;
DROP POLICY IF EXISTS "billing_history_update" ON billing_history;
DROP POLICY IF EXISTS "billing_history_delete" ON billing_history;

DROP POLICY IF EXISTS "billing_history_select" ON billing_history;
CREATE POLICY "billing_history_select" ON billing_history FOR SELECT
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "billing_history_insert" ON billing_history;
CREATE POLICY "billing_history_insert" ON billing_history FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "billing_history_update" ON billing_history;
CREATE POLICY "billing_history_update" ON billing_history FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "billing_history_delete" ON billing_history;
CREATE POLICY "billing_history_delete" ON billing_history FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: calendar_attendees
-- ============================================================================

DROP POLICY IF EXISTS "calendar_attendees_select" ON calendar_attendees;
DROP POLICY IF EXISTS "calendar_attendees_insert" ON calendar_attendees;
DROP POLICY IF EXISTS "calendar_attendees_update" ON calendar_attendees;
DROP POLICY IF EXISTS "calendar_attendees_delete" ON calendar_attendees;

DROP POLICY IF EXISTS "calendar_attendees_select" ON calendar_attendees;
CREATE POLICY "calendar_attendees_select" ON calendar_attendees FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM calendar_events ce
      WHERE ce.id = calendar_attendees.event_id
      AND ce.user_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "calendar_attendees_insert" ON calendar_attendees;
CREATE POLICY "calendar_attendees_insert" ON calendar_attendees FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "calendar_attendees_update" ON calendar_attendees;
CREATE POLICY "calendar_attendees_update" ON calendar_attendees FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "calendar_attendees_delete" ON calendar_attendees;
CREATE POLICY "calendar_attendees_delete" ON calendar_attendees FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: calendar_calendars
-- ============================================================================

DROP POLICY IF EXISTS "calendar_calendars_select" ON calendar_calendars;
DROP POLICY IF EXISTS "calendar_calendars_insert" ON calendar_calendars;
DROP POLICY IF EXISTS "calendar_calendars_update" ON calendar_calendars;
DROP POLICY IF EXISTS "calendar_calendars_delete" ON calendar_calendars;

DROP POLICY IF EXISTS "calendar_calendars_select" ON calendar_calendars;
CREATE POLICY "calendar_calendars_select" ON calendar_calendars FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "calendar_calendars_insert" ON calendar_calendars;
CREATE POLICY "calendar_calendars_insert" ON calendar_calendars FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "calendar_calendars_update" ON calendar_calendars;
CREATE POLICY "calendar_calendars_update" ON calendar_calendars FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "calendar_calendars_delete" ON calendar_calendars;
CREATE POLICY "calendar_calendars_delete" ON calendar_calendars FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

-- ============================================================================
-- TABLE: calendar_reminders
-- ============================================================================

DROP POLICY IF EXISTS "calendar_reminders_select" ON calendar_reminders;
DROP POLICY IF EXISTS "calendar_reminders_insert" ON calendar_reminders;
DROP POLICY IF EXISTS "calendar_reminders_update" ON calendar_reminders;
DROP POLICY IF EXISTS "calendar_reminders_delete" ON calendar_reminders;

DROP POLICY IF EXISTS "calendar_reminders_select" ON calendar_reminders;
CREATE POLICY "calendar_reminders_select" ON calendar_reminders FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM calendar_events ce
      WHERE ce.id = calendar_reminders.event_id
      AND ce.user_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "calendar_reminders_insert" ON calendar_reminders;
CREATE POLICY "calendar_reminders_insert" ON calendar_reminders FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "calendar_reminders_update" ON calendar_reminders;
CREATE POLICY "calendar_reminders_update" ON calendar_reminders FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "calendar_reminders_delete" ON calendar_reminders;
CREATE POLICY "calendar_reminders_delete" ON calendar_reminders FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: calendar_sync_logs
-- ============================================================================

DROP POLICY IF EXISTS "calendar_sync_logs_select" ON calendar_sync_logs;
DROP POLICY IF EXISTS "calendar_sync_logs_insert" ON calendar_sync_logs;
DROP POLICY IF EXISTS "calendar_sync_logs_update" ON calendar_sync_logs;
DROP POLICY IF EXISTS "calendar_sync_logs_delete" ON calendar_sync_logs;

DROP POLICY IF EXISTS "calendar_sync_logs_select" ON calendar_sync_logs;
CREATE POLICY "calendar_sync_logs_select" ON calendar_sync_logs FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "calendar_sync_logs_insert" ON calendar_sync_logs;
CREATE POLICY "calendar_sync_logs_insert" ON calendar_sync_logs FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "calendar_sync_logs_update" ON calendar_sync_logs;
CREATE POLICY "calendar_sync_logs_update" ON calendar_sync_logs FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "calendar_sync_logs_delete" ON calendar_sync_logs;
CREATE POLICY "calendar_sync_logs_delete" ON calendar_sync_logs FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: challenges
-- ============================================================================

DROP POLICY IF EXISTS "challenges_select" ON challenges;
DROP POLICY IF EXISTS "challenges_insert" ON challenges;
DROP POLICY IF EXISTS "challenges_update" ON challenges;
DROP POLICY IF EXISTS "challenges_delete" ON challenges;

DROP POLICY IF EXISTS "challenges_select" ON challenges;
CREATE POLICY "challenges_select" ON challenges FOR SELECT
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "challenges_insert" ON challenges;
CREATE POLICY "challenges_insert" ON challenges FOR INSERT
  WITH CHECK (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "challenges_update" ON challenges;
CREATE POLICY "challenges_update" ON challenges FOR UPDATE
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "challenges_delete" ON challenges;
CREATE POLICY "challenges_delete" ON challenges FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: challenge_features
-- ============================================================================

DROP POLICY IF EXISTS "challenge_features_select" ON challenge_features;
DROP POLICY IF EXISTS "challenge_features_insert" ON challenge_features;
DROP POLICY IF EXISTS "challenge_features_update" ON challenge_features;
DROP POLICY IF EXISTS "challenge_features_delete" ON challenge_features;

DROP POLICY IF EXISTS "challenge_features_select" ON challenge_features;
CREATE POLICY "challenge_features_select" ON challenge_features FOR SELECT
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "challenge_features_insert" ON challenge_features;
CREATE POLICY "challenge_features_insert" ON challenge_features FOR INSERT
  WITH CHECK (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "challenge_features_update" ON challenge_features;
CREATE POLICY "challenge_features_update" ON challenge_features FOR UPDATE
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "challenge_features_delete" ON challenge_features;
CREATE POLICY "challenge_features_delete" ON challenge_features FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: clerk_user_mappings
-- ============================================================================

DROP POLICY IF EXISTS "clerk_user_mappings_select" ON clerk_user_mappings;
DROP POLICY IF EXISTS "clerk_user_mappings_insert" ON clerk_user_mappings;
DROP POLICY IF EXISTS "clerk_user_mappings_update" ON clerk_user_mappings;
DROP POLICY IF EXISTS "clerk_user_mappings_delete" ON clerk_user_mappings;
DROP POLICY IF EXISTS "org_members_view_user_mappings" ON clerk_user_mappings;
DROP POLICY IF EXISTS "org_admins_manage_user_mappings" ON clerk_user_mappings;

DROP POLICY IF EXISTS "clerk_user_mappings_all" ON clerk_user_mappings;
CREATE POLICY "clerk_user_mappings_all" ON clerk_user_mappings FOR ALL
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: communication_events
-- ============================================================================

DROP POLICY IF EXISTS "communication_events_select" ON communication_events;
DROP POLICY IF EXISTS "communication_events_insert" ON communication_events;
DROP POLICY IF EXISTS "communication_events_update" ON communication_events;
DROP POLICY IF EXISTS "communication_events_delete" ON communication_events;

DROP POLICY IF EXISTS "communication_events_select" ON communication_events;
CREATE POLICY "communication_events_select" ON communication_events FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "communication_events_insert" ON communication_events;
CREATE POLICY "communication_events_insert" ON communication_events FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "communication_events_update" ON communication_events;
CREATE POLICY "communication_events_update" ON communication_events FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "communication_events_delete" ON communication_events;
CREATE POLICY "communication_events_delete" ON communication_events FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

-- ============================================================================
-- TABLE: company_meeting_insights
-- ============================================================================

DROP POLICY IF EXISTS "company_meeting_insights_select" ON company_meeting_insights;
DROP POLICY IF EXISTS "company_meeting_insights_insert" ON company_meeting_insights;
DROP POLICY IF EXISTS "company_meeting_insights_update" ON company_meeting_insights;
DROP POLICY IF EXISTS "company_meeting_insights_delete" ON company_meeting_insights;

DROP POLICY IF EXISTS "company_meeting_insights_select" ON company_meeting_insights;
CREATE POLICY "company_meeting_insights_select" ON company_meeting_insights FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = company_meeting_insights.company_id
      AND c.owner_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "company_meeting_insights_insert" ON company_meeting_insights;
CREATE POLICY "company_meeting_insights_insert" ON company_meeting_insights FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "company_meeting_insights_update" ON company_meeting_insights;
CREATE POLICY "company_meeting_insights_update" ON company_meeting_insights FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "company_meeting_insights_delete" ON company_meeting_insights;
CREATE POLICY "company_meeting_insights_delete" ON company_meeting_insights FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: contact_meeting_insights
-- ============================================================================

DROP POLICY IF EXISTS "contact_meeting_insights_select" ON contact_meeting_insights;
DROP POLICY IF EXISTS "contact_meeting_insights_insert" ON contact_meeting_insights;
DROP POLICY IF EXISTS "contact_meeting_insights_update" ON contact_meeting_insights;
DROP POLICY IF EXISTS "contact_meeting_insights_delete" ON contact_meeting_insights;

DROP POLICY IF EXISTS "contact_meeting_insights_select" ON contact_meeting_insights;
CREATE POLICY "contact_meeting_insights_select" ON contact_meeting_insights FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_meeting_insights.contact_id
      AND c.owner_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "contact_meeting_insights_insert" ON contact_meeting_insights;
CREATE POLICY "contact_meeting_insights_insert" ON contact_meeting_insights FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "contact_meeting_insights_update" ON contact_meeting_insights;
CREATE POLICY "contact_meeting_insights_update" ON contact_meeting_insights FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "contact_meeting_insights_delete" ON contact_meeting_insights;
CREATE POLICY "contact_meeting_insights_delete" ON contact_meeting_insights FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: content
-- ============================================================================

DROP POLICY IF EXISTS "content_select" ON content;
DROP POLICY IF EXISTS "content_insert" ON content;
DROP POLICY IF EXISTS "content_update" ON content;
DROP POLICY IF EXISTS "content_delete" ON content;

-- Note: content table has no user_id column - it's global content
DROP POLICY IF EXISTS "content_select" ON content;
CREATE POLICY "content_select" ON content FOR SELECT
  USING (true);  -- Public read access for content

DROP POLICY IF EXISTS "content_insert" ON content;
CREATE POLICY "content_insert" ON content FOR INSERT
  WITH CHECK (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "content_update" ON content;
CREATE POLICY "content_update" ON content FOR UPDATE
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "content_delete" ON content;
CREATE POLICY "content_delete" ON content FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: content_topic_links
-- ============================================================================

DROP POLICY IF EXISTS "content_topic_links_select" ON content_topic_links;
DROP POLICY IF EXISTS "content_topic_links_insert" ON content_topic_links;
DROP POLICY IF EXISTS "content_topic_links_update" ON content_topic_links;
DROP POLICY IF EXISTS "content_topic_links_delete" ON content_topic_links;

DROP POLICY IF EXISTS "content_topic_links_select" ON content_topic_links;
CREATE POLICY "content_topic_links_select" ON content_topic_links FOR SELECT
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "content_topic_links_insert" ON content_topic_links;
CREATE POLICY "content_topic_links_insert" ON content_topic_links FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "content_topic_links_update" ON content_topic_links;
CREATE POLICY "content_topic_links_update" ON content_topic_links FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "content_topic_links_delete" ON content_topic_links;
CREATE POLICY "content_topic_links_delete" ON content_topic_links FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: copilot_analytics
-- ============================================================================

DROP POLICY IF EXISTS "copilot_analytics_select" ON copilot_analytics;
DROP POLICY IF EXISTS "copilot_analytics_insert" ON copilot_analytics;
DROP POLICY IF EXISTS "copilot_analytics_update" ON copilot_analytics;
DROP POLICY IF EXISTS "copilot_analytics_delete" ON copilot_analytics;

DROP POLICY IF EXISTS "copilot_analytics_select" ON copilot_analytics;
CREATE POLICY "copilot_analytics_select" ON copilot_analytics FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "copilot_analytics_insert" ON copilot_analytics;
CREATE POLICY "copilot_analytics_insert" ON copilot_analytics FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "copilot_analytics_update" ON copilot_analytics;
CREATE POLICY "copilot_analytics_update" ON copilot_analytics FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "copilot_analytics_delete" ON copilot_analytics;
CREATE POLICY "copilot_analytics_delete" ON copilot_analytics FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: cost_rates
-- ============================================================================

DROP POLICY IF EXISTS "cost_rates_select" ON cost_rates;
DROP POLICY IF EXISTS "cost_rates_insert" ON cost_rates;
DROP POLICY IF EXISTS "cost_rates_update" ON cost_rates;
DROP POLICY IF EXISTS "cost_rates_delete" ON cost_rates;

DROP POLICY IF EXISTS "cost_rates_select" ON cost_rates;
CREATE POLICY "cost_rates_select" ON cost_rates FOR SELECT
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "cost_rates_insert" ON cost_rates;
CREATE POLICY "cost_rates_insert" ON cost_rates FOR INSERT
  WITH CHECK (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "cost_rates_update" ON cost_rates;
CREATE POLICY "cost_rates_update" ON cost_rates FOR UPDATE
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "cost_rates_delete" ON cost_rates;
CREATE POLICY "cost_rates_delete" ON cost_rates FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: cron_job_logs
-- ============================================================================

DROP POLICY IF EXISTS "cron_job_logs_select" ON cron_job_logs;
DROP POLICY IF EXISTS "cron_job_logs_insert" ON cron_job_logs;
DROP POLICY IF EXISTS "cron_job_logs_update" ON cron_job_logs;
DROP POLICY IF EXISTS "cron_job_logs_delete" ON cron_job_logs;

DROP POLICY IF EXISTS "cron_job_logs_all" ON cron_job_logs;
CREATE POLICY "cron_job_logs_all" ON cron_job_logs FOR ALL
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: deal_activities
-- ============================================================================

DROP POLICY IF EXISTS "deal_activities_select" ON deal_activities;
DROP POLICY IF EXISTS "deal_activities_insert" ON deal_activities;
DROP POLICY IF EXISTS "deal_activities_update" ON deal_activities;
DROP POLICY IF EXISTS "deal_activities_delete" ON deal_activities;

DROP POLICY IF EXISTS "deal_activities_select" ON deal_activities;
CREATE POLICY "deal_activities_select" ON deal_activities FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = deal_activities.deal_id
      AND d.owner_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "deal_activities_insert" ON deal_activities;
CREATE POLICY "deal_activities_insert" ON deal_activities FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "deal_activities_update" ON deal_activities;
CREATE POLICY "deal_activities_update" ON deal_activities FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "deal_activities_delete" ON deal_activities;
CREATE POLICY "deal_activities_delete" ON deal_activities FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

-- ============================================================================
-- TABLE: deal_health_alerts
-- ============================================================================

DROP POLICY IF EXISTS "deal_health_alerts_select" ON deal_health_alerts;
DROP POLICY IF EXISTS "deal_health_alerts_insert" ON deal_health_alerts;
DROP POLICY IF EXISTS "deal_health_alerts_update" ON deal_health_alerts;
DROP POLICY IF EXISTS "deal_health_alerts_delete" ON deal_health_alerts;

DROP POLICY IF EXISTS "deal_health_alerts_select" ON deal_health_alerts;
CREATE POLICY "deal_health_alerts_select" ON deal_health_alerts FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = deal_health_alerts.deal_id
      AND d.owner_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "deal_health_alerts_insert" ON deal_health_alerts;
CREATE POLICY "deal_health_alerts_insert" ON deal_health_alerts FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "deal_health_alerts_update" ON deal_health_alerts;
CREATE POLICY "deal_health_alerts_update" ON deal_health_alerts FOR UPDATE
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "deal_health_alerts_delete" ON deal_health_alerts;
CREATE POLICY "deal_health_alerts_delete" ON deal_health_alerts FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: deal_health_history
-- ============================================================================

DROP POLICY IF EXISTS "deal_health_history_select" ON deal_health_history;
DROP POLICY IF EXISTS "deal_health_history_insert" ON deal_health_history;
DROP POLICY IF EXISTS "deal_health_history_update" ON deal_health_history;
DROP POLICY IF EXISTS "deal_health_history_delete" ON deal_health_history;

DROP POLICY IF EXISTS "deal_health_history_select" ON deal_health_history;
CREATE POLICY "deal_health_history_select" ON deal_health_history FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = deal_health_history.deal_id
      AND d.owner_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "deal_health_history_insert" ON deal_health_history;
CREATE POLICY "deal_health_history_insert" ON deal_health_history FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "deal_health_history_update" ON deal_health_history;
CREATE POLICY "deal_health_history_update" ON deal_health_history FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "deal_health_history_delete" ON deal_health_history;
CREATE POLICY "deal_health_history_delete" ON deal_health_history FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: deal_health_rules
-- ============================================================================

DROP POLICY IF EXISTS "deal_health_rules_select" ON deal_health_rules;
DROP POLICY IF EXISTS "deal_health_rules_insert" ON deal_health_rules;
DROP POLICY IF EXISTS "deal_health_rules_update" ON deal_health_rules;
DROP POLICY IF EXISTS "deal_health_rules_delete" ON deal_health_rules;

DROP POLICY IF EXISTS "deal_health_rules_select" ON deal_health_rules;
CREATE POLICY "deal_health_rules_select" ON deal_health_rules FOR SELECT
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "deal_health_rules_insert" ON deal_health_rules;
CREATE POLICY "deal_health_rules_insert" ON deal_health_rules FOR INSERT
  WITH CHECK (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "deal_health_rules_update" ON deal_health_rules;
CREATE POLICY "deal_health_rules_update" ON deal_health_rules FOR UPDATE
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "deal_health_rules_delete" ON deal_health_rules;
CREATE POLICY "deal_health_rules_delete" ON deal_health_rules FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: deal_health_scores
-- ============================================================================

DROP POLICY IF EXISTS "deal_health_scores_select" ON deal_health_scores;
DROP POLICY IF EXISTS "deal_health_scores_insert" ON deal_health_scores;
DROP POLICY IF EXISTS "deal_health_scores_update" ON deal_health_scores;
DROP POLICY IF EXISTS "deal_health_scores_delete" ON deal_health_scores;

DROP POLICY IF EXISTS "deal_health_scores_select" ON deal_health_scores;
CREATE POLICY "deal_health_scores_select" ON deal_health_scores FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = deal_health_scores.deal_id
      AND d.owner_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "deal_health_scores_insert" ON deal_health_scores;
CREATE POLICY "deal_health_scores_insert" ON deal_health_scores FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "deal_health_scores_update" ON deal_health_scores;
CREATE POLICY "deal_health_scores_update" ON deal_health_scores FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "deal_health_scores_delete" ON deal_health_scores;
CREATE POLICY "deal_health_scores_delete" ON deal_health_scores FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: deal_migration_reviews
-- ============================================================================

DROP POLICY IF EXISTS "deal_migration_reviews_select" ON deal_migration_reviews;
DROP POLICY IF EXISTS "deal_migration_reviews_insert" ON deal_migration_reviews;
DROP POLICY IF EXISTS "deal_migration_reviews_update" ON deal_migration_reviews;
DROP POLICY IF EXISTS "deal_migration_reviews_delete" ON deal_migration_reviews;
DROP POLICY IF EXISTS "deal_migration_reviews_admin_only" ON deal_migration_reviews;

DROP POLICY IF EXISTS "deal_migration_reviews_all" ON deal_migration_reviews;
CREATE POLICY "deal_migration_reviews_all" ON deal_migration_reviews FOR ALL
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: deal_notes
-- ============================================================================

DROP POLICY IF EXISTS "deal_notes_select" ON deal_notes;
DROP POLICY IF EXISTS "deal_notes_insert" ON deal_notes;
DROP POLICY IF EXISTS "deal_notes_update" ON deal_notes;
DROP POLICY IF EXISTS "deal_notes_delete" ON deal_notes;

DROP POLICY IF EXISTS "deal_notes_select" ON deal_notes;
CREATE POLICY "deal_notes_select" ON deal_notes FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = deal_notes.deal_id
      AND d.owner_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "deal_notes_insert" ON deal_notes;
CREATE POLICY "deal_notes_insert" ON deal_notes FOR INSERT
  WITH CHECK (is_service_role() OR created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "deal_notes_update" ON deal_notes;
CREATE POLICY "deal_notes_update" ON deal_notes FOR UPDATE
  USING (is_service_role() OR created_by = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "deal_notes_delete" ON deal_notes;
CREATE POLICY "deal_notes_delete" ON deal_notes FOR DELETE
  USING (is_service_role() OR created_by = (SELECT auth.uid()) OR is_admin_optimized());

-- ============================================================================
-- TABLE: deal_stage_history
-- ============================================================================

DROP POLICY IF EXISTS "deal_stage_history_select" ON deal_stage_history;
DROP POLICY IF EXISTS "deal_stage_history_insert" ON deal_stage_history;
DROP POLICY IF EXISTS "deal_stage_history_update" ON deal_stage_history;
DROP POLICY IF EXISTS "deal_stage_history_delete" ON deal_stage_history;

DROP POLICY IF EXISTS "deal_stage_history_select" ON deal_stage_history;
CREATE POLICY "deal_stage_history_select" ON deal_stage_history FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = deal_stage_history.deal_id
      AND d.owner_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "deal_stage_history_insert" ON deal_stage_history;
CREATE POLICY "deal_stage_history_insert" ON deal_stage_history FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "deal_stage_history_update" ON deal_stage_history;
CREATE POLICY "deal_stage_history_update" ON deal_stage_history FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "deal_stage_history_delete" ON deal_stage_history;
CREATE POLICY "deal_stage_history_delete" ON deal_stage_history FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: email_attachments
-- ============================================================================

DROP POLICY IF EXISTS "email_attachments_select" ON email_attachments;
DROP POLICY IF EXISTS "email_attachments_insert" ON email_attachments;
DROP POLICY IF EXISTS "email_attachments_update" ON email_attachments;
DROP POLICY IF EXISTS "email_attachments_delete" ON email_attachments;

DROP POLICY IF EXISTS "email_attachments_select" ON email_attachments;
CREATE POLICY "email_attachments_select" ON email_attachments FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM emails e
      WHERE e.id = email_attachments.email_id
      AND e.user_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "email_attachments_insert" ON email_attachments;
CREATE POLICY "email_attachments_insert" ON email_attachments FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "email_attachments_update" ON email_attachments;
CREATE POLICY "email_attachments_update" ON email_attachments FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "email_attachments_delete" ON email_attachments;
CREATE POLICY "email_attachments_delete" ON email_attachments FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: email_labels
-- ============================================================================

DROP POLICY IF EXISTS "email_labels_select" ON email_labels;
DROP POLICY IF EXISTS "email_labels_insert" ON email_labels;
DROP POLICY IF EXISTS "email_labels_update" ON email_labels;
DROP POLICY IF EXISTS "email_labels_delete" ON email_labels;

DROP POLICY IF EXISTS "email_labels_select" ON email_labels;
CREATE POLICY "email_labels_select" ON email_labels FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "email_labels_insert" ON email_labels;
CREATE POLICY "email_labels_insert" ON email_labels FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "email_labels_update" ON email_labels;
CREATE POLICY "email_labels_update" ON email_labels FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "email_labels_delete" ON email_labels;
CREATE POLICY "email_labels_delete" ON email_labels FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

-- ============================================================================
-- TABLE: email_label_map
-- ============================================================================

DROP POLICY IF EXISTS "email_label_map_select" ON email_label_map;
DROP POLICY IF EXISTS "email_label_map_insert" ON email_label_map;
DROP POLICY IF EXISTS "email_label_map_update" ON email_label_map;
DROP POLICY IF EXISTS "email_label_map_delete" ON email_label_map;

DROP POLICY IF EXISTS "email_label_map_select" ON email_label_map;
CREATE POLICY "email_label_map_select" ON email_label_map FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM emails e
      WHERE e.id = email_label_map.email_id
      AND e.user_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "email_label_map_insert" ON email_label_map;
CREATE POLICY "email_label_map_insert" ON email_label_map FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "email_label_map_update" ON email_label_map;
CREATE POLICY "email_label_map_update" ON email_label_map FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "email_label_map_delete" ON email_label_map;
CREATE POLICY "email_label_map_delete" ON email_label_map FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: email_templates
-- ============================================================================

DROP POLICY IF EXISTS "email_templates_select" ON email_templates;
DROP POLICY IF EXISTS "email_templates_insert" ON email_templates;
DROP POLICY IF EXISTS "email_templates_update" ON email_templates;
DROP POLICY IF EXISTS "email_templates_delete" ON email_templates;

DROP POLICY IF EXISTS "email_templates_select" ON email_templates;
CREATE POLICY "email_templates_select" ON email_templates FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "email_templates_insert" ON email_templates;
CREATE POLICY "email_templates_insert" ON email_templates FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "email_templates_update" ON email_templates;
CREATE POLICY "email_templates_update" ON email_templates FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "email_templates_delete" ON email_templates;
CREATE POLICY "email_templates_delete" ON email_templates FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

-- ============================================================================
-- TABLE: fathom_transcript_retry_jobs
-- ============================================================================

DROP POLICY IF EXISTS "fathom_transcript_retry_jobs_select" ON fathom_transcript_retry_jobs;
DROP POLICY IF EXISTS "fathom_transcript_retry_jobs_insert" ON fathom_transcript_retry_jobs;
DROP POLICY IF EXISTS "fathom_transcript_retry_jobs_update" ON fathom_transcript_retry_jobs;
DROP POLICY IF EXISTS "fathom_transcript_retry_jobs_delete" ON fathom_transcript_retry_jobs;

DROP POLICY IF EXISTS "fathom_transcript_retry_jobs_select" ON fathom_transcript_retry_jobs;
CREATE POLICY "fathom_transcript_retry_jobs_select" ON fathom_transcript_retry_jobs FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "fathom_transcript_retry_jobs_insert" ON fathom_transcript_retry_jobs;
CREATE POLICY "fathom_transcript_retry_jobs_insert" ON fathom_transcript_retry_jobs FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "fathom_transcript_retry_jobs_update" ON fathom_transcript_retry_jobs;
CREATE POLICY "fathom_transcript_retry_jobs_update" ON fathom_transcript_retry_jobs FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "fathom_transcript_retry_jobs_delete" ON fathom_transcript_retry_jobs;
CREATE POLICY "fathom_transcript_retry_jobs_delete" ON fathom_transcript_retry_jobs FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: ghost_detection_signals
-- ============================================================================

DROP POLICY IF EXISTS "ghost_detection_signals_select" ON ghost_detection_signals;
DROP POLICY IF EXISTS "ghost_detection_signals_insert" ON ghost_detection_signals;
DROP POLICY IF EXISTS "ghost_detection_signals_update" ON ghost_detection_signals;
DROP POLICY IF EXISTS "ghost_detection_signals_delete" ON ghost_detection_signals;

-- Note: ghost_detection_signals has user_id and relationship_health_id, not deal_id
DROP POLICY IF EXISTS "ghost_detection_signals_select" ON ghost_detection_signals;
CREATE POLICY "ghost_detection_signals_select" ON ghost_detection_signals FOR SELECT
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "ghost_detection_signals_insert" ON ghost_detection_signals;
CREATE POLICY "ghost_detection_signals_insert" ON ghost_detection_signals FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "ghost_detection_signals_update" ON ghost_detection_signals;
CREATE POLICY "ghost_detection_signals_update" ON ghost_detection_signals FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "ghost_detection_signals_delete" ON ghost_detection_signals;
CREATE POLICY "ghost_detection_signals_delete" ON ghost_detection_signals FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: global_topics
-- ============================================================================

DROP POLICY IF EXISTS "global_topics_select" ON global_topics;
DROP POLICY IF EXISTS "global_topics_insert" ON global_topics;
DROP POLICY IF EXISTS "global_topics_update" ON global_topics;
DROP POLICY IF EXISTS "global_topics_delete" ON global_topics;

DROP POLICY IF EXISTS "global_topics_select" ON global_topics;
CREATE POLICY "global_topics_select" ON global_topics FOR SELECT
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "global_topics_insert" ON global_topics;
CREATE POLICY "global_topics_insert" ON global_topics FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "global_topics_update" ON global_topics;
CREATE POLICY "global_topics_update" ON global_topics FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "global_topics_delete" ON global_topics;
CREATE POLICY "global_topics_delete" ON global_topics FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: global_topic_sources
-- ============================================================================

DROP POLICY IF EXISTS "global_topic_sources_select" ON global_topic_sources;
DROP POLICY IF EXISTS "global_topic_sources_insert" ON global_topic_sources;
DROP POLICY IF EXISTS "global_topic_sources_update" ON global_topic_sources;
DROP POLICY IF EXISTS "global_topic_sources_delete" ON global_topic_sources;

DROP POLICY IF EXISTS "global_topic_sources_select" ON global_topic_sources;
CREATE POLICY "global_topic_sources_select" ON global_topic_sources FOR SELECT
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "global_topic_sources_insert" ON global_topic_sources;
CREATE POLICY "global_topic_sources_insert" ON global_topic_sources FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "global_topic_sources_update" ON global_topic_sources;
CREATE POLICY "global_topic_sources_update" ON global_topic_sources FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "global_topic_sources_delete" ON global_topic_sources;
CREATE POLICY "global_topic_sources_delete" ON global_topic_sources FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: google_calendars
-- ============================================================================

DROP POLICY IF EXISTS "google_calendars_select" ON google_calendars;
DROP POLICY IF EXISTS "google_calendars_insert" ON google_calendars;
DROP POLICY IF EXISTS "google_calendars_update" ON google_calendars;
DROP POLICY IF EXISTS "google_calendars_delete" ON google_calendars;

-- Note: google_calendars has integration_id, not user_id
DROP POLICY IF EXISTS "google_calendars_select" ON google_calendars;
CREATE POLICY "google_calendars_select" ON google_calendars FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM google_integrations gi
      WHERE gi.id = google_calendars.integration_id
      AND gi.user_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "google_calendars_insert" ON google_calendars;
CREATE POLICY "google_calendars_insert" ON google_calendars FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "google_calendars_update" ON google_calendars;
CREATE POLICY "google_calendars_update" ON google_calendars FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "google_calendars_delete" ON google_calendars;
CREATE POLICY "google_calendars_delete" ON google_calendars FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: google_docs_templates
-- ============================================================================

DROP POLICY IF EXISTS "google_docs_templates_select" ON google_docs_templates;
DROP POLICY IF EXISTS "google_docs_templates_insert" ON google_docs_templates;
DROP POLICY IF EXISTS "google_docs_templates_update" ON google_docs_templates;
DROP POLICY IF EXISTS "google_docs_templates_delete" ON google_docs_templates;

DROP POLICY IF EXISTS "google_docs_templates_select" ON google_docs_templates;
CREATE POLICY "google_docs_templates_select" ON google_docs_templates FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "google_docs_templates_insert" ON google_docs_templates;
CREATE POLICY "google_docs_templates_insert" ON google_docs_templates FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "google_docs_templates_update" ON google_docs_templates;
CREATE POLICY "google_docs_templates_update" ON google_docs_templates FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "google_docs_templates_delete" ON google_docs_templates;
CREATE POLICY "google_docs_templates_delete" ON google_docs_templates FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

-- ============================================================================
-- TABLE: google_drive_folders
-- ============================================================================

DROP POLICY IF EXISTS "google_drive_folders_select" ON google_drive_folders;
DROP POLICY IF EXISTS "google_drive_folders_insert" ON google_drive_folders;
DROP POLICY IF EXISTS "google_drive_folders_update" ON google_drive_folders;
DROP POLICY IF EXISTS "google_drive_folders_delete" ON google_drive_folders;

-- Note: google_drive_folders has integration_id, not user_id
DROP POLICY IF EXISTS "google_drive_folders_select" ON google_drive_folders;
CREATE POLICY "google_drive_folders_select" ON google_drive_folders FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM google_integrations gi
      WHERE gi.id = google_drive_folders.integration_id
      AND gi.user_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "google_drive_folders_insert" ON google_drive_folders;
CREATE POLICY "google_drive_folders_insert" ON google_drive_folders FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "google_drive_folders_update" ON google_drive_folders;
CREATE POLICY "google_drive_folders_update" ON google_drive_folders FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "google_drive_folders_delete" ON google_drive_folders;
CREATE POLICY "google_drive_folders_delete" ON google_drive_folders FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: google_email_labels
-- ============================================================================

DROP POLICY IF EXISTS "google_email_labels_select" ON google_email_labels;
DROP POLICY IF EXISTS "google_email_labels_insert" ON google_email_labels;
DROP POLICY IF EXISTS "google_email_labels_update" ON google_email_labels;
DROP POLICY IF EXISTS "google_email_labels_delete" ON google_email_labels;

-- Note: google_email_labels has integration_id, not user_id
DROP POLICY IF EXISTS "google_email_labels_select" ON google_email_labels;
CREATE POLICY "google_email_labels_select" ON google_email_labels FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM google_integrations gi
      WHERE gi.id = google_email_labels.integration_id
      AND gi.user_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "google_email_labels_insert" ON google_email_labels;
CREATE POLICY "google_email_labels_insert" ON google_email_labels FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "google_email_labels_update" ON google_email_labels;
CREATE POLICY "google_email_labels_update" ON google_email_labels FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "google_email_labels_delete" ON google_email_labels;
CREATE POLICY "google_email_labels_delete" ON google_email_labels FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: google_oauth_states
-- ============================================================================

DROP POLICY IF EXISTS "google_oauth_states_select" ON google_oauth_states;
DROP POLICY IF EXISTS "google_oauth_states_insert" ON google_oauth_states;
DROP POLICY IF EXISTS "google_oauth_states_update" ON google_oauth_states;
DROP POLICY IF EXISTS "google_oauth_states_delete" ON google_oauth_states;

DROP POLICY IF EXISTS "google_oauth_states_select" ON google_oauth_states;
CREATE POLICY "google_oauth_states_select" ON google_oauth_states FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "google_oauth_states_insert" ON google_oauth_states;
CREATE POLICY "google_oauth_states_insert" ON google_oauth_states FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "google_oauth_states_update" ON google_oauth_states;
CREATE POLICY "google_oauth_states_update" ON google_oauth_states FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "google_oauth_states_delete" ON google_oauth_states;
CREATE POLICY "google_oauth_states_delete" ON google_oauth_states FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

-- ============================================================================
-- TABLE: google_service_logs
-- ============================================================================

DROP POLICY IF EXISTS "google_service_logs_select" ON google_service_logs;
DROP POLICY IF EXISTS "google_service_logs_insert" ON google_service_logs;
DROP POLICY IF EXISTS "google_service_logs_update" ON google_service_logs;
DROP POLICY IF EXISTS "google_service_logs_delete" ON google_service_logs;

-- Note: google_service_logs has integration_id, not user_id
DROP POLICY IF EXISTS "google_service_logs_select" ON google_service_logs;
CREATE POLICY "google_service_logs_select" ON google_service_logs FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM google_integrations gi
      WHERE gi.id = google_service_logs.integration_id
      AND gi.user_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "google_service_logs_insert" ON google_service_logs;
CREATE POLICY "google_service_logs_insert" ON google_service_logs FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "google_service_logs_update" ON google_service_logs;
CREATE POLICY "google_service_logs_update" ON google_service_logs FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "google_service_logs_delete" ON google_service_logs;
CREATE POLICY "google_service_logs_delete" ON google_service_logs FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: google_task_mappings
-- ============================================================================

DROP POLICY IF EXISTS "google_task_mappings_select" ON google_task_mappings;
DROP POLICY IF EXISTS "google_task_mappings_insert" ON google_task_mappings;
DROP POLICY IF EXISTS "google_task_mappings_update" ON google_task_mappings;
DROP POLICY IF EXISTS "google_task_mappings_delete" ON google_task_mappings;

DROP POLICY IF EXISTS "google_task_mappings_select" ON google_task_mappings;
CREATE POLICY "google_task_mappings_select" ON google_task_mappings FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "google_task_mappings_insert" ON google_task_mappings;
CREATE POLICY "google_task_mappings_insert" ON google_task_mappings FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "google_task_mappings_update" ON google_task_mappings;
CREATE POLICY "google_task_mappings_update" ON google_task_mappings FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "google_task_mappings_delete" ON google_task_mappings;
CREATE POLICY "google_task_mappings_delete" ON google_task_mappings FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

-- ============================================================================
-- TABLE: google_tasks_list_configs
-- ============================================================================

DROP POLICY IF EXISTS "google_tasks_list_configs_select" ON google_tasks_list_configs;
DROP POLICY IF EXISTS "google_tasks_list_configs_insert" ON google_tasks_list_configs;
DROP POLICY IF EXISTS "google_tasks_list_configs_update" ON google_tasks_list_configs;
DROP POLICY IF EXISTS "google_tasks_list_configs_delete" ON google_tasks_list_configs;

DROP POLICY IF EXISTS "google_tasks_list_configs_select" ON google_tasks_list_configs;
CREATE POLICY "google_tasks_list_configs_select" ON google_tasks_list_configs FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "google_tasks_list_configs_insert" ON google_tasks_list_configs;
CREATE POLICY "google_tasks_list_configs_insert" ON google_tasks_list_configs FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "google_tasks_list_configs_update" ON google_tasks_list_configs;
CREATE POLICY "google_tasks_list_configs_update" ON google_tasks_list_configs FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "google_tasks_list_configs_delete" ON google_tasks_list_configs;
CREATE POLICY "google_tasks_list_configs_delete" ON google_tasks_list_configs FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

-- ============================================================================
-- TABLE: google_tasks_sync_status
-- ============================================================================

DROP POLICY IF EXISTS "google_tasks_sync_status_select" ON google_tasks_sync_status;
DROP POLICY IF EXISTS "google_tasks_sync_status_insert" ON google_tasks_sync_status;
DROP POLICY IF EXISTS "google_tasks_sync_status_update" ON google_tasks_sync_status;
DROP POLICY IF EXISTS "google_tasks_sync_status_delete" ON google_tasks_sync_status;

DROP POLICY IF EXISTS "google_tasks_sync_status_select" ON google_tasks_sync_status;
CREATE POLICY "google_tasks_sync_status_select" ON google_tasks_sync_status FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "google_tasks_sync_status_insert" ON google_tasks_sync_status;
CREATE POLICY "google_tasks_sync_status_insert" ON google_tasks_sync_status FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "google_tasks_sync_status_update" ON google_tasks_sync_status;
CREATE POLICY "google_tasks_sync_status_update" ON google_tasks_sync_status FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "google_tasks_sync_status_delete" ON google_tasks_sync_status;
CREATE POLICY "google_tasks_sync_status_delete" ON google_tasks_sync_status FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

-- ============================================================================
-- TABLE: impersonation_logs
-- ============================================================================

DROP POLICY IF EXISTS "impersonation_logs_select" ON impersonation_logs;
DROP POLICY IF EXISTS "impersonation_logs_insert" ON impersonation_logs;
DROP POLICY IF EXISTS "impersonation_logs_update" ON impersonation_logs;
DROP POLICY IF EXISTS "impersonation_logs_delete" ON impersonation_logs;

DROP POLICY IF EXISTS "impersonation_logs_all" ON impersonation_logs;
CREATE POLICY "impersonation_logs_all" ON impersonation_logs FOR ALL
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: intervention_templates
-- ============================================================================

DROP POLICY IF EXISTS "intervention_templates_select" ON intervention_templates;
DROP POLICY IF EXISTS "intervention_templates_insert" ON intervention_templates;
DROP POLICY IF EXISTS "intervention_templates_update" ON intervention_templates;
DROP POLICY IF EXISTS "intervention_templates_delete" ON intervention_templates;

DROP POLICY IF EXISTS "intervention_templates_select" ON intervention_templates;
CREATE POLICY "intervention_templates_select" ON intervention_templates FOR SELECT
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "intervention_templates_insert" ON intervention_templates;
CREATE POLICY "intervention_templates_insert" ON intervention_templates FOR INSERT
  WITH CHECK (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "intervention_templates_update" ON intervention_templates;
CREATE POLICY "intervention_templates_update" ON intervention_templates FOR UPDATE
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "intervention_templates_delete" ON intervention_templates;
CREATE POLICY "intervention_templates_delete" ON intervention_templates FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: interventions
-- ============================================================================

DROP POLICY IF EXISTS "interventions_select" ON interventions;
DROP POLICY IF EXISTS "interventions_insert" ON interventions;
DROP POLICY IF EXISTS "interventions_update" ON interventions;
DROP POLICY IF EXISTS "interventions_delete" ON interventions;

DROP POLICY IF EXISTS "interventions_select" ON interventions;
CREATE POLICY "interventions_select" ON interventions FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = interventions.deal_id
      AND d.owner_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "interventions_insert" ON interventions;
CREATE POLICY "interventions_insert" ON interventions FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "interventions_update" ON interventions;
CREATE POLICY "interventions_update" ON interventions FOR UPDATE
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "interventions_delete" ON interventions;
CREATE POLICY "interventions_delete" ON interventions FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: lead_events
-- ============================================================================

DROP POLICY IF EXISTS "lead_events_select" ON lead_events;
DROP POLICY IF EXISTS "lead_events_insert" ON lead_events;
DROP POLICY IF EXISTS "lead_events_update" ON lead_events;
DROP POLICY IF EXISTS "lead_events_delete" ON lead_events;

-- Note: leads table has owner_id, not user_id
DROP POLICY IF EXISTS "lead_events_select" ON lead_events;
CREATE POLICY "lead_events_select" ON lead_events FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = lead_events.lead_id
      AND l.owner_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "lead_events_insert" ON lead_events;
CREATE POLICY "lead_events_insert" ON lead_events FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "lead_events_update" ON lead_events;
CREATE POLICY "lead_events_update" ON lead_events FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "lead_events_delete" ON lead_events;
CREATE POLICY "lead_events_delete" ON lead_events FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: lead_prep_notes
-- ============================================================================

DROP POLICY IF EXISTS "lead_prep_notes_select" ON lead_prep_notes;
DROP POLICY IF EXISTS "lead_prep_notes_insert" ON lead_prep_notes;
DROP POLICY IF EXISTS "lead_prep_notes_update" ON lead_prep_notes;
DROP POLICY IF EXISTS "lead_prep_notes_delete" ON lead_prep_notes;

-- Note: lead_prep_notes has created_by, leads has owner_id
DROP POLICY IF EXISTS "lead_prep_notes_select" ON lead_prep_notes;
CREATE POLICY "lead_prep_notes_select" ON lead_prep_notes FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = lead_prep_notes.lead_id
      AND l.owner_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "lead_prep_notes_insert" ON lead_prep_notes;
CREATE POLICY "lead_prep_notes_insert" ON lead_prep_notes FOR INSERT
  WITH CHECK (is_service_role() OR created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "lead_prep_notes_update" ON lead_prep_notes;
CREATE POLICY "lead_prep_notes_update" ON lead_prep_notes FOR UPDATE
  USING (is_service_role() OR created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "lead_prep_notes_delete" ON lead_prep_notes;
CREATE POLICY "lead_prep_notes_delete" ON lead_prep_notes FOR DELETE
  USING (is_service_role() OR created_by = (SELECT auth.uid()));

-- ============================================================================
-- TABLE: mcp_connections
-- ============================================================================

DROP POLICY IF EXISTS "mcp_connections_select" ON mcp_connections;
DROP POLICY IF EXISTS "mcp_connections_insert" ON mcp_connections;
DROP POLICY IF EXISTS "mcp_connections_update" ON mcp_connections;
DROP POLICY IF EXISTS "mcp_connections_delete" ON mcp_connections;

DROP POLICY IF EXISTS "mcp_connections_select" ON mcp_connections;
CREATE POLICY "mcp_connections_select" ON mcp_connections FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "mcp_connections_insert" ON mcp_connections;
CREATE POLICY "mcp_connections_insert" ON mcp_connections FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "mcp_connections_update" ON mcp_connections;
CREATE POLICY "mcp_connections_update" ON mcp_connections FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "mcp_connections_delete" ON mcp_connections;
CREATE POLICY "mcp_connections_delete" ON mcp_connections FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

-- ============================================================================
-- TABLE: meeting_attendees
-- ============================================================================

DROP POLICY IF EXISTS "meeting_attendees_select" ON meeting_attendees;
DROP POLICY IF EXISTS "meeting_attendees_insert" ON meeting_attendees;
DROP POLICY IF EXISTS "meeting_attendees_update" ON meeting_attendees;
DROP POLICY IF EXISTS "meeting_attendees_delete" ON meeting_attendees;

DROP POLICY IF EXISTS "meeting_attendees_select" ON meeting_attendees;
CREATE POLICY "meeting_attendees_select" ON meeting_attendees FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_attendees.meeting_id
      AND m.owner_user_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "meeting_attendees_insert" ON meeting_attendees;
CREATE POLICY "meeting_attendees_insert" ON meeting_attendees FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "meeting_attendees_update" ON meeting_attendees;
CREATE POLICY "meeting_attendees_update" ON meeting_attendees FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "meeting_attendees_delete" ON meeting_attendees;
CREATE POLICY "meeting_attendees_delete" ON meeting_attendees FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: meeting_contacts
-- ============================================================================

DROP POLICY IF EXISTS "meeting_contacts_select" ON meeting_contacts;
DROP POLICY IF EXISTS "meeting_contacts_insert" ON meeting_contacts;
DROP POLICY IF EXISTS "meeting_contacts_update" ON meeting_contacts;
DROP POLICY IF EXISTS "meeting_contacts_delete" ON meeting_contacts;
DROP POLICY IF EXISTS "meeting_contacts_via_meeting" ON meeting_contacts;

DROP POLICY IF EXISTS "meeting_contacts_select" ON meeting_contacts;
CREATE POLICY "meeting_contacts_select" ON meeting_contacts FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_contacts.meeting_id
      AND m.owner_user_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "meeting_contacts_insert" ON meeting_contacts;
CREATE POLICY "meeting_contacts_insert" ON meeting_contacts FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "meeting_contacts_update" ON meeting_contacts;
CREATE POLICY "meeting_contacts_update" ON meeting_contacts FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "meeting_contacts_delete" ON meeting_contacts;
CREATE POLICY "meeting_contacts_delete" ON meeting_contacts FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: meeting_documents
-- ============================================================================

DROP POLICY IF EXISTS "meeting_documents_select" ON meeting_documents;
DROP POLICY IF EXISTS "meeting_documents_insert" ON meeting_documents;
DROP POLICY IF EXISTS "meeting_documents_update" ON meeting_documents;
DROP POLICY IF EXISTS "meeting_documents_delete" ON meeting_documents;

-- Note: meeting_documents.meeting_id is TEXT, meetings.id is UUID - use user_id column instead
DROP POLICY IF EXISTS "meeting_documents_select" ON meeting_documents;
CREATE POLICY "meeting_documents_select" ON meeting_documents FOR SELECT
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "meeting_documents_insert" ON meeting_documents;
CREATE POLICY "meeting_documents_insert" ON meeting_documents FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "meeting_documents_update" ON meeting_documents;
CREATE POLICY "meeting_documents_update" ON meeting_documents FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "meeting_documents_delete" ON meeting_documents;
CREATE POLICY "meeting_documents_delete" ON meeting_documents FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: meetings_waitlist
-- ============================================================================

DROP POLICY IF EXISTS "meetings_waitlist_select" ON meetings_waitlist;
DROP POLICY IF EXISTS "meetings_waitlist_insert" ON meetings_waitlist;
DROP POLICY IF EXISTS "meetings_waitlist_update" ON meetings_waitlist;
DROP POLICY IF EXISTS "meetings_waitlist_delete" ON meetings_waitlist;

DROP POLICY IF EXISTS "meetings_waitlist_select" ON meetings_waitlist;
CREATE POLICY "meetings_waitlist_select" ON meetings_waitlist FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "meetings_waitlist_insert" ON meetings_waitlist;
CREATE POLICY "meetings_waitlist_insert" ON meetings_waitlist FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "meetings_waitlist_update" ON meetings_waitlist;
CREATE POLICY "meetings_waitlist_update" ON meetings_waitlist FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "meetings_waitlist_delete" ON meetings_waitlist;
CREATE POLICY "meetings_waitlist_delete" ON meetings_waitlist FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

-- ============================================================================
-- TABLE: next_action_suggestions
-- ============================================================================

DROP POLICY IF EXISTS "next_action_suggestions_select" ON next_action_suggestions;
DROP POLICY IF EXISTS "next_action_suggestions_insert" ON next_action_suggestions;
DROP POLICY IF EXISTS "next_action_suggestions_update" ON next_action_suggestions;
DROP POLICY IF EXISTS "next_action_suggestions_delete" ON next_action_suggestions;

DROP POLICY IF EXISTS "next_action_suggestions_select" ON next_action_suggestions;
CREATE POLICY "next_action_suggestions_select" ON next_action_suggestions FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = next_action_suggestions.deal_id
      AND d.owner_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "next_action_suggestions_insert" ON next_action_suggestions;
CREATE POLICY "next_action_suggestions_insert" ON next_action_suggestions FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "next_action_suggestions_update" ON next_action_suggestions;
CREATE POLICY "next_action_suggestions_update" ON next_action_suggestions FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "next_action_suggestions_delete" ON next_action_suggestions;
CREATE POLICY "next_action_suggestions_delete" ON next_action_suggestions FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: notification_rate_limits
-- ============================================================================

DROP POLICY IF EXISTS "notification_rate_limits_select" ON notification_rate_limits;
DROP POLICY IF EXISTS "notification_rate_limits_insert" ON notification_rate_limits;
DROP POLICY IF EXISTS "notification_rate_limits_update" ON notification_rate_limits;
DROP POLICY IF EXISTS "notification_rate_limits_delete" ON notification_rate_limits;
DROP POLICY IF EXISTS "notification_rate_limits_select_policy" ON notification_rate_limits;

DROP POLICY IF EXISTS "notification_rate_limits_all" ON notification_rate_limits;
CREATE POLICY "notification_rate_limits_all" ON notification_rate_limits FOR ALL
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: pipeline_stage_recommendations
-- ============================================================================

DROP POLICY IF EXISTS "pipeline_stage_recommendations_select" ON pipeline_stage_recommendations;
DROP POLICY IF EXISTS "pipeline_stage_recommendations_insert" ON pipeline_stage_recommendations;
DROP POLICY IF EXISTS "pipeline_stage_recommendations_update" ON pipeline_stage_recommendations;
DROP POLICY IF EXISTS "pipeline_stage_recommendations_delete" ON pipeline_stage_recommendations;
DROP POLICY IF EXISTS "pipeline_stage_recommendations_own_data" ON pipeline_stage_recommendations;

DROP POLICY IF EXISTS "pipeline_stage_recommendations_select" ON pipeline_stage_recommendations;
CREATE POLICY "pipeline_stage_recommendations_select" ON pipeline_stage_recommendations FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = pipeline_stage_recommendations.deal_id
      AND d.owner_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "pipeline_stage_recommendations_insert" ON pipeline_stage_recommendations;
CREATE POLICY "pipeline_stage_recommendations_insert" ON pipeline_stage_recommendations FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "pipeline_stage_recommendations_update" ON pipeline_stage_recommendations;
CREATE POLICY "pipeline_stage_recommendations_update" ON pipeline_stage_recommendations FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "pipeline_stage_recommendations_delete" ON pipeline_stage_recommendations;
CREATE POLICY "pipeline_stage_recommendations_delete" ON pipeline_stage_recommendations FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: pricing_plans
-- ============================================================================

DROP POLICY IF EXISTS "pricing_plans_select" ON pricing_plans;
DROP POLICY IF EXISTS "pricing_plans_insert" ON pricing_plans;
DROP POLICY IF EXISTS "pricing_plans_update" ON pricing_plans;
DROP POLICY IF EXISTS "pricing_plans_delete" ON pricing_plans;

DROP POLICY IF EXISTS "pricing_plans_select" ON pricing_plans;
CREATE POLICY "pricing_plans_select" ON pricing_plans FOR SELECT
  USING (true);  -- Public read for pricing page

DROP POLICY IF EXISTS "pricing_plans_insert" ON pricing_plans;
CREATE POLICY "pricing_plans_insert" ON pricing_plans FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "pricing_plans_update" ON pricing_plans;
CREATE POLICY "pricing_plans_update" ON pricing_plans FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "pricing_plans_delete" ON pricing_plans;
CREATE POLICY "pricing_plans_delete" ON pricing_plans FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: proposal_jobs
-- ============================================================================

DROP POLICY IF EXISTS "proposal_jobs_select" ON proposal_jobs;
DROP POLICY IF EXISTS "proposal_jobs_insert" ON proposal_jobs;
DROP POLICY IF EXISTS "proposal_jobs_update" ON proposal_jobs;
DROP POLICY IF EXISTS "proposal_jobs_delete" ON proposal_jobs;

DROP POLICY IF EXISTS "proposal_jobs_select" ON proposal_jobs;
CREATE POLICY "proposal_jobs_select" ON proposal_jobs FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "proposal_jobs_insert" ON proposal_jobs;
CREATE POLICY "proposal_jobs_insert" ON proposal_jobs FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "proposal_jobs_update" ON proposal_jobs;
CREATE POLICY "proposal_jobs_update" ON proposal_jobs FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "proposal_jobs_delete" ON proposal_jobs;
CREATE POLICY "proposal_jobs_delete" ON proposal_jobs FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

-- ============================================================================
-- TABLE: proposal_templates
-- ============================================================================

DROP POLICY IF EXISTS "proposal_templates_select" ON proposal_templates;
DROP POLICY IF EXISTS "proposal_templates_insert" ON proposal_templates;
DROP POLICY IF EXISTS "proposal_templates_update" ON proposal_templates;
DROP POLICY IF EXISTS "proposal_templates_delete" ON proposal_templates;

DROP POLICY IF EXISTS "proposal_templates_select" ON proposal_templates;
CREATE POLICY "proposal_templates_select" ON proposal_templates FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "proposal_templates_insert" ON proposal_templates;
CREATE POLICY "proposal_templates_insert" ON proposal_templates FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "proposal_templates_update" ON proposal_templates;
CREATE POLICY "proposal_templates_update" ON proposal_templates FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "proposal_templates_delete" ON proposal_templates;
CREATE POLICY "proposal_templates_delete" ON proposal_templates FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

-- ============================================================================
-- TABLE: relationship_health_history
-- ============================================================================

DROP POLICY IF EXISTS "relationship_health_history_select" ON relationship_health_history;
DROP POLICY IF EXISTS "relationship_health_history_insert" ON relationship_health_history;
DROP POLICY IF EXISTS "relationship_health_history_update" ON relationship_health_history;
DROP POLICY IF EXISTS "relationship_health_history_delete" ON relationship_health_history;

DROP POLICY IF EXISTS "relationship_health_history_select" ON relationship_health_history;
CREATE POLICY "relationship_health_history_select" ON relationship_health_history FOR SELECT
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "relationship_health_history_insert" ON relationship_health_history;
CREATE POLICY "relationship_health_history_insert" ON relationship_health_history FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "relationship_health_history_update" ON relationship_health_history;
CREATE POLICY "relationship_health_history_update" ON relationship_health_history FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "relationship_health_history_delete" ON relationship_health_history;
CREATE POLICY "relationship_health_history_delete" ON relationship_health_history FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: relationship_health_scores
-- ============================================================================

DROP POLICY IF EXISTS "relationship_health_scores_select" ON relationship_health_scores;
DROP POLICY IF EXISTS "relationship_health_scores_insert" ON relationship_health_scores;
DROP POLICY IF EXISTS "relationship_health_scores_update" ON relationship_health_scores;
DROP POLICY IF EXISTS "relationship_health_scores_delete" ON relationship_health_scores;

DROP POLICY IF EXISTS "relationship_health_scores_select" ON relationship_health_scores;
CREATE POLICY "relationship_health_scores_select" ON relationship_health_scores FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = relationship_health_scores.contact_id
      AND c.owner_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "relationship_health_scores_insert" ON relationship_health_scores;
CREATE POLICY "relationship_health_scores_insert" ON relationship_health_scores FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "relationship_health_scores_update" ON relationship_health_scores;
CREATE POLICY "relationship_health_scores_update" ON relationship_health_scores FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "relationship_health_scores_delete" ON relationship_health_scores;
CREATE POLICY "relationship_health_scores_delete" ON relationship_health_scores FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: roadmap_votes
-- ============================================================================

DROP POLICY IF EXISTS "roadmap_votes_select" ON roadmap_votes;
DROP POLICY IF EXISTS "roadmap_votes_insert" ON roadmap_votes;
DROP POLICY IF EXISTS "roadmap_votes_update" ON roadmap_votes;
DROP POLICY IF EXISTS "roadmap_votes_delete" ON roadmap_votes;

DROP POLICY IF EXISTS "roadmap_votes_select" ON roadmap_votes;
CREATE POLICY "roadmap_votes_select" ON roadmap_votes FOR SELECT
  USING (true);  -- Public read for roadmap

DROP POLICY IF EXISTS "roadmap_votes_insert" ON roadmap_votes;
CREATE POLICY "roadmap_votes_insert" ON roadmap_votes FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "roadmap_votes_update" ON roadmap_votes;
CREATE POLICY "roadmap_votes_update" ON roadmap_votes FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "roadmap_votes_delete" ON roadmap_votes;
CREATE POLICY "roadmap_votes_delete" ON roadmap_votes FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

-- ============================================================================
-- TABLE: savvycal_link_mappings
-- ============================================================================

DROP POLICY IF EXISTS "savvycal_link_mappings_select" ON savvycal_link_mappings;
DROP POLICY IF EXISTS "savvycal_link_mappings_insert" ON savvycal_link_mappings;
DROP POLICY IF EXISTS "savvycal_link_mappings_update" ON savvycal_link_mappings;
DROP POLICY IF EXISTS "savvycal_link_mappings_delete" ON savvycal_link_mappings;

-- Note: savvycal_link_mappings has no user_id column - it's global link config
DROP POLICY IF EXISTS "savvycal_link_mappings_select" ON savvycal_link_mappings;
CREATE POLICY "savvycal_link_mappings_select" ON savvycal_link_mappings FOR SELECT
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "savvycal_link_mappings_insert" ON savvycal_link_mappings;
CREATE POLICY "savvycal_link_mappings_insert" ON savvycal_link_mappings FOR INSERT
  WITH CHECK (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "savvycal_link_mappings_update" ON savvycal_link_mappings;
CREATE POLICY "savvycal_link_mappings_update" ON savvycal_link_mappings FOR UPDATE
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "savvycal_link_mappings_delete" ON savvycal_link_mappings;
CREATE POLICY "savvycal_link_mappings_delete" ON savvycal_link_mappings FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: savvycal_source_mappings
-- ============================================================================

DROP POLICY IF EXISTS "savvycal_source_mappings_select" ON savvycal_source_mappings;
DROP POLICY IF EXISTS "savvycal_source_mappings_insert" ON savvycal_source_mappings;
DROP POLICY IF EXISTS "savvycal_source_mappings_update" ON savvycal_source_mappings;
DROP POLICY IF EXISTS "savvycal_source_mappings_delete" ON savvycal_source_mappings;

-- Note: savvycal_source_mappings has created_by and org_id
DROP POLICY IF EXISTS "savvycal_source_mappings_select" ON savvycal_source_mappings;
CREATE POLICY "savvycal_source_mappings_select" ON savvycal_source_mappings FOR SELECT
  USING (is_service_role() OR created_by = (SELECT auth.uid()) OR org_id = get_user_org_id() OR is_admin_optimized());

DROP POLICY IF EXISTS "savvycal_source_mappings_insert" ON savvycal_source_mappings;
CREATE POLICY "savvycal_source_mappings_insert" ON savvycal_source_mappings FOR INSERT
  WITH CHECK (is_service_role() OR created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "savvycal_source_mappings_update" ON savvycal_source_mappings;
CREATE POLICY "savvycal_source_mappings_update" ON savvycal_source_mappings FOR UPDATE
  USING (is_service_role() OR created_by = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "savvycal_source_mappings_delete" ON savvycal_source_mappings;
CREATE POLICY "savvycal_source_mappings_delete" ON savvycal_source_mappings FOR DELETE
  USING (is_service_role() OR created_by = (SELECT auth.uid()) OR is_admin_optimized());

-- ============================================================================
-- TABLE: sentiment_alerts
-- ============================================================================

DROP POLICY IF EXISTS "sentiment_alerts_select" ON sentiment_alerts;
DROP POLICY IF EXISTS "sentiment_alerts_insert" ON sentiment_alerts;
DROP POLICY IF EXISTS "sentiment_alerts_update" ON sentiment_alerts;
DROP POLICY IF EXISTS "sentiment_alerts_delete" ON sentiment_alerts;

DROP POLICY IF EXISTS "sentiment_alerts_select" ON sentiment_alerts;
CREATE POLICY "sentiment_alerts_select" ON sentiment_alerts FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "sentiment_alerts_insert" ON sentiment_alerts;
CREATE POLICY "sentiment_alerts_insert" ON sentiment_alerts FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "sentiment_alerts_update" ON sentiment_alerts;
CREATE POLICY "sentiment_alerts_update" ON sentiment_alerts FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "sentiment_alerts_delete" ON sentiment_alerts;
CREATE POLICY "sentiment_alerts_delete" ON sentiment_alerts FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

-- ============================================================================
-- TABLE: slack_notification_settings
-- ============================================================================

DROP POLICY IF EXISTS "slack_notification_settings_select" ON slack_notification_settings;
DROP POLICY IF EXISTS "slack_notification_settings_insert" ON slack_notification_settings;
DROP POLICY IF EXISTS "slack_notification_settings_update" ON slack_notification_settings;
DROP POLICY IF EXISTS "slack_notification_settings_delete" ON slack_notification_settings;
DROP POLICY IF EXISTS "org_admins_manage_notification_settings" ON slack_notification_settings;

DROP POLICY IF EXISTS "slack_notification_settings_select" ON slack_notification_settings;
CREATE POLICY "slack_notification_settings_select" ON slack_notification_settings FOR SELECT
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "slack_notification_settings_insert" ON slack_notification_settings;
CREATE POLICY "slack_notification_settings_insert" ON slack_notification_settings FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "slack_notification_settings_update" ON slack_notification_settings;
CREATE POLICY "slack_notification_settings_update" ON slack_notification_settings FOR UPDATE
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "slack_notification_settings_delete" ON slack_notification_settings;
CREATE POLICY "slack_notification_settings_delete" ON slack_notification_settings FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: slack_notifications_sent
-- ============================================================================

DROP POLICY IF EXISTS "slack_notifications_sent_select" ON slack_notifications_sent;
DROP POLICY IF EXISTS "slack_notifications_sent_insert" ON slack_notifications_sent;
DROP POLICY IF EXISTS "slack_notifications_sent_update" ON slack_notifications_sent;
DROP POLICY IF EXISTS "slack_notifications_sent_delete" ON slack_notifications_sent;
DROP POLICY IF EXISTS "org_members_view_sent_notifications" ON slack_notifications_sent;

DROP POLICY IF EXISTS "slack_notifications_sent_select" ON slack_notifications_sent;
CREATE POLICY "slack_notifications_sent_select" ON slack_notifications_sent FOR SELECT
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "slack_notifications_sent_insert" ON slack_notifications_sent;
CREATE POLICY "slack_notifications_sent_insert" ON slack_notifications_sent FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "slack_notifications_sent_update" ON slack_notifications_sent;
CREATE POLICY "slack_notifications_sent_update" ON slack_notifications_sent FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "slack_notifications_sent_delete" ON slack_notifications_sent;
CREATE POLICY "slack_notifications_sent_delete" ON slack_notifications_sent FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: slack_org_settings
-- ============================================================================

DROP POLICY IF EXISTS "slack_org_settings_select" ON slack_org_settings;
DROP POLICY IF EXISTS "slack_org_settings_insert" ON slack_org_settings;
DROP POLICY IF EXISTS "slack_org_settings_update" ON slack_org_settings;
DROP POLICY IF EXISTS "slack_org_settings_delete" ON slack_org_settings;
DROP POLICY IF EXISTS "org_admins_manage_slack_settings" ON slack_org_settings;

DROP POLICY IF EXISTS "slack_org_settings_select" ON slack_org_settings;
CREATE POLICY "slack_org_settings_select" ON slack_org_settings FOR SELECT
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "slack_org_settings_insert" ON slack_org_settings;
CREATE POLICY "slack_org_settings_insert" ON slack_org_settings FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "slack_org_settings_update" ON slack_org_settings;
CREATE POLICY "slack_org_settings_update" ON slack_org_settings FOR UPDATE
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "slack_org_settings_delete" ON slack_org_settings;
CREATE POLICY "slack_org_settings_delete" ON slack_org_settings FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: slack_user_mappings
-- ============================================================================

DROP POLICY IF EXISTS "slack_user_mappings_select" ON slack_user_mappings;
DROP POLICY IF EXISTS "slack_user_mappings_insert" ON slack_user_mappings;
DROP POLICY IF EXISTS "slack_user_mappings_update" ON slack_user_mappings;
DROP POLICY IF EXISTS "slack_user_mappings_delete" ON slack_user_mappings;

-- Note: slack_user_mappings has sixty_user_id (not user_id) and org_id
DROP POLICY IF EXISTS "slack_user_mappings_select" ON slack_user_mappings;
CREATE POLICY "slack_user_mappings_select" ON slack_user_mappings FOR SELECT
  USING (is_service_role() OR sixty_user_id = (SELECT auth.uid()) OR org_id = get_user_org_id() OR is_admin_optimized());

DROP POLICY IF EXISTS "slack_user_mappings_insert" ON slack_user_mappings;
CREATE POLICY "slack_user_mappings_insert" ON slack_user_mappings FOR INSERT
  WITH CHECK (is_service_role() OR sixty_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "slack_user_mappings_update" ON slack_user_mappings;
CREATE POLICY "slack_user_mappings_update" ON slack_user_mappings FOR UPDATE
  USING (is_service_role() OR sixty_user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "slack_user_mappings_delete" ON slack_user_mappings;
CREATE POLICY "slack_user_mappings_delete" ON slack_user_mappings FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: solutions
-- ============================================================================

DROP POLICY IF EXISTS "solutions_select" ON solutions;
DROP POLICY IF EXISTS "solutions_insert" ON solutions;
DROP POLICY IF EXISTS "solutions_update" ON solutions;
DROP POLICY IF EXISTS "solutions_delete" ON solutions;

-- Note: solutions has no user_id - it's public content linked to challenges
DROP POLICY IF EXISTS "solutions_select" ON solutions;
CREATE POLICY "solutions_select" ON solutions FOR SELECT
  USING (true);  -- Public read access

DROP POLICY IF EXISTS "solutions_insert" ON solutions;
CREATE POLICY "solutions_insert" ON solutions FOR INSERT
  WITH CHECK (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "solutions_update" ON solutions;
CREATE POLICY "solutions_update" ON solutions FOR UPDATE
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "solutions_delete" ON solutions;
CREATE POLICY "solutions_delete" ON solutions FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: task_notifications
-- ============================================================================

DROP POLICY IF EXISTS "task_notifications_select" ON task_notifications;
DROP POLICY IF EXISTS "task_notifications_insert" ON task_notifications;
DROP POLICY IF EXISTS "task_notifications_update" ON task_notifications;
DROP POLICY IF EXISTS "task_notifications_delete" ON task_notifications;

DROP POLICY IF EXISTS "task_notifications_select" ON task_notifications;
CREATE POLICY "task_notifications_select" ON task_notifications FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "task_notifications_insert" ON task_notifications;
CREATE POLICY "task_notifications_insert" ON task_notifications FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "task_notifications_update" ON task_notifications;
CREATE POLICY "task_notifications_update" ON task_notifications FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "task_notifications_delete" ON task_notifications;
CREATE POLICY "task_notifications_delete" ON task_notifications FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

-- ============================================================================
-- TABLE: team_members
-- ============================================================================

DROP POLICY IF EXISTS "team_members_select" ON team_members;
DROP POLICY IF EXISTS "team_members_insert" ON team_members;
DROP POLICY IF EXISTS "team_members_update" ON team_members;
DROP POLICY IF EXISTS "team_members_delete" ON team_members;

DROP POLICY IF EXISTS "team_members_select" ON team_members;
CREATE POLICY "team_members_select" ON team_members FOR SELECT
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_members.team_id

    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "team_members_insert" ON team_members;
CREATE POLICY "team_members_insert" ON team_members FOR INSERT
  WITH CHECK (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "team_members_update" ON team_members;
CREATE POLICY "team_members_update" ON team_members FOR UPDATE
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "team_members_delete" ON team_members;
CREATE POLICY "team_members_delete" ON team_members FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: topic_aggregation_queue
-- ============================================================================

DROP POLICY IF EXISTS "topic_aggregation_queue_select" ON topic_aggregation_queue;
DROP POLICY IF EXISTS "topic_aggregation_queue_insert" ON topic_aggregation_queue;
DROP POLICY IF EXISTS "topic_aggregation_queue_update" ON topic_aggregation_queue;
DROP POLICY IF EXISTS "topic_aggregation_queue_delete" ON topic_aggregation_queue;

DROP POLICY IF EXISTS "topic_aggregation_queue_all" ON topic_aggregation_queue;
CREATE POLICY "topic_aggregation_queue_all" ON topic_aggregation_queue FOR ALL
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: user_ai_feature_settings
-- ============================================================================

DROP POLICY IF EXISTS "user_ai_feature_settings_select" ON user_ai_feature_settings;
DROP POLICY IF EXISTS "user_ai_feature_settings_insert" ON user_ai_feature_settings;
DROP POLICY IF EXISTS "user_ai_feature_settings_update" ON user_ai_feature_settings;
DROP POLICY IF EXISTS "user_ai_feature_settings_delete" ON user_ai_feature_settings;

DROP POLICY IF EXISTS "user_ai_feature_settings_select" ON user_ai_feature_settings;
CREATE POLICY "user_ai_feature_settings_select" ON user_ai_feature_settings FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "user_ai_feature_settings_insert" ON user_ai_feature_settings;
CREATE POLICY "user_ai_feature_settings_insert" ON user_ai_feature_settings FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_ai_feature_settings_update" ON user_ai_feature_settings;
CREATE POLICY "user_ai_feature_settings_update" ON user_ai_feature_settings FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_ai_feature_settings_delete" ON user_ai_feature_settings;
CREATE POLICY "user_ai_feature_settings_delete" ON user_ai_feature_settings FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

-- ============================================================================
-- TABLE: user_coaching_preferences
-- ============================================================================

DROP POLICY IF EXISTS "user_coaching_preferences_select" ON user_coaching_preferences;
DROP POLICY IF EXISTS "user_coaching_preferences_insert" ON user_coaching_preferences;
DROP POLICY IF EXISTS "user_coaching_preferences_update" ON user_coaching_preferences;
DROP POLICY IF EXISTS "user_coaching_preferences_delete" ON user_coaching_preferences;

DROP POLICY IF EXISTS "user_coaching_preferences_select" ON user_coaching_preferences;
CREATE POLICY "user_coaching_preferences_select" ON user_coaching_preferences FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "user_coaching_preferences_insert" ON user_coaching_preferences;
CREATE POLICY "user_coaching_preferences_insert" ON user_coaching_preferences FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_coaching_preferences_update" ON user_coaching_preferences;
CREATE POLICY "user_coaching_preferences_update" ON user_coaching_preferences FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_coaching_preferences_delete" ON user_coaching_preferences;
CREATE POLICY "user_coaching_preferences_delete" ON user_coaching_preferences FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

-- ============================================================================
-- TABLE: user_roles
-- ============================================================================

DROP POLICY IF EXISTS "user_roles_select" ON user_roles;
DROP POLICY IF EXISTS "user_roles_insert" ON user_roles;
DROP POLICY IF EXISTS "user_roles_update" ON user_roles;
DROP POLICY IF EXISTS "user_roles_delete" ON user_roles;

-- Note: user_roles has no user_id column - it's a lookup table
DROP POLICY IF EXISTS "user_roles_select" ON user_roles;
CREATE POLICY "user_roles_select" ON user_roles FOR SELECT
  USING (true);  -- Public read for role lookup

DROP POLICY IF EXISTS "user_roles_insert" ON user_roles;
CREATE POLICY "user_roles_insert" ON user_roles FOR INSERT
  WITH CHECK (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "user_roles_update" ON user_roles;
CREATE POLICY "user_roles_update" ON user_roles FOR UPDATE
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "user_roles_delete" ON user_roles;
CREATE POLICY "user_roles_delete" ON user_roles FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: user_tone_settings
-- ============================================================================

DROP POLICY IF EXISTS "user_tone_settings_select" ON user_tone_settings;
DROP POLICY IF EXISTS "user_tone_settings_insert" ON user_tone_settings;
DROP POLICY IF EXISTS "user_tone_settings_update" ON user_tone_settings;
DROP POLICY IF EXISTS "user_tone_settings_delete" ON user_tone_settings;

DROP POLICY IF EXISTS "user_tone_settings_select" ON user_tone_settings;
CREATE POLICY "user_tone_settings_select" ON user_tone_settings FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "user_tone_settings_insert" ON user_tone_settings;
CREATE POLICY "user_tone_settings_insert" ON user_tone_settings FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_tone_settings_update" ON user_tone_settings;
CREATE POLICY "user_tone_settings_update" ON user_tone_settings FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_tone_settings_delete" ON user_tone_settings;
CREATE POLICY "user_tone_settings_delete" ON user_tone_settings FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

-- ============================================================================
-- TABLE: user_writing_styles
-- ============================================================================

DROP POLICY IF EXISTS "user_writing_styles_select" ON user_writing_styles;
DROP POLICY IF EXISTS "user_writing_styles_insert" ON user_writing_styles;
DROP POLICY IF EXISTS "user_writing_styles_update" ON user_writing_styles;
DROP POLICY IF EXISTS "user_writing_styles_delete" ON user_writing_styles;

DROP POLICY IF EXISTS "user_writing_styles_select" ON user_writing_styles;
CREATE POLICY "user_writing_styles_select" ON user_writing_styles FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "user_writing_styles_insert" ON user_writing_styles;
CREATE POLICY "user_writing_styles_insert" ON user_writing_styles FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_writing_styles_update" ON user_writing_styles;
CREATE POLICY "user_writing_styles_update" ON user_writing_styles FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_writing_styles_delete" ON user_writing_styles;
CREATE POLICY "user_writing_styles_delete" ON user_writing_styles FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

-- ============================================================================
-- TABLE: waitlist_admin_actions
-- ============================================================================

DROP POLICY IF EXISTS "waitlist_admin_actions_select" ON waitlist_admin_actions;
DROP POLICY IF EXISTS "waitlist_admin_actions_insert" ON waitlist_admin_actions;
DROP POLICY IF EXISTS "waitlist_admin_actions_update" ON waitlist_admin_actions;
DROP POLICY IF EXISTS "waitlist_admin_actions_delete" ON waitlist_admin_actions;

DROP POLICY IF EXISTS "waitlist_admin_actions_all" ON waitlist_admin_actions;
CREATE POLICY "waitlist_admin_actions_all" ON waitlist_admin_actions FOR ALL
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: waitlist_email_templates
-- ============================================================================

DROP POLICY IF EXISTS "waitlist_email_templates_select" ON waitlist_email_templates;
DROP POLICY IF EXISTS "waitlist_email_templates_insert" ON waitlist_email_templates;
DROP POLICY IF EXISTS "waitlist_email_templates_update" ON waitlist_email_templates;
DROP POLICY IF EXISTS "waitlist_email_templates_delete" ON waitlist_email_templates;

DROP POLICY IF EXISTS "waitlist_email_templates_all" ON waitlist_email_templates;
CREATE POLICY "waitlist_email_templates_all" ON waitlist_email_templates FOR ALL
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: waitlist_onboarding_progress
-- ============================================================================

DROP POLICY IF EXISTS "waitlist_onboarding_progress_select" ON waitlist_onboarding_progress;
DROP POLICY IF EXISTS "waitlist_onboarding_progress_insert" ON waitlist_onboarding_progress;
DROP POLICY IF EXISTS "waitlist_onboarding_progress_update" ON waitlist_onboarding_progress;
DROP POLICY IF EXISTS "waitlist_onboarding_progress_delete" ON waitlist_onboarding_progress;

DROP POLICY IF EXISTS "waitlist_onboarding_progress_select" ON waitlist_onboarding_progress;
CREATE POLICY "waitlist_onboarding_progress_select" ON waitlist_onboarding_progress FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "waitlist_onboarding_progress_insert" ON waitlist_onboarding_progress;
CREATE POLICY "waitlist_onboarding_progress_insert" ON waitlist_onboarding_progress FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "waitlist_onboarding_progress_update" ON waitlist_onboarding_progress;
CREATE POLICY "waitlist_onboarding_progress_update" ON waitlist_onboarding_progress FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "waitlist_onboarding_progress_delete" ON waitlist_onboarding_progress;
CREATE POLICY "waitlist_onboarding_progress_delete" ON waitlist_onboarding_progress FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

-- ============================================================================
-- TABLE: webhook_mirror_config
-- ============================================================================

DROP POLICY IF EXISTS "webhook_mirror_config_select" ON webhook_mirror_config;
DROP POLICY IF EXISTS "webhook_mirror_config_insert" ON webhook_mirror_config;
DROP POLICY IF EXISTS "webhook_mirror_config_update" ON webhook_mirror_config;
DROP POLICY IF EXISTS "webhook_mirror_config_delete" ON webhook_mirror_config;
DROP POLICY IF EXISTS "webhook_mirror_config_admin_only" ON webhook_mirror_config;

DROP POLICY IF EXISTS "webhook_mirror_config_all" ON webhook_mirror_config;
CREATE POLICY "webhook_mirror_config_all" ON webhook_mirror_config FOR ALL
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: workflow_forms
-- ============================================================================

DROP POLICY IF EXISTS "workflow_forms_select" ON workflow_forms;
DROP POLICY IF EXISTS "workflow_forms_insert" ON workflow_forms;
DROP POLICY IF EXISTS "workflow_forms_update" ON workflow_forms;
DROP POLICY IF EXISTS "workflow_forms_delete" ON workflow_forms;

-- Note: workflow_forms has created_by, not user_id
DROP POLICY IF EXISTS "workflow_forms_select" ON workflow_forms;
CREATE POLICY "workflow_forms_select" ON workflow_forms FOR SELECT
  USING (is_service_role() OR created_by = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "workflow_forms_insert" ON workflow_forms;
CREATE POLICY "workflow_forms_insert" ON workflow_forms FOR INSERT
  WITH CHECK (is_service_role() OR created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "workflow_forms_update" ON workflow_forms;
CREATE POLICY "workflow_forms_update" ON workflow_forms FOR UPDATE
  USING (is_service_role() OR created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "workflow_forms_delete" ON workflow_forms;
CREATE POLICY "workflow_forms_delete" ON workflow_forms FOR DELETE
  USING (is_service_role() OR created_by = (SELECT auth.uid()));

-- ============================================================================
-- TABLE: workflow_mcp_logs
-- ============================================================================

DROP POLICY IF EXISTS "workflow_mcp_logs_select" ON workflow_mcp_logs;
DROP POLICY IF EXISTS "workflow_mcp_logs_insert" ON workflow_mcp_logs;
DROP POLICY IF EXISTS "workflow_mcp_logs_update" ON workflow_mcp_logs;
DROP POLICY IF EXISTS "workflow_mcp_logs_delete" ON workflow_mcp_logs;

DROP POLICY IF EXISTS "workflow_mcp_logs_select" ON workflow_mcp_logs;
CREATE POLICY "workflow_mcp_logs_select" ON workflow_mcp_logs FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "workflow_mcp_logs_insert" ON workflow_mcp_logs;
CREATE POLICY "workflow_mcp_logs_insert" ON workflow_mcp_logs FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "workflow_mcp_logs_update" ON workflow_mcp_logs;
CREATE POLICY "workflow_mcp_logs_update" ON workflow_mcp_logs FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "workflow_mcp_logs_delete" ON workflow_mcp_logs;
CREATE POLICY "workflow_mcp_logs_delete" ON workflow_mcp_logs FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: meeting_action_items_backup_20250106 (admin only backup table)
-- ============================================================================

DROP POLICY IF EXISTS "meeting_action_items_backup_20250106_select" ON meeting_action_items_backup_20250106;

DROP POLICY IF EXISTS "meeting_action_items_backup_20250106_all" ON meeting_action_items_backup_20250106;
CREATE POLICY "meeting_action_items_backup_20250106_all" ON meeting_action_items_backup_20250106 FOR ALL
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: tasks_backup_20250106 (admin only backup table)
-- ============================================================================

DROP POLICY IF EXISTS "tasks_backup_20250106_select" ON tasks_backup_20250106;
DROP POLICY IF EXISTS "tasks_backup_admin_only" ON tasks_backup_20250106;

DROP POLICY IF EXISTS "tasks_backup_20250106_all" ON tasks_backup_20250106;
CREATE POLICY "tasks_backup_20250106_all" ON tasks_backup_20250106 FOR ALL
  USING (is_service_role() OR is_admin_optimized());
