-- Multi-Tenant Architecture: Add org_id to tenant-scoped tables
-- This migration adds org_id column to all tables that store tenant data
-- Initially nullable to allow backfilling, will be made NOT NULL in backfill migration

-- Core CRM tables
ALTER TABLE deals ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Meetings table (uses owner_user_id, not user_id)
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Calendar tables
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE calendar_calendars ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Deal-related tables
ALTER TABLE deal_splits ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Lead-related tables
ALTER TABLE lead_prep_notes ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Workflow and automation tables
ALTER TABLE workflow_executions ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE user_automation_rules ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE smart_task_templates ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Notes tables
ALTER TABLE deal_notes ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE contact_notes ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE company_notes ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Meeting-related tables (if they exist and are tenant-scoped)
-- Note: meeting_attendees and meeting_action_items are linked via meeting_id, so they inherit org_id through meetings
-- meeting_topics might need org_id if it's tenant-scoped

-- Google integration tables (tenant-scoped)
ALTER TABLE google_integrations ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Indexes for performance (org_id will be used in WHERE clauses frequently)
CREATE INDEX IF NOT EXISTS idx_deals_org_id ON deals(org_id);
CREATE INDEX IF NOT EXISTS idx_deals_org_id_created_at ON deals(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_org_id ON tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org_id_created_at ON tasks(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activities_org_id ON activities(org_id);
CREATE INDEX IF NOT EXISTS idx_activities_org_id_created_at ON activities(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_contacts_org_id ON contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_contacts_org_id_created_at ON contacts(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_companies_org_id ON companies(org_id);
CREATE INDEX IF NOT EXISTS idx_companies_org_id_created_at ON companies(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_leads_org_id ON leads(org_id);
CREATE INDEX IF NOT EXISTS idx_leads_org_id_created_at ON leads(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_clients_org_id ON clients(org_id);
CREATE INDEX IF NOT EXISTS idx_meetings_org_id ON meetings(org_id);
CREATE INDEX IF NOT EXISTS idx_meetings_org_id_created_at ON meetings(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_org_id ON calendar_events(org_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_org_id_created_at ON calendar_events(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_calendar_calendars_org_id ON calendar_calendars(org_id);
CREATE INDEX IF NOT EXISTS idx_deal_splits_org_id ON deal_splits(org_id);
CREATE INDEX IF NOT EXISTS idx_lead_prep_notes_org_id ON lead_prep_notes(org_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_org_id ON workflow_executions(org_id);
CREATE INDEX IF NOT EXISTS idx_user_automation_rules_org_id ON user_automation_rules(org_id);
CREATE INDEX IF NOT EXISTS idx_smart_task_templates_org_id ON smart_task_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_google_integrations_org_id ON google_integrations(org_id);

-- Comments for documentation
COMMENT ON COLUMN deals.org_id IS 'Organization (tenant) that owns this deal';
COMMENT ON COLUMN tasks.org_id IS 'Organization (tenant) that owns this task';
COMMENT ON COLUMN activities.org_id IS 'Organization (tenant) that owns this activity';
COMMENT ON COLUMN contacts.org_id IS 'Organization (tenant) that owns this contact';
COMMENT ON COLUMN companies.org_id IS 'Organization (tenant) that owns this company';
COMMENT ON COLUMN leads.org_id IS 'Organization (tenant) that owns this lead';
COMMENT ON COLUMN meetings.org_id IS 'Organization (tenant) that owns this meeting';
COMMENT ON COLUMN calendar_events.org_id IS 'Organization (tenant) that owns this calendar event';











