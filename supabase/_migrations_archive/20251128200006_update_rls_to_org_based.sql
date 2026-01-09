-- =====================================================
-- Multi-Tenant: Update RLS Policies to Org-Based
-- =====================================================
-- This migration replaces user-based RLS policies with
-- organization-based policies for strict tenant isolation.
--
-- Pattern:
-- - SELECT: can_access_org_data(org_id)
-- - INSERT: can_write_to_org(org_id)
-- - UPDATE: can_access_org_data(org_id) + can_write_to_org(org_id)
-- - DELETE: can_write_to_org(org_id)

-- =====================================================
-- DEALS TABLE
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view deals" ON deals;
DROP POLICY IF EXISTS "Users can view own deals" ON deals;
DROP POLICY IF EXISTS "Users can insert own deals" ON deals;
DROP POLICY IF EXISTS "Users can update deals" ON deals;
DROP POLICY IF EXISTS "Users can update own deals" ON deals;
DROP POLICY IF EXISTS "Users can delete deals" ON deals;
DROP POLICY IF EXISTS "Users can delete own deals" ON deals;
DROP POLICY IF EXISTS "org_members_can_select_deals" ON deals;
DROP POLICY IF EXISTS "org_members_can_insert_deals" ON deals;
DROP POLICY IF EXISTS "org_members_can_update_deals" ON deals;
DROP POLICY IF EXISTS "org_members_can_delete_deals" ON deals;
DROP POLICY IF EXISTS "Admin can view all deals" ON deals;
DROP POLICY IF EXISTS "Admins can view all deals" ON deals;

-- Create org-based policies
CREATE POLICY "org_select_deals"
  ON deals FOR SELECT
  USING (can_access_org_data(org_id));

CREATE POLICY "org_insert_deals"
  ON deals FOR INSERT
  WITH CHECK (can_write_to_org(org_id));

CREATE POLICY "org_update_deals"
  ON deals FOR UPDATE
  USING (can_access_org_data(org_id))
  WITH CHECK (can_write_to_org(org_id));

CREATE POLICY "org_delete_deals"
  ON deals FOR DELETE
  USING (can_write_to_org(org_id));

-- =====================================================
-- TASKS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON tasks;
DROP POLICY IF EXISTS "org_members_can_select_tasks" ON tasks;
DROP POLICY IF EXISTS "org_members_can_insert_tasks" ON tasks;
DROP POLICY IF EXISTS "org_members_can_update_tasks" ON tasks;
DROP POLICY IF EXISTS "org_members_can_delete_tasks" ON tasks;

CREATE POLICY "org_select_tasks"
  ON tasks FOR SELECT
  USING (can_access_org_data(org_id));

CREATE POLICY "org_insert_tasks"
  ON tasks FOR INSERT
  WITH CHECK (can_write_to_org(org_id));

CREATE POLICY "org_update_tasks"
  ON tasks FOR UPDATE
  USING (can_access_org_data(org_id))
  WITH CHECK (can_write_to_org(org_id));

CREATE POLICY "org_delete_tasks"
  ON tasks FOR DELETE
  USING (can_write_to_org(org_id));

-- =====================================================
-- ACTIVITIES TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view activities" ON activities;
DROP POLICY IF EXISTS "Users can view own activities" ON activities;
DROP POLICY IF EXISTS "Enable read access for own activities" ON activities;
DROP POLICY IF EXISTS "Users can insert activities" ON activities;
DROP POLICY IF EXISTS "Enable create access for own activities" ON activities;
DROP POLICY IF EXISTS "Users can update activities" ON activities;
DROP POLICY IF EXISTS "Enable update access for own activities" ON activities;
DROP POLICY IF EXISTS "Users can delete activities" ON activities;
DROP POLICY IF EXISTS "Enable delete access for own activities" ON activities;
DROP POLICY IF EXISTS "org_members_can_select_activities" ON activities;
DROP POLICY IF EXISTS "org_members_can_insert_activities" ON activities;
DROP POLICY IF EXISTS "org_members_can_update_activities" ON activities;
DROP POLICY IF EXISTS "org_members_can_delete_activities" ON activities;

CREATE POLICY "org_select_activities"
  ON activities FOR SELECT
  USING (can_access_org_data(org_id));

CREATE POLICY "org_insert_activities"
  ON activities FOR INSERT
  WITH CHECK (can_write_to_org(org_id));

CREATE POLICY "org_update_activities"
  ON activities FOR UPDATE
  USING (can_access_org_data(org_id))
  WITH CHECK (can_write_to_org(org_id));

CREATE POLICY "org_delete_activities"
  ON activities FOR DELETE
  USING (can_write_to_org(org_id));

-- =====================================================
-- CONTACTS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view contacts" ON contacts;
DROP POLICY IF EXISTS "Users can view own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can insert contacts" ON contacts;
DROP POLICY IF EXISTS "Users can insert own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete own contacts" ON contacts;
DROP POLICY IF EXISTS "org_members_can_select_contacts" ON contacts;
DROP POLICY IF EXISTS "org_members_can_insert_contacts" ON contacts;
DROP POLICY IF EXISTS "org_members_can_update_contacts" ON contacts;
DROP POLICY IF EXISTS "org_members_can_delete_contacts" ON contacts;

CREATE POLICY "org_select_contacts"
  ON contacts FOR SELECT
  USING (can_access_org_data(org_id));

CREATE POLICY "org_insert_contacts"
  ON contacts FOR INSERT
  WITH CHECK (can_write_to_org(org_id));

CREATE POLICY "org_update_contacts"
  ON contacts FOR UPDATE
  USING (can_access_org_data(org_id))
  WITH CHECK (can_write_to_org(org_id));

CREATE POLICY "org_delete_contacts"
  ON contacts FOR DELETE
  USING (can_write_to_org(org_id));

-- =====================================================
-- COMPANIES TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view companies" ON companies;
DROP POLICY IF EXISTS "Users can view own companies" ON companies;
DROP POLICY IF EXISTS "Users can insert companies" ON companies;
DROP POLICY IF EXISTS "Users can update companies" ON companies;
DROP POLICY IF EXISTS "Users can delete companies" ON companies;
DROP POLICY IF EXISTS "org_members_can_select_companies" ON companies;
DROP POLICY IF EXISTS "org_members_can_insert_companies" ON companies;
DROP POLICY IF EXISTS "org_members_can_update_companies" ON companies;
DROP POLICY IF EXISTS "org_members_can_delete_companies" ON companies;

CREATE POLICY "org_select_companies"
  ON companies FOR SELECT
  USING (can_access_org_data(org_id));

CREATE POLICY "org_insert_companies"
  ON companies FOR INSERT
  WITH CHECK (can_write_to_org(org_id));

CREATE POLICY "org_update_companies"
  ON companies FOR UPDATE
  USING (can_access_org_data(org_id))
  WITH CHECK (can_write_to_org(org_id));

CREATE POLICY "org_delete_companies"
  ON companies FOR DELETE
  USING (can_write_to_org(org_id));

-- =====================================================
-- LEADS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view leads" ON leads;
DROP POLICY IF EXISTS "Users can view own leads" ON leads;
DROP POLICY IF EXISTS "Users can insert leads" ON leads;
DROP POLICY IF EXISTS "Users can update leads" ON leads;
DROP POLICY IF EXISTS "Users can delete leads" ON leads;
DROP POLICY IF EXISTS "org_members_can_select_leads" ON leads;
DROP POLICY IF EXISTS "org_members_can_insert_leads" ON leads;
DROP POLICY IF EXISTS "org_members_can_update_leads" ON leads;
DROP POLICY IF EXISTS "org_members_can_delete_leads" ON leads;

CREATE POLICY "org_select_leads"
  ON leads FOR SELECT
  USING (can_access_org_data(org_id));

CREATE POLICY "org_insert_leads"
  ON leads FOR INSERT
  WITH CHECK (can_write_to_org(org_id));

CREATE POLICY "org_update_leads"
  ON leads FOR UPDATE
  USING (can_access_org_data(org_id))
  WITH CHECK (can_write_to_org(org_id));

CREATE POLICY "org_delete_leads"
  ON leads FOR DELETE
  USING (can_write_to_org(org_id));

-- =====================================================
-- CLIENTS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view clients" ON clients;
DROP POLICY IF EXISTS "Users can view own clients" ON clients;
DROP POLICY IF EXISTS "Users can insert clients" ON clients;
DROP POLICY IF EXISTS "Users can update clients" ON clients;
DROP POLICY IF EXISTS "Users can delete clients" ON clients;
DROP POLICY IF EXISTS "org_members_can_select_clients" ON clients;
DROP POLICY IF EXISTS "org_members_can_insert_clients" ON clients;
DROP POLICY IF EXISTS "org_members_can_update_clients" ON clients;
DROP POLICY IF EXISTS "org_members_can_delete_clients" ON clients;

CREATE POLICY "org_select_clients"
  ON clients FOR SELECT
  USING (can_access_org_data(org_id));

CREATE POLICY "org_insert_clients"
  ON clients FOR INSERT
  WITH CHECK (can_write_to_org(org_id));

CREATE POLICY "org_update_clients"
  ON clients FOR UPDATE
  USING (can_access_org_data(org_id))
  WITH CHECK (can_write_to_org(org_id));

CREATE POLICY "org_delete_clients"
  ON clients FOR DELETE
  USING (can_write_to_org(org_id));

-- =====================================================
-- MEETINGS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view meetings" ON meetings;
DROP POLICY IF EXISTS "Users can view own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can insert meetings" ON meetings;
DROP POLICY IF EXISTS "Users can update meetings" ON meetings;
DROP POLICY IF EXISTS "Users can delete meetings" ON meetings;
DROP POLICY IF EXISTS "org_members_can_select_meetings" ON meetings;
DROP POLICY IF EXISTS "org_members_can_insert_meetings" ON meetings;
DROP POLICY IF EXISTS "org_members_can_update_meetings" ON meetings;
DROP POLICY IF EXISTS "org_members_can_delete_meetings" ON meetings;

CREATE POLICY "org_select_meetings"
  ON meetings FOR SELECT
  USING (can_access_org_data(org_id));

CREATE POLICY "org_insert_meetings"
  ON meetings FOR INSERT
  WITH CHECK (can_write_to_org(org_id));

CREATE POLICY "org_update_meetings"
  ON meetings FOR UPDATE
  USING (can_access_org_data(org_id))
  WITH CHECK (can_write_to_org(org_id));

CREATE POLICY "org_delete_meetings"
  ON meetings FOR DELETE
  USING (can_write_to_org(org_id));

-- =====================================================
-- CALENDAR_EVENTS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "Users can view own calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "Users can insert calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "Users can update calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "Users can delete calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "org_members_can_select_calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "org_members_can_insert_calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "org_members_can_update_calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "org_members_can_delete_calendar_events" ON calendar_events;

CREATE POLICY "org_select_calendar_events"
  ON calendar_events FOR SELECT
  USING (can_access_org_data(org_id));

CREATE POLICY "org_insert_calendar_events"
  ON calendar_events FOR INSERT
  WITH CHECK (can_write_to_org(org_id));

CREATE POLICY "org_update_calendar_events"
  ON calendar_events FOR UPDATE
  USING (can_access_org_data(org_id))
  WITH CHECK (can_write_to_org(org_id));

CREATE POLICY "org_delete_calendar_events"
  ON calendar_events FOR DELETE
  USING (can_write_to_org(org_id));

-- =====================================================
-- RELATIONSHIP HEALTH TABLES
-- =====================================================

-- relationship_health_scores
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'relationship_health_scores') THEN
    DROP POLICY IF EXISTS "Users can view own relationship_health_scores" ON relationship_health_scores;
    DROP POLICY IF EXISTS "Users can insert own relationship_health_scores" ON relationship_health_scores;
    DROP POLICY IF EXISTS "Users can update own relationship_health_scores" ON relationship_health_scores;
    DROP POLICY IF EXISTS "Users can delete own relationship_health_scores" ON relationship_health_scores;

    CREATE POLICY "org_select_relationship_health_scores"
      ON relationship_health_scores FOR SELECT
      USING (can_access_org_data(org_id));

    CREATE POLICY "org_insert_relationship_health_scores"
      ON relationship_health_scores FOR INSERT
      WITH CHECK (can_write_to_org(org_id));

    CREATE POLICY "org_update_relationship_health_scores"
      ON relationship_health_scores FOR UPDATE
      USING (can_access_org_data(org_id))
      WITH CHECK (can_write_to_org(org_id));

    CREATE POLICY "org_delete_relationship_health_scores"
      ON relationship_health_scores FOR DELETE
      USING (can_write_to_org(org_id));
  END IF;
END $$;

-- communication_events
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'communication_events') THEN
    DROP POLICY IF EXISTS "Users can view own communication events" ON communication_events;
    DROP POLICY IF EXISTS "Users can insert own communication events" ON communication_events;
    DROP POLICY IF EXISTS "Users can update own communication events" ON communication_events;
    DROP POLICY IF EXISTS "Users can delete own communication events" ON communication_events;

    CREATE POLICY "org_select_communication_events"
      ON communication_events FOR SELECT
      USING (can_access_org_data(org_id));

    CREATE POLICY "org_insert_communication_events"
      ON communication_events FOR INSERT
      WITH CHECK (can_write_to_org(org_id));

    CREATE POLICY "org_update_communication_events"
      ON communication_events FOR UPDATE
      USING (can_access_org_data(org_id))
      WITH CHECK (can_write_to_org(org_id));

    CREATE POLICY "org_delete_communication_events"
      ON communication_events FOR DELETE
      USING (can_write_to_org(org_id));
  END IF;
END $$;

-- =====================================================
-- PROPOSAL TABLES
-- =====================================================

-- proposal_jobs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'proposal_jobs') THEN
    DROP POLICY IF EXISTS "Users can view their own proposal_jobs" ON proposal_jobs;
    DROP POLICY IF EXISTS "Users can create their own proposal_jobs" ON proposal_jobs;
    DROP POLICY IF EXISTS "Users can update their own proposal_jobs" ON proposal_jobs;

    CREATE POLICY "org_select_proposal_jobs"
      ON proposal_jobs FOR SELECT
      USING (can_access_org_data(org_id));

    CREATE POLICY "org_insert_proposal_jobs"
      ON proposal_jobs FOR INSERT
      WITH CHECK (can_write_to_org(org_id));

    CREATE POLICY "org_update_proposal_jobs"
      ON proposal_jobs FOR UPDATE
      USING (can_access_org_data(org_id))
      WITH CHECK (can_write_to_org(org_id));

    CREATE POLICY "org_delete_proposal_jobs"
      ON proposal_jobs FOR DELETE
      USING (can_write_to_org(org_id));
  END IF;
END $$;

-- sales_templates
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_templates') THEN
    DROP POLICY IF EXISTS "Users can view own sales_templates" ON sales_templates;
    DROP POLICY IF EXISTS "Users can insert own sales_templates" ON sales_templates;
    DROP POLICY IF EXISTS "Users can update own sales_templates" ON sales_templates;
    DROP POLICY IF EXISTS "Users can delete own sales_templates" ON sales_templates;

    CREATE POLICY "org_select_sales_templates"
      ON sales_templates FOR SELECT
      USING (can_access_org_data(org_id));

    CREATE POLICY "org_insert_sales_templates"
      ON sales_templates FOR INSERT
      WITH CHECK (can_write_to_org(org_id));

    CREATE POLICY "org_update_sales_templates"
      ON sales_templates FOR UPDATE
      USING (can_access_org_data(org_id))
      WITH CHECK (can_write_to_org(org_id));

    CREATE POLICY "org_delete_sales_templates"
      ON sales_templates FOR DELETE
      USING (can_write_to_org(org_id));
  END IF;
END $$;

-- =====================================================
-- WORKFLOW TABLES
-- =====================================================

-- workflow_executions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_executions') THEN
    DROP POLICY IF EXISTS "Users can view own workflow_executions" ON workflow_executions;
    DROP POLICY IF EXISTS "Users can insert own workflow_executions" ON workflow_executions;
    DROP POLICY IF EXISTS "Users can update own workflow_executions" ON workflow_executions;
    DROP POLICY IF EXISTS "Users can delete own workflow_executions" ON workflow_executions;
    DROP POLICY IF EXISTS "org_members_can_select_workflow_executions" ON workflow_executions;
    DROP POLICY IF EXISTS "org_members_can_insert_workflow_executions" ON workflow_executions;
    DROP POLICY IF EXISTS "org_members_can_update_workflow_executions" ON workflow_executions;
    DROP POLICY IF EXISTS "org_members_can_delete_workflow_executions" ON workflow_executions;

    CREATE POLICY "org_select_workflow_executions"
      ON workflow_executions FOR SELECT
      USING (can_access_org_data(org_id));

    CREATE POLICY "org_insert_workflow_executions"
      ON workflow_executions FOR INSERT
      WITH CHECK (can_write_to_org(org_id));

    CREATE POLICY "org_update_workflow_executions"
      ON workflow_executions FOR UPDATE
      USING (can_access_org_data(org_id))
      WITH CHECK (can_write_to_org(org_id));

    CREATE POLICY "org_delete_workflow_executions"
      ON workflow_executions FOR DELETE
      USING (can_write_to_org(org_id));
  END IF;
END $$;

-- smart_task_templates
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'smart_task_templates') THEN
    DROP POLICY IF EXISTS "Users can view own smart_task_templates" ON smart_task_templates;
    DROP POLICY IF EXISTS "Users can insert own smart_task_templates" ON smart_task_templates;
    DROP POLICY IF EXISTS "Users can update own smart_task_templates" ON smart_task_templates;
    DROP POLICY IF EXISTS "Users can delete own smart_task_templates" ON smart_task_templates;
    DROP POLICY IF EXISTS "org_members_can_select_smart_task_templates" ON smart_task_templates;
    DROP POLICY IF EXISTS "org_members_can_insert_smart_task_templates" ON smart_task_templates;
    DROP POLICY IF EXISTS "org_members_can_update_smart_task_templates" ON smart_task_templates;
    DROP POLICY IF EXISTS "org_members_can_delete_smart_task_templates" ON smart_task_templates;

    CREATE POLICY "org_select_smart_task_templates"
      ON smart_task_templates FOR SELECT
      USING (can_access_org_data(org_id));

    CREATE POLICY "org_insert_smart_task_templates"
      ON smart_task_templates FOR INSERT
      WITH CHECK (can_write_to_org(org_id));

    CREATE POLICY "org_update_smart_task_templates"
      ON smart_task_templates FOR UPDATE
      USING (can_access_org_data(org_id))
      WITH CHECK (can_write_to_org(org_id));

    CREATE POLICY "org_delete_smart_task_templates"
      ON smart_task_templates FOR DELETE
      USING (can_write_to_org(org_id));
  END IF;
END $$;

-- =====================================================
-- CHILD/JUNCTION TABLES
-- =====================================================

-- deal_splits
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deal_splits') THEN
    DROP POLICY IF EXISTS "deal_splits_select_policy" ON deal_splits;
    DROP POLICY IF EXISTS "deal_splits_insert_policy" ON deal_splits;
    DROP POLICY IF EXISTS "deal_splits_update_policy" ON deal_splits;
    DROP POLICY IF EXISTS "deal_splits_delete_policy" ON deal_splits;

    CREATE POLICY "org_select_deal_splits"
      ON deal_splits FOR SELECT
      USING (can_access_org_data(org_id));

    CREATE POLICY "org_insert_deal_splits"
      ON deal_splits FOR INSERT
      WITH CHECK (can_write_to_org(org_id));

    CREATE POLICY "org_update_deal_splits"
      ON deal_splits FOR UPDATE
      USING (can_access_org_data(org_id))
      WITH CHECK (can_write_to_org(org_id));

    CREATE POLICY "org_delete_deal_splits"
      ON deal_splits FOR DELETE
      USING (can_write_to_org(org_id));
  END IF;
END $$;

-- deal_notes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deal_notes') THEN
    DROP POLICY IF EXISTS "Users can view own deal_notes" ON deal_notes;
    DROP POLICY IF EXISTS "Users can insert own deal_notes" ON deal_notes;
    DROP POLICY IF EXISTS "Users can update own deal_notes" ON deal_notes;
    DROP POLICY IF EXISTS "Users can delete own deal_notes" ON deal_notes;
    DROP POLICY IF EXISTS "org_members_can_select_deal_notes" ON deal_notes;
    DROP POLICY IF EXISTS "org_members_can_insert_deal_notes" ON deal_notes;
    DROP POLICY IF EXISTS "org_members_can_update_deal_notes" ON deal_notes;
    DROP POLICY IF EXISTS "org_members_can_delete_deal_notes" ON deal_notes;

    CREATE POLICY "org_select_deal_notes"
      ON deal_notes FOR SELECT
      USING (can_access_org_data(org_id));

    CREATE POLICY "org_insert_deal_notes"
      ON deal_notes FOR INSERT
      WITH CHECK (can_write_to_org(org_id));

    CREATE POLICY "org_update_deal_notes"
      ON deal_notes FOR UPDATE
      USING (can_access_org_data(org_id))
      WITH CHECK (can_write_to_org(org_id));

    CREATE POLICY "org_delete_deal_notes"
      ON deal_notes FOR DELETE
      USING (can_write_to_org(org_id));
  END IF;
END $$;

-- contact_notes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contact_notes') THEN
    DROP POLICY IF EXISTS "Users can view own contact_notes" ON contact_notes;
    DROP POLICY IF EXISTS "Users can insert own contact_notes" ON contact_notes;
    DROP POLICY IF EXISTS "Users can update own contact_notes" ON contact_notes;
    DROP POLICY IF EXISTS "Users can delete own contact_notes" ON contact_notes;
    DROP POLICY IF EXISTS "org_members_can_select_contact_notes" ON contact_notes;
    DROP POLICY IF EXISTS "org_members_can_insert_contact_notes" ON contact_notes;
    DROP POLICY IF EXISTS "org_members_can_update_contact_notes" ON contact_notes;
    DROP POLICY IF EXISTS "org_members_can_delete_contact_notes" ON contact_notes;

    CREATE POLICY "org_select_contact_notes"
      ON contact_notes FOR SELECT
      USING (can_access_org_data(org_id));

    CREATE POLICY "org_insert_contact_notes"
      ON contact_notes FOR INSERT
      WITH CHECK (can_write_to_org(org_id));

    CREATE POLICY "org_update_contact_notes"
      ON contact_notes FOR UPDATE
      USING (can_access_org_data(org_id))
      WITH CHECK (can_write_to_org(org_id));

    CREATE POLICY "org_delete_contact_notes"
      ON contact_notes FOR DELETE
      USING (can_write_to_org(org_id));
  END IF;
END $$;

-- company_notes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'company_notes') THEN
    DROP POLICY IF EXISTS "Users can view own company_notes" ON company_notes;
    DROP POLICY IF EXISTS "Users can insert own company_notes" ON company_notes;
    DROP POLICY IF EXISTS "Users can update own company_notes" ON company_notes;
    DROP POLICY IF EXISTS "Users can delete own company_notes" ON company_notes;
    DROP POLICY IF EXISTS "org_members_can_select_company_notes" ON company_notes;
    DROP POLICY IF EXISTS "org_members_can_insert_company_notes" ON company_notes;
    DROP POLICY IF EXISTS "org_members_can_update_company_notes" ON company_notes;
    DROP POLICY IF EXISTS "org_members_can_delete_company_notes" ON company_notes;

    CREATE POLICY "org_select_company_notes"
      ON company_notes FOR SELECT
      USING (can_access_org_data(org_id));

    CREATE POLICY "org_insert_company_notes"
      ON company_notes FOR INSERT
      WITH CHECK (can_write_to_org(org_id));

    CREATE POLICY "org_update_company_notes"
      ON company_notes FOR UPDATE
      USING (can_access_org_data(org_id))
      WITH CHECK (can_write_to_org(org_id));

    CREATE POLICY "org_delete_company_notes"
      ON company_notes FOR DELETE
      USING (can_write_to_org(org_id));
  END IF;
END $$;

-- =====================================================
-- INTEGRATION TABLES
-- =====================================================

-- google_integrations
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'google_integrations') THEN
    DROP POLICY IF EXISTS "Users can view own google_integrations" ON google_integrations;
    DROP POLICY IF EXISTS "Users can insert own google_integrations" ON google_integrations;
    DROP POLICY IF EXISTS "Users can update own google_integrations" ON google_integrations;
    DROP POLICY IF EXISTS "Users can delete own google_integrations" ON google_integrations;
    DROP POLICY IF EXISTS "org_members_can_select_google_integrations" ON google_integrations;
    DROP POLICY IF EXISTS "org_members_can_insert_google_integrations" ON google_integrations;
    DROP POLICY IF EXISTS "org_members_can_update_google_integrations" ON google_integrations;
    DROP POLICY IF EXISTS "org_members_can_delete_google_integrations" ON google_integrations;

    CREATE POLICY "org_select_google_integrations"
      ON google_integrations FOR SELECT
      USING (can_access_org_data(org_id));

    CREATE POLICY "org_insert_google_integrations"
      ON google_integrations FOR INSERT
      WITH CHECK (can_write_to_org(org_id));

    CREATE POLICY "org_update_google_integrations"
      ON google_integrations FOR UPDATE
      USING (can_access_org_data(org_id))
      WITH CHECK (can_write_to_org(org_id));

    CREATE POLICY "org_delete_google_integrations"
      ON google_integrations FOR DELETE
      USING (can_write_to_org(org_id));
  END IF;
END $$;

-- calendar_calendars
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calendar_calendars') THEN
    DROP POLICY IF EXISTS "Users can view own calendar_calendars" ON calendar_calendars;
    DROP POLICY IF EXISTS "Users can insert own calendar_calendars" ON calendar_calendars;
    DROP POLICY IF EXISTS "Users can update own calendar_calendars" ON calendar_calendars;
    DROP POLICY IF EXISTS "Users can delete own calendar_calendars" ON calendar_calendars;
    DROP POLICY IF EXISTS "org_members_can_select_calendar_calendars" ON calendar_calendars;
    DROP POLICY IF EXISTS "org_members_can_insert_calendar_calendars" ON calendar_calendars;
    DROP POLICY IF EXISTS "org_members_can_update_calendar_calendars" ON calendar_calendars;
    DROP POLICY IF EXISTS "org_members_can_delete_calendar_calendars" ON calendar_calendars;

    CREATE POLICY "org_select_calendar_calendars"
      ON calendar_calendars FOR SELECT
      USING (can_access_org_data(org_id));

    CREATE POLICY "org_insert_calendar_calendars"
      ON calendar_calendars FOR INSERT
      WITH CHECK (can_write_to_org(org_id));

    CREATE POLICY "org_update_calendar_calendars"
      ON calendar_calendars FOR UPDATE
      USING (can_access_org_data(org_id))
      WITH CHECK (can_write_to_org(org_id));

    CREATE POLICY "org_delete_calendar_calendars"
      ON calendar_calendars FOR DELETE
      USING (can_write_to_org(org_id));
  END IF;
END $$;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON POLICY "org_select_deals" ON deals IS 'Organization members can view deals in their org';
COMMENT ON POLICY "org_insert_deals" ON deals IS 'Organization members with write access can create deals';
COMMENT ON POLICY "org_update_deals" ON deals IS 'Organization members with write access can update deals';
COMMENT ON POLICY "org_delete_deals" ON deals IS 'Organization members with write access can delete deals';
