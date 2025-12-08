-- ============================================================================
-- FIX ALL RLS POLICIES FOR CLERK AUTHENTICATION
-- ============================================================================
-- This script updates ALL RLS policies to use current_user_id() instead of auth.uid()
-- Run this AFTER the debug-and-fix-clerk-auth.sql script
-- ============================================================================

-- TASK NOTIFICATIONS (already fixed, skipping)
-- Policies already created with current_user_id()

-- PROFILES
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Allow authenticated users to read profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (id = current_user_id() OR is_admin());

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (id = current_user_id() OR is_admin());

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (id = current_user_id());

-- Allow admins to see all profiles for user selection dropdowns
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (is_admin());

-- USER SETTINGS
DROP POLICY IF EXISTS "Users can manage own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can view their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON user_settings;

CREATE POLICY "Users can view their own settings" ON user_settings
  FOR SELECT USING (user_id = current_user_id());

CREATE POLICY "Users can insert their own settings" ON user_settings
  FOR INSERT WITH CHECK (user_id = current_user_id());

CREATE POLICY "Users can update their own settings" ON user_settings
  FOR UPDATE USING (user_id = current_user_id());

-- ORGANIZATIONS
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Org admins can update their organization" ON organizations;

CREATE POLICY "Users can view their organizations" ON organizations
  FOR SELECT USING (
    id IN (SELECT org_id FROM organization_memberships WHERE user_id = current_user_id())
    OR is_admin()
  );

CREATE POLICY "Users can create organizations" ON organizations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Org admins can update their organization" ON organizations
  FOR UPDATE USING (
    id IN (
      SELECT org_id FROM organization_memberships
      WHERE user_id = current_user_id()
      AND role IN ('owner', 'admin')
    )
  );

-- ORGANIZATION MEMBERSHIPS
DROP POLICY IF EXISTS "Users can view their own memberships" ON organization_memberships;
DROP POLICY IF EXISTS "Users can view memberships in their orgs" ON organization_memberships;
DROP POLICY IF EXISTS "Org owners can manage memberships" ON organization_memberships;

CREATE POLICY "Users can view memberships in their orgs" ON organization_memberships
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM organization_memberships WHERE user_id = current_user_id())
    OR user_id = current_user_id()
    OR is_admin()
  );

CREATE POLICY "Org owners can manage memberships" ON organization_memberships
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM organization_memberships
      WHERE user_id = current_user_id()
      AND role IN ('owner', 'admin')
    )
    OR is_admin()
  );

-- USER NOTIFICATIONS
DROP POLICY IF EXISTS "Users can view their own notifications" ON user_notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON user_notifications;
DROP POLICY IF EXISTS "Users can manage their own notifications" ON user_notifications;

CREATE POLICY "Users can view their own notifications" ON user_notifications
  FOR SELECT USING (user_id = current_user_id());

CREATE POLICY "Users can manage their own notifications" ON user_notifications
  FOR ALL USING (user_id = current_user_id());

-- NOTIFICATIONS TABLE
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can manage their own notifications" ON notifications;
DROP POLICY IF EXISTS "Enable read access for own notifications" ON notifications;
DROP POLICY IF EXISTS "Enable update access for own notifications" ON notifications;

CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (user_id = current_user_id());

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (user_id = current_user_id());

-- AI INSIGHTS
DROP POLICY IF EXISTS "Users can view their own insights" ON ai_insights;
DROP POLICY IF EXISTS "Users can update their own insights" ON ai_insights;
DROP POLICY IF EXISTS "Users can delete their own insights" ON ai_insights;
DROP POLICY IF EXISTS "Users can insert their own insights" ON ai_insights;

CREATE POLICY "Users can view their own insights" ON ai_insights
  FOR SELECT USING (user_id = current_user_id() OR is_admin());

CREATE POLICY "Users can insert their own insights" ON ai_insights
  FOR INSERT WITH CHECK (user_id = current_user_id());

CREATE POLICY "Users can update their own insights" ON ai_insights
  FOR UPDATE USING (user_id = current_user_id());

CREATE POLICY "Users can delete their own insights" ON ai_insights
  FOR DELETE USING (user_id = current_user_id());

-- USER AI FEATURE SETTINGS
DROP POLICY IF EXISTS "Users can manage their own AI settings" ON user_ai_feature_settings;
DROP POLICY IF EXISTS "Users can view their own AI settings" ON user_ai_feature_settings;

CREATE POLICY "Users can view their own AI settings" ON user_ai_feature_settings
  FOR SELECT USING (user_id = current_user_id());

CREATE POLICY "Users can manage their own AI settings" ON user_ai_feature_settings
  FOR ALL USING (user_id = current_user_id());

-- USER COACHING PREFERENCES
DROP POLICY IF EXISTS "Users can manage their own coaching preferences" ON user_coaching_preferences;

CREATE POLICY "Users can manage their own coaching preferences" ON user_coaching_preferences
  FOR ALL USING (user_id = current_user_id());

-- USER TONE SETTINGS
DROP POLICY IF EXISTS "Users can manage their own tone settings" ON user_tone_settings;

CREATE POLICY "Users can manage their own tone settings" ON user_tone_settings
  FOR ALL USING (user_id = current_user_id());

-- USER WRITING STYLES
DROP POLICY IF EXISTS "Users can manage their own writing styles" ON user_writing_styles;

CREATE POLICY "Users can manage their own writing styles" ON user_writing_styles
  FOR ALL USING (user_id = current_user_id());

-- USER SYNC STATUS
DROP POLICY IF EXISTS "Users can view their own sync status" ON user_sync_status;
DROP POLICY IF EXISTS "Users can manage their own sync status" ON user_sync_status;

CREATE POLICY "Users can manage their own sync status" ON user_sync_status
  FOR ALL USING (user_id = current_user_id());

-- USER ONBOARDING PROGRESS
DROP POLICY IF EXISTS "Users can manage their own onboarding progress" ON user_onboarding_progress;

CREATE POLICY "Users can manage their own onboarding progress" ON user_onboarding_progress
  FOR ALL USING (user_id = current_user_id());

-- USER FILE SEARCH STORES
DROP POLICY IF EXISTS "Users can manage their own file search stores" ON user_file_search_stores;

CREATE POLICY "Users can manage their own file search stores" ON user_file_search_stores
  FOR ALL USING (user_id = current_user_id());

-- GOOGLE INTEGRATIONS
DROP POLICY IF EXISTS "Users can manage their own Google integrations" ON google_integrations;
DROP POLICY IF EXISTS "Users can view their own google integrations" ON google_integrations;

CREATE POLICY "Users can manage their own Google integrations" ON google_integrations
  FOR ALL USING (user_id = current_user_id());

-- FATHOM INTEGRATIONS
DROP POLICY IF EXISTS "Users can manage their own Fathom integrations" ON fathom_integrations;
DROP POLICY IF EXISTS "Users can view their own fathom integrations" ON fathom_integrations;

CREATE POLICY "Users can manage their own Fathom integrations" ON fathom_integrations
  FOR ALL USING (user_id = current_user_id());

-- SLACK INTEGRATIONS
DROP POLICY IF EXISTS "Users can manage their own Slack integrations" ON slack_integrations;

CREATE POLICY "Users can manage their own Slack integrations" ON slack_integrations
  FOR ALL USING (user_id = current_user_id());

-- WORKFLOW EXECUTIONS
DROP POLICY IF EXISTS "Users can view their own workflow executions" ON workflow_executions;
DROP POLICY IF EXISTS "Users can manage their own workflow executions" ON workflow_executions;

CREATE POLICY "Users can manage their own workflow executions" ON workflow_executions
  FOR ALL USING (user_id = current_user_id() OR is_admin());

-- USER AUTOMATION RULES
DROP POLICY IF EXISTS "Users can manage their own automation rules" ON user_automation_rules;

CREATE POLICY "Users can manage their own automation rules" ON user_automation_rules
  FOR ALL USING (user_id = current_user_id());

-- MEETING INDEX QUEUE
DROP POLICY IF EXISTS "Users can manage their own meeting index queue" ON meeting_index_queue;
DROP POLICY IF EXISTS "Users can view their meeting index queue" ON meeting_index_queue;

CREATE POLICY "Users can manage their own meeting index queue" ON meeting_index_queue
  FOR ALL USING (user_id = current_user_id() OR is_admin());

-- MEETING ACTION ITEMS
DROP POLICY IF EXISTS "Users can view action items for their meetings" ON meeting_action_items;
DROP POLICY IF EXISTS "Users can manage their meeting action items" ON meeting_action_items;

CREATE POLICY "Users can manage their meeting action items" ON meeting_action_items
  FOR ALL USING (
    meeting_id IN (SELECT id FROM meetings WHERE owner_user_id = current_user_id())
    OR is_admin()
  );

-- MEETING TOPICS
DROP POLICY IF EXISTS "Users can view topics for their meetings" ON meeting_topics;
DROP POLICY IF EXISTS "Users can manage their meeting topics" ON meeting_topics;

CREATE POLICY "Users can manage their meeting topics" ON meeting_topics
  FOR ALL USING (
    meeting_id IN (SELECT id FROM meetings WHERE owner_user_id = current_user_id())
    OR is_admin()
  );

-- MEETING METRICS
DROP POLICY IF EXISTS "Users can view metrics for their meetings" ON meeting_metrics;
DROP POLICY IF EXISTS "Users can manage their meeting metrics" ON meeting_metrics;

CREATE POLICY "Users can manage their meeting metrics" ON meeting_metrics
  FOR ALL USING (
    meeting_id IN (SELECT id FROM meetings WHERE owner_user_id = current_user_id())
    OR is_admin()
  );

-- MEETING ATTENDEES
DROP POLICY IF EXISTS "Users can view attendees for their meetings" ON meeting_attendees;
DROP POLICY IF EXISTS "Users can manage their meeting attendees" ON meeting_attendees;

CREATE POLICY "Users can manage their meeting attendees" ON meeting_attendees
  FOR ALL USING (
    meeting_id IN (SELECT id FROM meetings WHERE owner_user_id = current_user_id())
    OR is_admin()
  );

-- SENTIMENT ALERTS
DROP POLICY IF EXISTS "Users can manage their own sentiment alerts" ON sentiment_alerts;

CREATE POLICY "Users can manage their own sentiment alerts" ON sentiment_alerts
  FOR ALL USING (user_id = current_user_id());

-- EMAILS TABLE
DROP POLICY IF EXISTS "Users can manage their own emails" ON emails;
DROP POLICY IF EXISTS "Users can view their own emails" ON emails;

CREATE POLICY "Users can manage their own emails" ON emails
  FOR ALL USING (user_id = current_user_id());

-- SCHEDULED EMAILS (table may not exist)
-- DROP POLICY IF EXISTS "Users can manage their own scheduled emails" ON scheduled_emails;
-- CREATE POLICY "Users can manage their own scheduled emails" ON scheduled_emails
--   FOR ALL USING (user_id = current_user_id());

-- SALES TEMPLATES (table may not exist)
-- DROP POLICY IF EXISTS "Users can manage their own sales templates" ON sales_templates;
-- CREATE POLICY "Users can manage their own sales templates" ON sales_templates
--   FOR ALL USING (user_id = current_user_id() OR is_admin());

-- PROPOSAL TEMPLATES (may not exist or have different schema)
-- DROP POLICY IF EXISTS "Users can manage their own proposal templates" ON proposal_templates;
-- CREATE POLICY "Users can manage their own proposal templates" ON proposal_templates
--   FOR ALL USING (user_id = current_user_id() OR is_admin());

-- PROPOSAL JOBS (may not exist)
-- DROP POLICY IF EXISTS "Users can manage their own proposal jobs" ON proposal_jobs;
-- CREATE POLICY "Users can manage their own proposal jobs" ON proposal_jobs
--   FOR ALL USING (user_id = current_user_id());

-- ROADMAP SUGGESTIONS (may not exist)
-- DROP POLICY IF EXISTS "Users can manage their own roadmap suggestions" ON roadmap_suggestions;
-- CREATE POLICY "Users can manage their own roadmap suggestions" ON roadmap_suggestions
--   FOR ALL USING (user_id = current_user_id() OR is_admin());

-- LEADS (may not exist)
-- DROP POLICY IF EXISTS "Users can manage their own leads" ON leads;
-- CREATE POLICY "Users can manage their own leads" ON leads
--   FOR ALL USING (owner_id = current_user_id() OR is_admin());

-- NEXT ACTION SUGGESTIONS (may not exist)
-- DROP POLICY IF EXISTS "Users can manage their own suggestions" ON next_action_suggestions;
-- CREATE POLICY "Users can manage their own suggestions" ON next_action_suggestions
--   FOR ALL USING (user_id = current_user_id());

-- RELATIONSHIP HEALTH SCORES (may not exist)
-- DROP POLICY IF EXISTS "Users can manage their own health scores" ON relationship_health_scores;
-- CREATE POLICY "Users can manage their own health scores" ON relationship_health_scores
--   FOR ALL USING (user_id = current_user_id());

-- INTERVENTIONS (may not exist)
-- DROP POLICY IF EXISTS "Users can manage their own interventions" ON interventions;
-- CREATE POLICY "Users can manage their own interventions" ON interventions
--   FOR ALL USING (user_id = current_user_id());

-- ACTION ITEMS
DROP POLICY IF EXISTS "Users can view action items they own or are assigned to" ON action_items;
DROP POLICY IF EXISTS "Users can update action items they own or are assigned to" ON action_items;
DROP POLICY IF EXISTS "Users can delete action items they own" ON action_items;
DROP POLICY IF EXISTS "Users can insert action items" ON action_items;

CREATE POLICY "Users can view action items" ON action_items
  FOR SELECT USING (
    user_id = current_user_id()
    OR assignee_id = current_user_id()
    OR is_admin()
  );

CREATE POLICY "Users can insert action items" ON action_items
  FOR INSERT WITH CHECK (user_id = current_user_id());

CREATE POLICY "Users can update action items" ON action_items
  FOR UPDATE USING (
    user_id = current_user_id()
    OR assignee_id = current_user_id()
    OR is_admin()
  );

CREATE POLICY "Users can delete action items" ON action_items
  FOR DELETE USING (user_id = current_user_id() OR is_admin());

-- SMART TASK TEMPLATES (Admin only)
DROP POLICY IF EXISTS "Admins can manage smart task templates" ON smart_task_templates;

CREATE POLICY "Admins can manage smart task templates" ON smart_task_templates
  FOR ALL USING (is_admin());

CREATE POLICY "Users can view smart task templates" ON smart_task_templates
  FOR SELECT USING (true);

-- DEAL ACTIVITIES
DROP POLICY IF EXISTS "Users can view their deal activities" ON deal_activities;
DROP POLICY IF EXISTS "Users can insert deal activities" ON deal_activities;
DROP POLICY IF EXISTS "Users can update deal activities" ON deal_activities;
DROP POLICY IF EXISTS "Users can delete deal activities" ON deal_activities;

CREATE POLICY "Users can view their deal activities" ON deal_activities
  FOR SELECT USING (
    user_id = current_user_id()
    OR deal_id IN (SELECT id FROM deals WHERE owner_id = current_user_id())
    OR is_admin()
  );

CREATE POLICY "Users can insert deal activities" ON deal_activities
  FOR INSERT WITH CHECK (user_id = current_user_id());

CREATE POLICY "Users can update deal activities" ON deal_activities
  FOR UPDATE USING (user_id = current_user_id() OR is_admin());

CREATE POLICY "Users can delete deal activities" ON deal_activities
  FOR DELETE USING (user_id = current_user_id() OR is_admin());

-- DEAL SPLITS
DROP POLICY IF EXISTS "Users can view relevant deal splits" ON deal_splits;
DROP POLICY IF EXISTS "Users can insert deal splits" ON deal_splits;
DROP POLICY IF EXISTS "Users can update deal splits" ON deal_splits;
DROP POLICY IF EXISTS "Only admins can delete deal splits" ON deal_splits;

CREATE POLICY "Users can view relevant deal splits" ON deal_splits
  FOR SELECT USING (
    user_id = current_user_id()
    OR deal_id IN (SELECT id FROM deals WHERE owner_id = current_user_id())
    OR is_admin()
  );

CREATE POLICY "Admins can manage deal splits" ON deal_splits
  FOR ALL USING (is_admin());

-- DEAL STAGE HISTORY
DROP POLICY IF EXISTS "Users can view their deal stage history" ON deal_stage_history;

CREATE POLICY "Users can view their deal stage history" ON deal_stage_history
  FOR SELECT USING (
    deal_id IN (SELECT id FROM deals WHERE owner_id = current_user_id())
    OR is_admin()
  );

-- DEAL HEALTH SCORES
DROP POLICY IF EXISTS "Users can view their own deal health scores" ON deal_health_scores;
DROP POLICY IF EXISTS "Users can update their own deal health scores" ON deal_health_scores;

CREATE POLICY "Users can manage their deal health scores" ON deal_health_scores
  FOR ALL USING (user_id = current_user_id() OR is_admin());

-- DEAL HEALTH ALERTS
DROP POLICY IF EXISTS "Users can view their own deal alerts" ON deal_health_alerts;
DROP POLICY IF EXISTS "Users can update their own deal alerts" ON deal_health_alerts;

CREATE POLICY "Users can manage their deal alerts" ON deal_health_alerts
  FOR ALL USING (user_id = current_user_id() OR is_admin());

-- DEAL HEALTH HISTORY
DROP POLICY IF EXISTS "Users can view health history for their deals" ON deal_health_history;

CREATE POLICY "Users can view health history for their deals" ON deal_health_history
  FOR SELECT USING (
    deal_id IN (SELECT id FROM deals WHERE owner_id = current_user_id())
    OR is_admin()
  );

-- DEAL NOTES
DROP POLICY IF EXISTS "Users can view deal notes they have access to" ON deal_notes;
DROP POLICY IF EXISTS "Users can insert deal notes" ON deal_notes;
DROP POLICY IF EXISTS "Users can update their own deal notes" ON deal_notes;
DROP POLICY IF EXISTS "Users can delete their own deal notes" ON deal_notes;

CREATE POLICY "Users can view deal notes" ON deal_notes
  FOR SELECT USING (
    deal_id IN (SELECT id FROM deals WHERE owner_id = current_user_id())
    OR is_admin()
  );

CREATE POLICY "Users can insert deal notes" ON deal_notes
  FOR INSERT WITH CHECK (
    deal_id IN (SELECT id FROM deals WHERE owner_id = current_user_id())
    OR is_admin()
  );

CREATE POLICY "Users can update their own deal notes" ON deal_notes
  FOR UPDATE USING (created_by = current_user_id() OR is_admin());

CREATE POLICY "Users can delete their own deal notes" ON deal_notes
  FOR DELETE USING (created_by = current_user_id() OR is_admin());

-- CONTACT NOTES
DROP POLICY IF EXISTS "Users can view contact notes they have access to" ON contact_notes;
DROP POLICY IF EXISTS "Users can insert contact notes" ON contact_notes;
DROP POLICY IF EXISTS "Users can update their own contact notes" ON contact_notes;
DROP POLICY IF EXISTS "Users can delete their own contact notes" ON contact_notes;

CREATE POLICY "Users can view contact notes" ON contact_notes
  FOR SELECT USING (
    contact_id IN (SELECT id FROM contacts WHERE owner_id = current_user_id())
    OR is_admin()
  );

CREATE POLICY "Users can insert contact notes" ON contact_notes
  FOR INSERT WITH CHECK (
    contact_id IN (SELECT id FROM contacts WHERE owner_id = current_user_id())
    OR is_admin()
  );

CREATE POLICY "Users can update their own contact notes" ON contact_notes
  FOR UPDATE USING (created_by = current_user_id() OR is_admin());

CREATE POLICY "Users can delete their own contact notes" ON contact_notes
  FOR DELETE USING (created_by = current_user_id() OR is_admin());

-- COMPANY NOTES (table may not exist)
-- DROP POLICY IF EXISTS "Users can view company notes they have access to" ON company_notes;
-- DROP POLICY IF EXISTS "Users can manage their company notes" ON company_notes;
-- CREATE POLICY "Users can manage their company notes" ON company_notes
--   FOR ALL USING (
--     company_id IN (SELECT id FROM companies WHERE owner_id = current_user_id())
--     OR is_admin()
--   );

-- API KEYS
DROP POLICY IF EXISTS "Users can view own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can insert own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can update own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can delete own API keys" ON api_keys;
DROP POLICY IF EXISTS "Admins can view all API keys" ON api_keys;

CREATE POLICY "Users can manage own API keys" ON api_keys
  FOR ALL USING (user_id = current_user_id());

CREATE POLICY "Admins can view all API keys" ON api_keys
  FOR SELECT USING (is_admin());

-- API KEY USAGE
DROP POLICY IF EXISTS "Users can view their own usage" ON api_key_usage;

CREATE POLICY "Users can view their own usage" ON api_key_usage
  FOR SELECT USING (
    api_key_id IN (SELECT id FROM api_keys WHERE user_id = current_user_id())
    OR is_admin()
  );

-- API REQUESTS
DROP POLICY IF EXISTS "Users can view their own API requests" ON api_requests;

CREATE POLICY "Users can view their own API requests" ON api_requests
  FOR SELECT USING (
    api_key_id IN (SELECT id FROM api_keys WHERE user_id = current_user_id())
    OR is_admin()
  );

-- COPILOT TABLES
DROP POLICY IF EXISTS "Users can view their own conversations" ON copilot_conversations;
DROP POLICY IF EXISTS "Users can manage their own conversations" ON copilot_conversations;

CREATE POLICY "Users can manage their own conversations" ON copilot_conversations
  FOR ALL USING (user_id = current_user_id());

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON copilot_messages;

CREATE POLICY "Users can view messages in their conversations" ON copilot_messages
  FOR SELECT USING (
    conversation_id IN (SELECT id FROM copilot_conversations WHERE user_id = current_user_id())
  );

DROP POLICY IF EXISTS "Users can view their own analytics" ON copilot_analytics;

CREATE POLICY "Users can view their own analytics" ON copilot_analytics
  FOR SELECT USING (user_id = current_user_id());

-- CRON JOB LOGS
DROP POLICY IF EXISTS "Users can view own cron logs" ON cron_job_logs;

CREATE POLICY "Users can view own cron logs" ON cron_job_logs
  FOR SELECT USING (user_id = current_user_id() OR is_admin());

-- CSV MAPPING TEMPLATES
DROP POLICY IF EXISTS "Users can view their own templates" ON csv_mapping_templates;
DROP POLICY IF EXISTS "Users can manage their own templates" ON csv_mapping_templates;

CREATE POLICY "Users can manage their own templates" ON csv_mapping_templates
  FOR ALL USING (user_id = current_user_id());

-- AUDIT LOGS (Admin only)
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;

CREATE POLICY "Admins can view all audit logs" ON audit_logs
  FOR SELECT USING (is_admin());

-- IMPERSONATION LOGS (Admin only)
DROP POLICY IF EXISTS "Admins can view impersonation logs" ON impersonation_logs;

CREATE POLICY "Admins can view impersonation logs" ON impersonation_logs
  FOR ALL USING (is_admin());

-- EXTRACTION RULES (table may not exist)
-- DROP POLICY IF EXISTS "extraction_rules_select_own" ON extraction_rules;
-- DROP POLICY IF EXISTS "Users can manage their extraction rules" ON extraction_rules;
-- CREATE POLICY "Users can manage their extraction rules" ON extraction_rules
--   FOR ALL USING (user_id = current_user_id() OR is_admin());

SELECT 'All RLS policies updated for Clerk authentication!' as status;
