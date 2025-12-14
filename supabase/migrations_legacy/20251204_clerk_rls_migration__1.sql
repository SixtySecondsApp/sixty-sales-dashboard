-- ============================================================================
-- CLERK RLS MIGRATION
-- ============================================================================
-- This migration updates all RLS policies to use current_user_id() instead of
-- auth.uid() to support Clerk authentication.
--
-- current_user_id() function handles both:
-- 1. Supabase native auth (via auth.uid())
-- 2. Clerk JWT auth (via clerk_user_mapping table lookup)
-- ============================================================================

-- First, ensure current_user_id() function exists and is correct
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
DECLARE
  v_supabase_id UUID;
  v_clerk_id TEXT;
  v_mapped_id UUID;
BEGIN
  -- Try Supabase native auth first (fastest path for existing users)
  v_supabase_id := auth.uid();
  IF v_supabase_id IS NOT NULL THEN
    RETURN v_supabase_id;
  END IF;

  -- Fall back to Clerk JWT 'sub' claim
  v_clerk_id := auth.jwt()->>'sub';
  IF v_clerk_id IS NOT NULL THEN
    -- Look up the mapped Supabase UUID
    SELECT supabase_user_id INTO v_mapped_id
    FROM clerk_user_mapping
    WHERE clerk_user_id = v_clerk_id;

    IF v_mapped_id IS NOT NULL THEN
      RETURN v_mapped_id;
    END IF;

    RETURN NULL;
  END IF;

  RETURN NULL;
END;
$function$;

-- Also update is_admin() function to use current_user_id()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = current_user_id()
    AND is_admin = true
  );
END;
$function$;

-- ============================================================================
-- TASK NOTIFICATIONS
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own notifications" ON task_notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON task_notifications;

CREATE POLICY "Users can view their own notifications" ON task_notifications
  FOR SELECT USING (current_user_id() = user_id);

CREATE POLICY "Users can update their own notifications" ON task_notifications
  FOR UPDATE USING (current_user_id() = user_id);

-- ============================================================================
-- ACTION ITEMS
-- ============================================================================
DROP POLICY IF EXISTS "Users can delete action items they own" ON action_items;
DROP POLICY IF EXISTS "Users can update action items they own or are assigned to" ON action_items;
DROP POLICY IF EXISTS "Users can view action items they own or are assigned to" ON action_items;

CREATE POLICY "Users can delete action items they own" ON action_items
  FOR DELETE USING (current_user_id() = user_id);

CREATE POLICY "Users can update action items they own or are assigned to" ON action_items
  FOR UPDATE USING (
    (current_user_id() = user_id) OR (current_user_id() = assignee_id)
  );

CREATE POLICY "Users can view action items they own or are assigned to" ON action_items
  FOR SELECT USING (
    (current_user_id() = user_id) OR
    (current_user_id() = assignee_id) OR
    (EXISTS (SELECT 1 FROM contacts WHERE contacts.id = action_items.contact_id AND contacts.owner_id = current_user_id())) OR
    (EXISTS (SELECT 1 FROM deals WHERE deals.id = action_items.deal_id AND deals.owner_id = current_user_id()))
  );

-- ============================================================================
-- ACTIVITIES
-- ============================================================================
DROP POLICY IF EXISTS "Enable activity access" ON activities;
DROP POLICY IF EXISTS "Enable delete access for own activities" ON activities;
DROP POLICY IF EXISTS "Enable update access for own activities" ON activities;
DROP POLICY IF EXISTS "Users can delete own activities" ON activities;
DROP POLICY IF EXISTS "Users can delete their own activities" ON activities;
DROP POLICY IF EXISTS "Users can read own activities" ON activities;
DROP POLICY IF EXISTS "Users can update own activities" ON activities;
DROP POLICY IF EXISTS "Users can update their own activities" ON activities;
DROP POLICY IF EXISTS "Users can view their own activities" ON activities;
DROP POLICY IF EXISTS "activities_full_access" ON activities;

CREATE POLICY "Users can view their own activities" ON activities
  FOR SELECT USING ((user_id = current_user_id()) OR is_admin());

CREATE POLICY "Users can update their own activities" ON activities
  FOR UPDATE USING ((user_id = current_user_id()) OR is_admin());

CREATE POLICY "Users can delete their own activities" ON activities
  FOR DELETE USING ((user_id = current_user_id()) OR is_admin());

-- ============================================================================
-- ACTIVITY SYNC RULES
-- ============================================================================
DROP POLICY IF EXISTS "Users can manage their own sync rules" ON activity_sync_rules;
DROP POLICY IF EXISTS "Users can view their own sync rules" ON activity_sync_rules;

CREATE POLICY "Users can view their own sync rules" ON activity_sync_rules
  FOR SELECT USING (owner_id = current_user_id());

CREATE POLICY "Users can manage their own sync rules" ON activity_sync_rules
  FOR ALL USING (owner_id = current_user_id());

-- ============================================================================
-- AI INSIGHTS
-- ============================================================================
DROP POLICY IF EXISTS "Users can delete their own insights" ON ai_insights;
DROP POLICY IF EXISTS "Users can update their own insights" ON ai_insights;
DROP POLICY IF EXISTS "Users can view their own insights" ON ai_insights;

CREATE POLICY "Users can view their own insights" ON ai_insights
  FOR SELECT USING (current_user_id() = user_id);

CREATE POLICY "Users can update their own insights" ON ai_insights
  FOR UPDATE USING (current_user_id() = user_id);

CREATE POLICY "Users can delete their own insights" ON ai_insights
  FOR DELETE USING (current_user_id() = user_id);

-- ============================================================================
-- API KEYS
-- ============================================================================
DROP POLICY IF EXISTS "Admins can view all API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can delete own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can delete their own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can update own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can update their own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can view own API keys" ON api_keys;

CREATE POLICY "Users can view own API keys" ON api_keys
  FOR SELECT USING (current_user_id() = user_id);

CREATE POLICY "Users can update own API keys" ON api_keys
  FOR UPDATE USING (current_user_id() = user_id);

CREATE POLICY "Users can delete own API keys" ON api_keys
  FOR DELETE USING (current_user_id() = user_id);

CREATE POLICY "Admins can view all API keys" ON api_keys
  FOR SELECT USING (is_admin());

-- ============================================================================
-- API KEY USAGE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own usage" ON api_key_usage;

CREATE POLICY "Users can view their own usage" ON api_key_usage
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM api_keys WHERE api_keys.id = api_key_usage.api_key_id AND api_keys.user_id = current_user_id())
  );

-- ============================================================================
-- API REQUESTS
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own API requests" ON api_requests;

CREATE POLICY "Users can view their own API requests" ON api_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM api_keys WHERE api_keys.id = api_requests.api_key_id AND api_keys.user_id = current_user_id())
  );

-- ============================================================================
-- APP SETTINGS
-- ============================================================================
DROP POLICY IF EXISTS "app_settings_admin_delete" ON app_settings;
DROP POLICY IF EXISTS "app_settings_admin_update" ON app_settings;

CREATE POLICY "app_settings_admin_delete" ON app_settings
  FOR DELETE USING (is_admin());

CREATE POLICY "app_settings_admin_update" ON app_settings
  FOR UPDATE USING (is_admin());

-- ============================================================================
-- AUDIT LOGS
-- ============================================================================
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;

CREATE POLICY "Admins can view all audit logs" ON audit_logs
  FOR SELECT USING (is_admin());

-- ============================================================================
-- BRANDING SETTINGS
-- ============================================================================
DROP POLICY IF EXISTS "Org admins can delete branding settings" ON branding_settings;
DROP POLICY IF EXISTS "Org admins can update branding settings" ON branding_settings;
DROP POLICY IF EXISTS "Super admins full access to global branding" ON branding_settings;

CREATE POLICY "Org admins can update branding settings" ON branding_settings
  FOR UPDATE USING (
    (org_id IS NOT NULL) AND
    (EXISTS (SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = branding_settings.org_id
      AND organization_memberships.user_id = current_user_id()
      AND organization_memberships.role = ANY (ARRAY['owner'::text, 'admin'::text])))
  );

CREATE POLICY "Org admins can delete branding settings" ON branding_settings
  FOR DELETE USING (
    (org_id IS NOT NULL) AND
    (EXISTS (SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = branding_settings.org_id
      AND organization_memberships.user_id = current_user_id()
      AND organization_memberships.role = ANY (ARRAY['owner'::text, 'admin'::text])))
  );

CREATE POLICY "Super admins full access to global branding" ON branding_settings
  FOR ALL USING ((org_id IS NULL) AND is_admin());

-- ============================================================================
-- CALENDAR TABLES
-- ============================================================================
DROP POLICY IF EXISTS "Users can manage attendees for their events" ON calendar_attendees;
DROP POLICY IF EXISTS "Users can manage their own calendars" ON calendar_calendars;
DROP POLICY IF EXISTS "Users can manage their own calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Users can manage reminders for their events" ON calendar_reminders;
DROP POLICY IF EXISTS "Users can view their own sync logs" ON calendar_sync_logs;

CREATE POLICY "Users can manage their own calendars" ON calendar_calendars
  FOR ALL USING (current_user_id() = user_id);

CREATE POLICY "Users can manage their own calendar events" ON calendar_events
  FOR ALL USING (current_user_id() = user_id);

CREATE POLICY "Users can manage attendees for their events" ON calendar_attendees
  FOR ALL USING (
    EXISTS (SELECT 1 FROM calendar_events WHERE calendar_events.id = calendar_attendees.event_id AND calendar_events.user_id = current_user_id())
  );

CREATE POLICY "Users can manage reminders for their events" ON calendar_reminders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM calendar_events WHERE calendar_events.id = calendar_reminders.event_id AND calendar_events.user_id = current_user_id())
  );

CREATE POLICY "Users can view their own sync logs" ON calendar_sync_logs
  FOR SELECT USING (current_user_id() = user_id);

-- ============================================================================
-- CLERK SYNC LOG
-- ============================================================================
DROP POLICY IF EXISTS "clerk_sync_log_admin_only" ON clerk_sync_log;

CREATE POLICY "clerk_sync_log_admin_only" ON clerk_sync_log
  FOR ALL USING (is_admin());

-- ============================================================================
-- CLIENTS
-- ============================================================================
DROP POLICY IF EXISTS "Admins can view all clients" ON clients;
DROP POLICY IF EXISTS "Users can delete their own clients" ON clients;
DROP POLICY IF EXISTS "Users can update their own clients" ON clients;
DROP POLICY IF EXISTS "Users can view their own clients" ON clients;

CREATE POLICY "Users can view their own clients" ON clients
  FOR SELECT USING (owner_id = current_user_id());

CREATE POLICY "Users can update their own clients" ON clients
  FOR UPDATE USING (owner_id = current_user_id());

CREATE POLICY "Users can delete their own clients" ON clients
  FOR DELETE USING (owner_id = current_user_id());

CREATE POLICY "Admins can view all clients" ON clients
  FOR SELECT USING (is_admin());

-- ============================================================================
-- COMMUNICATION EVENTS
-- ============================================================================
DROP POLICY IF EXISTS "Users can delete own communication events" ON communication_events;
DROP POLICY IF EXISTS "Users can update own communication events" ON communication_events;
DROP POLICY IF EXISTS "Users can view own communication events" ON communication_events;

CREATE POLICY "Users can view own communication events" ON communication_events
  FOR SELECT USING (current_user_id() = user_id);

CREATE POLICY "Users can update own communication events" ON communication_events
  FOR UPDATE USING (current_user_id() = user_id);

CREATE POLICY "Users can delete own communication events" ON communication_events
  FOR DELETE USING (current_user_id() = user_id);

-- ============================================================================
-- COMPANIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can delete their own companies" ON companies;
DROP POLICY IF EXISTS "Users can update their own companies" ON companies;
DROP POLICY IF EXISTS "Users can view their own companies" ON companies;
DROP POLICY IF EXISTS "companies_delete_policy" ON companies;
DROP POLICY IF EXISTS "companies_full_access" ON companies;
DROP POLICY IF EXISTS "companies_select_policy" ON companies;
DROP POLICY IF EXISTS "companies_update_policy" ON companies;

CREATE POLICY "Users can view their own companies" ON companies
  FOR SELECT USING ((current_user_id() = owner_id) OR is_admin());

CREATE POLICY "Users can update their own companies" ON companies
  FOR UPDATE USING ((current_user_id() = owner_id) OR is_admin());

CREATE POLICY "Users can delete their own companies" ON companies
  FOR DELETE USING ((current_user_id() = owner_id) OR is_admin());

-- ============================================================================
-- COMPANY MEETING INSIGHTS
-- ============================================================================
DROP POLICY IF EXISTS "company_meeting_insights_own_data" ON company_meeting_insights;

CREATE POLICY "company_meeting_insights_own_data" ON company_meeting_insights
  FOR ALL USING (
    (EXISTS (SELECT 1 FROM companies co WHERE co.id = company_meeting_insights.company_id AND co.owner_id = current_user_id()))
    OR is_admin()
  );

-- ============================================================================
-- CONTACT MEETING INSIGHTS
-- ============================================================================
DROP POLICY IF EXISTS "contact_meeting_insights_own_data" ON contact_meeting_insights;

CREATE POLICY "contact_meeting_insights_own_data" ON contact_meeting_insights
  FOR ALL USING (
    (EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_meeting_insights.contact_id AND c.owner_id = current_user_id()))
    OR is_admin()
  );

-- ============================================================================
-- CONTACT NOTES
-- ============================================================================
DROP POLICY IF EXISTS "Users can delete their own contact notes" ON contact_notes;
DROP POLICY IF EXISTS "Users can update their own contact notes" ON contact_notes;
DROP POLICY IF EXISTS "Users can view contact notes they have access to" ON contact_notes;

CREATE POLICY "Users can view contact notes they have access to" ON contact_notes
  FOR SELECT USING (
    contact_id IN (SELECT contacts.id FROM contacts WHERE contacts.owner_id = current_user_id())
  );

CREATE POLICY "Users can update their own contact notes" ON contact_notes
  FOR UPDATE USING (
    (created_by = current_user_id()) AND
    (contact_id IN (SELECT contacts.id FROM contacts WHERE contacts.owner_id = current_user_id()))
  );

CREATE POLICY "Users can delete their own contact notes" ON contact_notes
  FOR DELETE USING (
    (created_by = current_user_id()) AND
    (contact_id IN (SELECT contacts.id FROM contacts WHERE contacts.owner_id = current_user_id()))
  );

-- ============================================================================
-- CONTACTS
-- ============================================================================
DROP POLICY IF EXISTS "Users can delete their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can view their own contacts" ON contacts;
DROP POLICY IF EXISTS "contacts_full_access" ON contacts;

CREATE POLICY "Users can view their own contacts" ON contacts
  FOR SELECT USING ((owner_id = current_user_id()) OR is_admin());

CREATE POLICY "Users can update their own contacts" ON contacts
  FOR UPDATE USING ((owner_id = current_user_id()) OR is_admin());

CREATE POLICY "Users can delete their own contacts" ON contacts
  FOR DELETE USING ((owner_id = current_user_id()) OR is_admin());

-- ============================================================================
-- DEALS
-- ============================================================================
DROP POLICY IF EXISTS "Users can delete their own deals" ON deals;
DROP POLICY IF EXISTS "Users can update their own deals" ON deals;
DROP POLICY IF EXISTS "Users can view their own deals" ON deals;
DROP POLICY IF EXISTS "deals_full_access" ON deals;

CREATE POLICY "Users can view their own deals" ON deals
  FOR SELECT USING ((owner_id = current_user_id()) OR is_admin());

CREATE POLICY "Users can update their own deals" ON deals
  FOR UPDATE USING ((owner_id = current_user_id()) OR is_admin());

CREATE POLICY "Users can delete their own deals" ON deals
  FOR DELETE USING ((owner_id = current_user_id()) OR is_admin());

-- ============================================================================
-- COPILOT TABLES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own analytics" ON copilot_analytics;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON copilot_conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON copilot_conversations;
DROP POLICY IF EXISTS "Users can view their own conversations" ON copilot_conversations;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON copilot_messages;

CREATE POLICY "Users can view their own analytics" ON copilot_analytics
  FOR SELECT USING (current_user_id() = user_id);

CREATE POLICY "Users can view their own conversations" ON copilot_conversations
  FOR SELECT USING (current_user_id() = user_id);

CREATE POLICY "Users can update their own conversations" ON copilot_conversations
  FOR UPDATE USING (current_user_id() = user_id);

CREATE POLICY "Users can delete their own conversations" ON copilot_conversations
  FOR DELETE USING (current_user_id() = user_id);

CREATE POLICY "Users can view messages in their conversations" ON copilot_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM copilot_conversations WHERE copilot_conversations.id = copilot_messages.conversation_id AND copilot_conversations.user_id = current_user_id())
  );

-- ============================================================================
-- CRON JOB LOGS
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own cron logs" ON cron_job_logs;

CREATE POLICY "Users can view own cron logs" ON cron_job_logs
  FOR SELECT USING (current_user_id() = user_id);

-- ============================================================================
-- CSV MAPPING TEMPLATES
-- ============================================================================
DROP POLICY IF EXISTS "Users can delete their own templates" ON csv_mapping_templates;
DROP POLICY IF EXISTS "Users can update their own templates" ON csv_mapping_templates;
DROP POLICY IF EXISTS "Users can view their own templates" ON csv_mapping_templates;

CREATE POLICY "Users can view their own templates" ON csv_mapping_templates
  FOR SELECT USING (user_id = current_user_id());

CREATE POLICY "Users can update their own templates" ON csv_mapping_templates
  FOR UPDATE USING (user_id = current_user_id());

CREATE POLICY "Users can delete their own templates" ON csv_mapping_templates
  FOR DELETE USING (user_id = current_user_id());

-- ============================================================================
-- DEAL ACTIVITIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can delete deal activities" ON deal_activities;
DROP POLICY IF EXISTS "Users can update deal activities" ON deal_activities;
DROP POLICY IF EXISTS "Users can view their deal activities" ON deal_activities;

CREATE POLICY "Users can view their deal activities" ON deal_activities
  FOR SELECT USING (
    (deal_id IN (SELECT deals.id FROM deals WHERE deals.owner_id = current_user_id())) OR
    (user_id = current_user_id())
  );

CREATE POLICY "Users can update deal activities" ON deal_activities
  FOR UPDATE USING (
    (user_id = current_user_id()) AND
    ((deal_id IN (SELECT deals.id FROM deals WHERE deals.owner_id = current_user_id())) OR (deal_id IS NULL))
  );

CREATE POLICY "Users can delete deal activities" ON deal_activities
  FOR DELETE USING (
    (user_id = current_user_id()) AND
    ((deal_id IN (SELECT deals.id FROM deals WHERE deals.owner_id = current_user_id())) OR (deal_id IS NULL))
  );

-- ============================================================================
-- DEAL HEALTH TABLES
-- ============================================================================
DROP POLICY IF EXISTS "Users can update their own deal alerts" ON deal_health_alerts;
DROP POLICY IF EXISTS "Users can view their own deal alerts" ON deal_health_alerts;
DROP POLICY IF EXISTS "Users can view health history for their deals" ON deal_health_history;
DROP POLICY IF EXISTS "Only admins can manage rules" ON deal_health_rules;
DROP POLICY IF EXISTS "Users can update their own deal health scores" ON deal_health_scores;
DROP POLICY IF EXISTS "Users can view their own deal health scores" ON deal_health_scores;

CREATE POLICY "Users can view their own deal alerts" ON deal_health_alerts
  FOR SELECT USING (current_user_id() = user_id);

CREATE POLICY "Users can update their own deal alerts" ON deal_health_alerts
  FOR UPDATE USING (current_user_id() = user_id);

CREATE POLICY "Users can view health history for their deals" ON deal_health_history
  FOR SELECT USING (
    deal_id IN (SELECT deals.id FROM deals WHERE deals.owner_id = current_user_id())
  );

CREATE POLICY "Only admins can manage rules" ON deal_health_rules
  FOR ALL USING (is_admin());

CREATE POLICY "Users can view their own deal health scores" ON deal_health_scores
  FOR SELECT USING (current_user_id() = user_id);

CREATE POLICY "Users can update their own deal health scores" ON deal_health_scores
  FOR UPDATE USING (current_user_id() = user_id);

-- ============================================================================
-- DEAL MIGRATION REVIEWS
-- ============================================================================
DROP POLICY IF EXISTS "deal_migration_reviews_admin_only" ON deal_migration_reviews;

CREATE POLICY "deal_migration_reviews_admin_only" ON deal_migration_reviews
  FOR ALL USING (is_admin());

-- ============================================================================
-- DEAL NOTES
-- ============================================================================
DROP POLICY IF EXISTS "Users can delete their own deal notes" ON deal_notes;
DROP POLICY IF EXISTS "Users can update their own deal notes" ON deal_notes;
DROP POLICY IF EXISTS "Users can view deal notes they have access to" ON deal_notes;

CREATE POLICY "Users can view deal notes they have access to" ON deal_notes
  FOR SELECT USING (
    deal_id IN (SELECT deals.id FROM deals WHERE deals.owner_id = current_user_id())
  );

CREATE POLICY "Users can update their own deal notes" ON deal_notes
  FOR UPDATE USING (
    (created_by = current_user_id()) AND
    (deal_id IN (SELECT deals.id FROM deals WHERE deals.owner_id = current_user_id()))
  );

CREATE POLICY "Users can delete their own deal notes" ON deal_notes
  FOR DELETE USING (
    (created_by = current_user_id()) AND
    (deal_id IN (SELECT deals.id FROM deals WHERE deals.owner_id = current_user_id()))
  );

-- ============================================================================
-- DEAL SPLITS
-- ============================================================================
DROP POLICY IF EXISTS "Only admins can delete deal splits" ON deal_splits;
DROP POLICY IF EXISTS "Users can delete splits for own deals or Directors can delete a" ON deal_splits;
DROP POLICY IF EXISTS "Users can update deal splits" ON deal_splits;
DROP POLICY IF EXISTS "Users can update splits for own deals or Directors can update a" ON deal_splits;
DROP POLICY IF EXISTS "Users can view relevant deal splits" ON deal_splits;

CREATE POLICY "Users can view relevant deal splits" ON deal_splits
  FOR SELECT USING (
    (user_id = current_user_id()) OR
    (deal_id IN (SELECT deals.id FROM deals WHERE deals.owner_id = current_user_id()))
  );

CREATE POLICY "Users can update deal splits" ON deal_splits
  FOR UPDATE USING (
    (user_id = current_user_id()) OR is_admin()
  );

CREATE POLICY "Only admins can delete deal splits" ON deal_splits
  FOR DELETE USING (is_admin());

-- ============================================================================
-- DEAL STAGE HISTORY
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their deal stage history" ON deal_stage_history;

CREATE POLICY "Users can view their deal stage history" ON deal_stage_history
  FOR SELECT USING (
    deal_id IN (SELECT deals.id FROM deals WHERE deals.owner_id = current_user_id())
  );

-- ============================================================================
-- EMAIL TABLES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view email attachments for their emails" ON email_attachments;
DROP POLICY IF EXISTS "Users can manage their email labels mapping" ON email_label_map;

CREATE POLICY "Users can view email attachments for their emails" ON email_attachments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM emails WHERE emails.id = email_attachments.email_id AND emails.user_id = current_user_id())
  );

CREATE POLICY "Users can manage their email labels mapping" ON email_label_map
  FOR ALL USING (
    EXISTS (SELECT 1 FROM emails WHERE emails.id = email_label_map.email_id AND emails.user_id = current_user_id())
  );

-- ============================================================================
-- DONE!
-- ============================================================================
SELECT 'RLS policies updated for Clerk authentication!' as status;
