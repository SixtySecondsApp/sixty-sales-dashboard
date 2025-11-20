-- Multi-Tenant Architecture: Backfill existing data with default organization
-- This migration creates a default organization and assigns all existing data to it

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
  
  -- Backfill org_id for all tenant tables
  -- Use the owner's org_id based on user_id/owner_user_id
  
  -- Deals: use owner_id to find user's org
  UPDATE deals d
  SET org_id = (
    SELECT om.org_id 
    FROM organization_memberships om 
    WHERE om.user_id = d.owner_id 
    LIMIT 1
  )
  WHERE d.org_id IS NULL;
  
  -- Tasks: use user_id to find user's org
  UPDATE tasks t
  SET org_id = (
    SELECT om.org_id 
    FROM organization_memberships om 
    WHERE om.user_id = t.user_id 
    LIMIT 1
  )
  WHERE t.org_id IS NULL;
  
  -- Activities: use user_id to find user's org
  UPDATE activities a
  SET org_id = (
    SELECT om.org_id 
    FROM organization_memberships om 
    WHERE om.user_id = a.user_id 
    LIMIT 1
  )
  WHERE a.org_id IS NULL;
  
  -- Contacts: use user_id to find user's org
  UPDATE contacts c
  SET org_id = (
    SELECT om.org_id 
    FROM organization_memberships om 
    WHERE om.user_id = c.user_id 
    LIMIT 1
  )
  WHERE c.org_id IS NULL;
  
  -- Companies: use user_id (or owner_id if exists) to find user's org
  UPDATE companies co
  SET org_id = COALESCE(
    (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = co.user_id LIMIT 1),
    (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = co.owner_id LIMIT 1)
  )
  WHERE co.org_id IS NULL;
  
  -- Leads: use owner_id to find user's org
  UPDATE leads l
  SET org_id = (
    SELECT om.org_id 
    FROM organization_memberships om 
    WHERE om.user_id = l.owner_id 
    LIMIT 1
  )
  WHERE l.org_id IS NULL;
  
  -- Clients: use owner_id to find user's org
  UPDATE clients cl
  SET org_id = (
    SELECT om.org_id 
    FROM organization_memberships om 
    WHERE om.user_id = cl.owner_id 
    LIMIT 1
  )
  WHERE cl.org_id IS NULL;
  
  -- Meetings: use owner_user_id (NOT user_id!) to find user's org
  UPDATE meetings m
  SET org_id = (
    SELECT om.org_id 
    FROM organization_memberships om 
    WHERE om.user_id = m.owner_user_id 
    LIMIT 1
  )
  WHERE m.org_id IS NULL;
  
  -- Calendar events: use user_id to find user's org
  UPDATE calendar_events ce
  SET org_id = (
    SELECT om.org_id 
    FROM organization_memberships om 
    WHERE om.user_id = ce.user_id 
    LIMIT 1
  )
  WHERE ce.org_id IS NULL;
  
  -- Calendar calendars: use user_id to find user's org
  UPDATE calendar_calendars cc
  SET org_id = (
    SELECT om.org_id 
    FROM organization_memberships om 
    WHERE om.user_id = cc.user_id 
    LIMIT 1
  )
  WHERE cc.org_id IS NULL;
  
  -- Deal splits: use deal_id to find deal's org
  UPDATE deal_splits ds
  SET org_id = (
    SELECT d.org_id 
    FROM deals d 
    WHERE d.id = ds.deal_id 
    LIMIT 1
  )
  WHERE ds.org_id IS NULL;
  
  -- Lead prep notes: use lead_id to find lead's org
  UPDATE lead_prep_notes lpn
  SET org_id = (
    SELECT l.org_id 
    FROM leads l 
    WHERE l.id = lpn.lead_id 
    LIMIT 1
  )
  WHERE lpn.org_id IS NULL;
  
  -- Workflow executions: use user_id to find user's org
  UPDATE workflow_executions we
  SET org_id = (
    SELECT om.org_id 
    FROM organization_memberships om 
    WHERE om.user_id = we.user_id 
    LIMIT 1
  )
  WHERE we.org_id IS NULL;
  
  -- User automation rules: use user_id to find user's org
  UPDATE user_automation_rules uar
  SET org_id = (
    SELECT om.org_id 
    FROM organization_memberships om 
    WHERE om.user_id = uar.user_id 
    LIMIT 1
  )
  WHERE uar.org_id IS NULL;
  
  -- Smart task templates: use user_id to find user's org
  UPDATE smart_task_templates stt
  SET org_id = (
    SELECT om.org_id 
    FROM organization_memberships om 
    WHERE om.user_id = stt.user_id 
    LIMIT 1
  )
  WHERE stt.org_id IS NULL;
  
  -- Deal notes: use deal_id to find deal's org
  UPDATE deal_notes dn
  SET org_id = (
    SELECT d.org_id 
    FROM deals d 
    WHERE d.id = dn.deal_id 
    LIMIT 1
  )
  WHERE dn.org_id IS NULL;
  
  -- Contact notes: use contact_id to find contact's org
  UPDATE contact_notes cn
  SET org_id = (
    SELECT c.org_id 
    FROM contacts c 
    WHERE c.id = cn.contact_id 
    LIMIT 1
  )
  WHERE cn.org_id IS NULL;
  
  -- Company notes: use company_id to find company's org
  UPDATE company_notes comn
  SET org_id = (
    SELECT co.org_id 
    FROM companies co 
    WHERE co.id = comn.company_id 
    LIMIT 1
  )
  WHERE comn.org_id IS NULL;
  
  -- Google integrations: use user_id to find user's org
  UPDATE google_integrations gi
  SET org_id = (
    SELECT om.org_id 
    FROM organization_memberships om 
    WHERE om.user_id = gi.user_id 
    LIMIT 1
  )
  WHERE gi.org_id IS NULL;
  
  -- For any remaining NULL org_id values, assign to default org
  -- This handles edge cases where user_id/owner_id might be NULL or user doesn't exist
  UPDATE deals SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE tasks SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE activities SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE contacts SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE companies SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE leads SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE clients SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE meetings SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE calendar_events SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE calendar_calendars SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE deal_splits SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE lead_prep_notes SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE workflow_executions SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE user_automation_rules SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE smart_task_templates SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE deal_notes SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE contact_notes SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE company_notes SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE google_integrations SET org_id = default_org_id WHERE org_id IS NULL;
  
END $$;

-- Now make org_id NOT NULL on all tenant tables
ALTER TABLE deals ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE tasks ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE activities ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE contacts ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE companies ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE leads ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE clients ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE meetings ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE calendar_events ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE calendar_calendars ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE deal_splits ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE lead_prep_notes ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE workflow_executions ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE user_automation_rules ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE smart_task_templates ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE deal_notes ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE contact_notes ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE company_notes ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE google_integrations ALTER COLUMN org_id SET NOT NULL;

-- Comments
COMMENT ON TABLE organizations IS 'Default organization created for existing data migration. All existing users are members with owner role.';












