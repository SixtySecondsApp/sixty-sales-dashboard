-- Multi-Tenant Architecture: Add RLS policies for tenant-scoped tables
-- All policies check org membership via organization_memberships table
-- Super admins (is_admin flag) can bypass RLS

-- Enable RLS on all tenant tables (if not already enabled)
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_prep_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_integrations ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user can access org data
-- This is used in all RLS policies
CREATE OR REPLACE FUNCTION can_access_org_data(p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Super admins can access all orgs
  IF is_super_admin(auth.uid()) THEN
    RETURN true;
  END IF;
  
  -- Check if user is a member of the organization
  RETURN is_org_member(auth.uid(), p_org_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generic policy function for SELECT
CREATE OR REPLACE FUNCTION create_org_select_policy(table_name TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE format('
    DROP POLICY IF EXISTS "org_members_can_select_%s" ON %I;
    CREATE POLICY "org_members_can_select_%s"
      ON %I FOR SELECT
      USING (can_access_org_data(org_id) OR org_id IS NULL);
  ', table_name, table_name, table_name, table_name);
END;
$$ LANGUAGE plpgsql;

-- Generic policy function for INSERT
CREATE OR REPLACE FUNCTION create_org_insert_policy(table_name TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE format('
    DROP POLICY IF EXISTS "org_members_can_insert_%s" ON %I;
    CREATE POLICY "org_members_can_insert_%s"
      ON %I FOR INSERT
      WITH CHECK (can_access_org_data(org_id) OR org_id IS NULL);
  ', table_name, table_name, table_name, table_name);
END;
$$ LANGUAGE plpgsql;

-- Generic policy function for UPDATE
CREATE OR REPLACE FUNCTION create_org_update_policy(table_name TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE format('
    DROP POLICY IF EXISTS "org_members_can_update_%s" ON %I;
    CREATE POLICY "org_members_can_update_%s"
      ON %I FOR UPDATE
      USING (can_access_org_data(org_id) OR org_id IS NULL)
      WITH CHECK (can_access_org_data(org_id) OR org_id IS NULL);
  ', table_name, table_name, table_name, table_name);
END;
$$ LANGUAGE plpgsql;

-- Generic policy function for DELETE
CREATE OR REPLACE FUNCTION create_org_delete_policy(table_name TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE format('
    DROP POLICY IF EXISTS "org_members_can_delete_%s" ON %I;
    CREATE POLICY "org_members_can_delete_%s"
      ON %I FOR DELETE
      USING (can_access_org_data(org_id) OR org_id IS NULL);
  ', table_name, table_name, table_name, table_name);
END;
$$ LANGUAGE plpgsql;

-- Create policies for all tenant tables
SELECT create_org_select_policy('deals');
SELECT create_org_insert_policy('deals');
SELECT create_org_update_policy('deals');
SELECT create_org_delete_policy('deals');

SELECT create_org_select_policy('tasks');
SELECT create_org_insert_policy('tasks');
SELECT create_org_update_policy('tasks');
SELECT create_org_delete_policy('tasks');

SELECT create_org_select_policy('activities');
SELECT create_org_insert_policy('activities');
SELECT create_org_update_policy('activities');
SELECT create_org_delete_policy('activities');

SELECT create_org_select_policy('contacts');
SELECT create_org_insert_policy('contacts');
SELECT create_org_update_policy('contacts');
SELECT create_org_delete_policy('contacts');

SELECT create_org_select_policy('companies');
SELECT create_org_insert_policy('companies');
SELECT create_org_update_policy('companies');
SELECT create_org_delete_policy('companies');

SELECT create_org_select_policy('leads');
SELECT create_org_insert_policy('leads');
SELECT create_org_update_policy('leads');
SELECT create_org_delete_policy('leads');

SELECT create_org_select_policy('clients');
SELECT create_org_insert_policy('clients');
SELECT create_org_update_policy('clients');
SELECT create_org_delete_policy('clients');

SELECT create_org_select_policy('meetings');
SELECT create_org_insert_policy('meetings');
SELECT create_org_update_policy('meetings');
SELECT create_org_delete_policy('meetings');

SELECT create_org_select_policy('calendar_events');
SELECT create_org_insert_policy('calendar_events');
SELECT create_org_update_policy('calendar_events');
SELECT create_org_delete_policy('calendar_events');

SELECT create_org_select_policy('calendar_calendars');
SELECT create_org_insert_policy('calendar_calendars');
SELECT create_org_update_policy('calendar_calendars');
SELECT create_org_delete_policy('calendar_calendars');

SELECT create_org_select_policy('deal_splits');
SELECT create_org_insert_policy('deal_splits');
SELECT create_org_update_policy('deal_splits');
SELECT create_org_delete_policy('deal_splits');

SELECT create_org_select_policy('lead_prep_notes');
SELECT create_org_insert_policy('lead_prep_notes');
SELECT create_org_update_policy('lead_prep_notes');
SELECT create_org_delete_policy('lead_prep_notes');

SELECT create_org_select_policy('workflow_executions');
SELECT create_org_insert_policy('workflow_executions');
SELECT create_org_update_policy('workflow_executions');
SELECT create_org_delete_policy('workflow_executions');

SELECT create_org_select_policy('user_automation_rules');
SELECT create_org_insert_policy('user_automation_rules');
SELECT create_org_update_policy('user_automation_rules');
SELECT create_org_delete_policy('user_automation_rules');

SELECT create_org_select_policy('smart_task_templates');
SELECT create_org_insert_policy('smart_task_templates');
SELECT create_org_update_policy('smart_task_templates');
SELECT create_org_delete_policy('smart_task_templates');

SELECT create_org_select_policy('deal_notes');
SELECT create_org_insert_policy('deal_notes');
SELECT create_org_update_policy('deal_notes');
SELECT create_org_delete_policy('deal_notes');

SELECT create_org_select_policy('contact_notes');
SELECT create_org_insert_policy('contact_notes');
SELECT create_org_update_policy('contact_notes');
SELECT create_org_delete_policy('contact_notes');

SELECT create_org_select_policy('company_notes');
SELECT create_org_insert_policy('company_notes');
SELECT create_org_update_policy('company_notes');
SELECT create_org_delete_policy('company_notes');

SELECT create_org_select_policy('google_integrations');
SELECT create_org_insert_policy('google_integrations');
SELECT create_org_update_policy('google_integrations');
SELECT create_org_delete_policy('google_integrations');

-- Clean up helper functions (they're no longer needed after policies are created)
DROP FUNCTION IF EXISTS create_org_select_policy(TEXT);
DROP FUNCTION IF EXISTS create_org_insert_policy(TEXT);
DROP FUNCTION IF EXISTS create_org_update_policy(TEXT);
DROP FUNCTION IF EXISTS create_org_delete_policy(TEXT);

-- Comments
COMMENT ON FUNCTION can_access_org_data(UUID) IS 'Checks if current user can access data for a given organization (member or super admin)';

