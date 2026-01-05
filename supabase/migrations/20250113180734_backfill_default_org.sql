-- Multi-Tenant Architecture: Backfill existing data with default organization
-- This migration creates a default organization and assigns all existing data to it
-- NOTE: All operations are conditional on table existence for staging compatibility

-- Helper function to execute update if table exists
CREATE OR REPLACE FUNCTION execute_update_if_table_exists(p_table_name TEXT, p_update_sql TEXT)
RETURNS VOID AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = p_table_name) THEN
    EXECUTE p_update_sql;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Helper function to set NOT NULL if table and column exist
CREATE OR REPLACE FUNCTION set_not_null_if_exists(p_table_name TEXT, p_column_name TEXT)
RETURNS VOID AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = p_table_name
    AND column_name = p_column_name
  ) THEN
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET NOT NULL', p_table_name, p_column_name);
  END IF;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  default_org_id UUID;
  user_record RECORD;
BEGIN
  -- Create default organization
  INSERT INTO organizations (name, created_by, is_active)
  VALUES ('Default Organization', NULL, true)
  ON CONFLICT DO NOTHING
  RETURNING id INTO default_org_id;

  -- If organization already exists, get its ID
  IF default_org_id IS NULL THEN
    SELECT id INTO default_org_id FROM organizations WHERE name = 'Default Organization' LIMIT 1;
  END IF;

  -- Add all existing users as owners of the default organization
  FOR user_record IN
    SELECT id FROM auth.users
  LOOP
    INSERT INTO organization_memberships (org_id, user_id, role)
    VALUES (default_org_id, user_record.id, 'owner')
    ON CONFLICT (org_id, user_id) DO NOTHING;
  END LOOP;

  -- Backfill org_id for all tenant tables (only if tables exist)

  -- Deals: use owner_id to find user's org
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deals') THEN
    UPDATE deals d
    SET org_id = (
      SELECT om.org_id
      FROM organization_memberships om
      WHERE om.user_id = d.owner_id
      LIMIT 1
    )
    WHERE d.org_id IS NULL;

    -- Fallback to default org
    UPDATE deals SET org_id = default_org_id WHERE org_id IS NULL;
  END IF;

  -- Tasks: use user_id to find user's org
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks') THEN
    UPDATE tasks t
    SET org_id = (
      SELECT om.org_id
      FROM organization_memberships om
      WHERE om.user_id = t.user_id
      LIMIT 1
    )
    WHERE t.org_id IS NULL;

    UPDATE tasks SET org_id = default_org_id WHERE org_id IS NULL;
  END IF;

  -- Activities: use user_id to find user's org
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activities') THEN
    UPDATE activities a
    SET org_id = (
      SELECT om.org_id
      FROM organization_memberships om
      WHERE om.user_id = a.user_id
      LIMIT 1
    )
    WHERE a.org_id IS NULL;

    UPDATE activities SET org_id = default_org_id WHERE org_id IS NULL;
  END IF;

  -- Contacts: use user_id to find user's org
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contacts') THEN
    UPDATE contacts c
    SET org_id = (
      SELECT om.org_id
      FROM organization_memberships om
      WHERE om.user_id = c.user_id
      LIMIT 1
    )
    WHERE c.org_id IS NULL;

    UPDATE contacts SET org_id = default_org_id WHERE org_id IS NULL;
  END IF;

  -- Companies: use user_id (or owner_id if exists) to find user's org
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies') THEN
    UPDATE companies co
    SET org_id = COALESCE(
      (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = co.user_id LIMIT 1),
      (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = co.owner_id LIMIT 1)
    )
    WHERE co.org_id IS NULL;

    UPDATE companies SET org_id = default_org_id WHERE org_id IS NULL;
  END IF;

  -- Leads: use owner_id to find user's org
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leads') THEN
    UPDATE leads l
    SET org_id = (
      SELECT om.org_id
      FROM organization_memberships om
      WHERE om.user_id = l.owner_id
      LIMIT 1
    )
    WHERE l.org_id IS NULL;

    UPDATE leads SET org_id = default_org_id WHERE org_id IS NULL;
  END IF;

  -- Clients: use owner_id to find user's org
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clients') THEN
    UPDATE clients cl
    SET org_id = (
      SELECT om.org_id
      FROM organization_memberships om
      WHERE om.user_id = cl.owner_id
      LIMIT 1
    )
    WHERE cl.org_id IS NULL;

    UPDATE clients SET org_id = default_org_id WHERE org_id IS NULL;
  END IF;

  -- Meetings: use owner_user_id (NOT user_id!) to find user's org
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meetings') THEN
    UPDATE meetings m
    SET org_id = (
      SELECT om.org_id
      FROM organization_memberships om
      WHERE om.user_id = m.owner_user_id
      LIMIT 1
    )
    WHERE m.org_id IS NULL;

    UPDATE meetings SET org_id = default_org_id WHERE org_id IS NULL;
  END IF;

  -- Calendar events: use user_id to find user's org
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'calendar_events') THEN
    UPDATE calendar_events ce
    SET org_id = (
      SELECT om.org_id
      FROM organization_memberships om
      WHERE om.user_id = ce.user_id
      LIMIT 1
    )
    WHERE ce.org_id IS NULL;

    UPDATE calendar_events SET org_id = default_org_id WHERE org_id IS NULL;
  END IF;

  -- Calendar calendars: use user_id to find user's org
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'calendar_calendars') THEN
    UPDATE calendar_calendars cc
    SET org_id = (
      SELECT om.org_id
      FROM organization_memberships om
      WHERE om.user_id = cc.user_id
      LIMIT 1
    )
    WHERE cc.org_id IS NULL;

    UPDATE calendar_calendars SET org_id = default_org_id WHERE org_id IS NULL;
  END IF;

  -- Deal splits: use deal_id to find deal's org
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deal_splits') THEN
    UPDATE deal_splits ds
    SET org_id = (
      SELECT d.org_id
      FROM deals d
      WHERE d.id = ds.deal_id
      LIMIT 1
    )
    WHERE ds.org_id IS NULL;

    UPDATE deal_splits SET org_id = default_org_id WHERE org_id IS NULL;
  END IF;

  -- Lead prep notes: use lead_id to find lead's org
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lead_prep_notes') THEN
    UPDATE lead_prep_notes lpn
    SET org_id = (
      SELECT l.org_id
      FROM leads l
      WHERE l.id = lpn.lead_id
      LIMIT 1
    )
    WHERE lpn.org_id IS NULL;

    UPDATE lead_prep_notes SET org_id = default_org_id WHERE org_id IS NULL;
  END IF;

  -- Workflow executions: use user_id to find user's org
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workflow_executions') THEN
    UPDATE workflow_executions we
    SET org_id = (
      SELECT om.org_id
      FROM organization_memberships om
      WHERE om.user_id = we.user_id
      LIMIT 1
    )
    WHERE we.org_id IS NULL;

    UPDATE workflow_executions SET org_id = default_org_id WHERE org_id IS NULL;
  END IF;

  -- User automation rules: use user_id to find user's org
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_automation_rules') THEN
    UPDATE user_automation_rules uar
    SET org_id = (
      SELECT om.org_id
      FROM organization_memberships om
      WHERE om.user_id = uar.user_id
      LIMIT 1
    )
    WHERE uar.org_id IS NULL;

    UPDATE user_automation_rules SET org_id = default_org_id WHERE org_id IS NULL;
  END IF;

  -- Smart task templates: use user_id to find user's org
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'smart_task_templates') THEN
    UPDATE smart_task_templates stt
    SET org_id = (
      SELECT om.org_id
      FROM organization_memberships om
      WHERE om.user_id = stt.user_id
      LIMIT 1
    )
    WHERE stt.org_id IS NULL;

    UPDATE smart_task_templates SET org_id = default_org_id WHERE org_id IS NULL;
  END IF;

  -- Deal notes: use deal_id to find deal's org
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deal_notes') THEN
    UPDATE deal_notes dn
    SET org_id = (
      SELECT d.org_id
      FROM deals d
      WHERE d.id = dn.deal_id
      LIMIT 1
    )
    WHERE dn.org_id IS NULL;

    UPDATE deal_notes SET org_id = default_org_id WHERE org_id IS NULL;
  END IF;

  -- Contact notes: use contact_id to find contact's org
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contact_notes') THEN
    UPDATE contact_notes cn
    SET org_id = (
      SELECT c.org_id
      FROM contacts c
      WHERE c.id = cn.contact_id
      LIMIT 1
    )
    WHERE cn.org_id IS NULL;

    UPDATE contact_notes SET org_id = default_org_id WHERE org_id IS NULL;
  END IF;

  -- Company notes: use company_id to find company's org
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'company_notes') THEN
    UPDATE company_notes comn
    SET org_id = (
      SELECT co.org_id
      FROM companies co
      WHERE co.id = comn.company_id
      LIMIT 1
    )
    WHERE comn.org_id IS NULL;

    UPDATE company_notes SET org_id = default_org_id WHERE org_id IS NULL;
  END IF;

  -- Google integrations: use user_id to find user's org
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'google_integrations') THEN
    UPDATE google_integrations gi
    SET org_id = (
      SELECT om.org_id
      FROM organization_memberships om
      WHERE om.user_id = gi.user_id
      LIMIT 1
    )
    WHERE gi.org_id IS NULL;

    UPDATE google_integrations SET org_id = default_org_id WHERE org_id IS NULL;
  END IF;

END $$;

-- Now make org_id NOT NULL on all tenant tables (only if table and column exist)
SELECT set_not_null_if_exists('deals', 'org_id');
SELECT set_not_null_if_exists('tasks', 'org_id');
SELECT set_not_null_if_exists('activities', 'org_id');
SELECT set_not_null_if_exists('contacts', 'org_id');
SELECT set_not_null_if_exists('companies', 'org_id');
SELECT set_not_null_if_exists('leads', 'org_id');
SELECT set_not_null_if_exists('clients', 'org_id');
SELECT set_not_null_if_exists('meetings', 'org_id');
SELECT set_not_null_if_exists('calendar_events', 'org_id');
SELECT set_not_null_if_exists('calendar_calendars', 'org_id');
SELECT set_not_null_if_exists('deal_splits', 'org_id');
SELECT set_not_null_if_exists('lead_prep_notes', 'org_id');
SELECT set_not_null_if_exists('workflow_executions', 'org_id');
SELECT set_not_null_if_exists('user_automation_rules', 'org_id');
SELECT set_not_null_if_exists('smart_task_templates', 'org_id');
SELECT set_not_null_if_exists('deal_notes', 'org_id');
SELECT set_not_null_if_exists('contact_notes', 'org_id');
SELECT set_not_null_if_exists('company_notes', 'org_id');
SELECT set_not_null_if_exists('google_integrations', 'org_id');

-- Clean up helper functions
DROP FUNCTION IF EXISTS execute_update_if_table_exists(TEXT, TEXT);
DROP FUNCTION IF EXISTS set_not_null_if_exists(TEXT, TEXT);

-- Comments
COMMENT ON TABLE organizations IS 'Default organization created for existing data migration. All existing users are members with owner role.';
