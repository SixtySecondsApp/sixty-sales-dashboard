-- ============================================================================
-- Database Initialization Script for Multi-Tenant SaaS
-- ============================================================================
-- This script runs automatically when the PostgreSQL container starts
-- It creates the schema, tables, and Row-Level Security (RLS) policies
-- Each customer has their own database with full isolation

-- ============================================================================
-- PART 1: Extensions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ============================================================================
-- PART 2: Custom Types
-- ============================================================================

CREATE TYPE pipeline_stage AS ENUM (
  'SQL',
  'Opportunity',
  'Verbal',
  'Signed'
);

CREATE TYPE activity_type AS ENUM (
  'call',
  'meeting',
  'email',
  'proposal',
  'follow-up',
  'note'
);

CREATE TYPE task_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'cancelled'
);

CREATE TYPE workflow_status AS ENUM (
  'active',
  'paused',
  'completed',
  'failed'
);

-- ============================================================================
-- PART 3: Auth Schema & Functions
-- ============================================================================

-- Create auth schema for authentication context
CREATE SCHEMA IF NOT EXISTS auth;

-- Function to get current authenticated user ID from JWT
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb->>'sub'::uuid;
$$ LANGUAGE SQL STABLE;

-- Function to get current user's organization
CREATE OR REPLACE FUNCTION auth.current_user_id() RETURNS uuid AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid,
    current_user_id()
  );
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- PART 4: Core Tables
-- ============================================================================

-- Organizations/Tenants Table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  logo_url VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_organizations_slug ON organizations(slug);

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  avatar_url VARCHAR(500),
  is_admin BOOLEAN DEFAULT false,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_org_id ON users(org_id);
CREATE INDEX idx_users_email ON users(email);

-- Contacts Table
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),
  company_name VARCHAR(255),
  title VARCHAR(255),
  notes TEXT,
  is_lead BOOLEAN DEFAULT false,
  source VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contacts_org_id ON contacts(org_id);
CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_company ON contacts(company_name);

-- Deals Table
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_name VARCHAR(255),
  deal_name VARCHAR(255) NOT NULL,
  deal_value DECIMAL(15, 2),
  one_off_revenue DECIMAL(15, 2) DEFAULT 0,
  monthly_recurring_revenue DECIMAL(15, 2) DEFAULT 0,
  stage pipeline_stage DEFAULT 'SQL',
  probability INT DEFAULT 0,
  expected_close_date DATE,
  notes TEXT,
  is_split_deal BOOLEAN DEFAULT false,
  stage_migration_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_deals_org_id ON deals(org_id);
CREATE INDEX idx_deals_user_id ON deals(user_id);
CREATE INDEX idx_deals_contact_id ON deals(contact_id);
CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_deals_expected_close_date ON deals(expected_close_date);

-- Activities Table (calls, emails, meetings, proposals)
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  type activity_type NOT NULL,
  title VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activities_org_id ON activities(org_id);
CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_activities_deal_id ON activities(deal_id);
CREATE INDEX idx_activities_contact_id ON activities(contact_id);
CREATE INDEX idx_activities_type ON activities(type);

-- Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status task_status DEFAULT 'pending',
  priority INT DEFAULT 0,
  due_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tasks_org_id ON tasks(org_id);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_deal_id ON tasks(deal_id);
CREATE INDEX idx_tasks_contact_id ON tasks(contact_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

-- Google Calendar Events Table
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  external_id VARCHAR(500) NOT NULL,
  title VARCHAR(500),
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  is_all_day BOOLEAN DEFAULT false,
  location VARCHAR(255),
  attendees JSONB,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, external_id)
);

CREATE INDEX idx_calendar_events_org_id ON calendar_events(org_id);
CREATE INDEX idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX idx_calendar_events_contact_id ON calendar_events(contact_id);
CREATE INDEX idx_calendar_events_start_time ON calendar_events(start_time);

-- Smart Task Templates Table
CREATE TABLE IF NOT EXISTS smart_task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_activity_type activity_type NOT NULL,
  task_title VARCHAR(255) NOT NULL,
  task_description TEXT,
  delay_days INT DEFAULT 3,
  priority INT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_smart_task_templates_org_id ON smart_task_templates(org_id);
CREATE INDEX idx_smart_task_templates_is_active ON smart_task_templates(is_active);

-- Workflows Table
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  definition JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_workflows_org_id ON workflows(org_id);
CREATE INDEX idx_workflows_user_id ON workflows(user_id);

-- ============================================================================
-- PART 5: Row-Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

-- Organizations: Users can only see their own org
CREATE POLICY organizations_select ON organizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.org_id = organizations.id
      AND users.id = auth.uid()
    )
  );

-- Users: Users can only see users in their organization
CREATE POLICY users_select ON users
  FOR SELECT USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY users_insert ON users
  FOR INSERT WITH CHECK (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY users_update ON users
  FOR UPDATE USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- Contacts: Users can only see contacts in their organization
CREATE POLICY contacts_select ON contacts
  FOR SELECT USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY contacts_insert ON contacts
  FOR INSERT WITH CHECK (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY contacts_update ON contacts
  FOR UPDATE USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY contacts_delete ON contacts
  FOR DELETE USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- Deals: Users can only see deals in their organization
CREATE POLICY deals_select ON deals
  FOR SELECT USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY deals_insert ON deals
  FOR INSERT WITH CHECK (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY deals_update ON deals
  FOR UPDATE USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY deals_delete ON deals
  FOR DELETE USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_id = auth.uid()
  );

-- Activities: Users can only see activities in their organization
CREATE POLICY activities_select ON activities
  FOR SELECT USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY activities_insert ON activities
  FOR INSERT WITH CHECK (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY activities_update ON activities
  FOR UPDATE USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- Tasks: Users can only see tasks in their organization
CREATE POLICY tasks_select ON tasks
  FOR SELECT USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY tasks_insert ON tasks
  FOR INSERT WITH CHECK (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY tasks_update ON tasks
  FOR UPDATE USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- Calendar Events: Users can only see their own events
CREATE POLICY calendar_events_select ON calendar_events
  FOR SELECT USING (
    user_id = auth.uid()
  );

CREATE POLICY calendar_events_insert ON calendar_events
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

CREATE POLICY calendar_events_update ON calendar_events
  FOR UPDATE USING (
    user_id = auth.uid()
  );

CREATE POLICY calendar_events_delete ON calendar_events
  FOR DELETE USING (
    user_id = auth.uid()
  );

-- Smart Task Templates: Only admins can manage, but all can select
CREATE POLICY smart_task_templates_select ON smart_task_templates
  FOR SELECT USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY smart_task_templates_insert ON smart_task_templates
  FOR INSERT WITH CHECK (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
    AND (SELECT is_admin FROM users WHERE id = auth.uid())
  );

CREATE POLICY smart_task_templates_update ON smart_task_templates
  FOR UPDATE USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
    AND (SELECT is_admin FROM users WHERE id = auth.uid())
  );

-- Workflows: Users can only see workflows in their organization
CREATE POLICY workflows_select ON workflows
  FOR SELECT USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY workflows_insert ON workflows
  FOR INSERT WITH CHECK (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY workflows_update ON workflows
  FOR UPDATE USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- ============================================================================
-- PART 6: Seed Data (Optional - one organization and admin user)
-- ============================================================================

INSERT INTO organizations (id, name, slug, description)
VALUES (gen_random_uuid(), 'Default Organization', 'default-org', 'Default organization for this customer')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PART 7: Triggers & Functions
-- ============================================================================

-- Update updated_at timestamp on all tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all tables
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_smart_task_templates_updated_at BEFORE UPDATE ON smart_task_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Automatically create follow-up tasks from smart task templates
CREATE OR REPLACE FUNCTION trigger_smart_task_creation()
RETURNS TRIGGER AS $$
DECLARE
  template RECORD;
  follow_up_date DATE;
BEGIN
  -- Find matching templates for this activity type
  FOR template IN
    SELECT * FROM smart_task_templates
    WHERE org_id = NEW.org_id
    AND trigger_activity_type = NEW.type
    AND is_active = true
  LOOP
    -- Calculate follow-up date
    follow_up_date := CURRENT_DATE + (template.delay_days || ' days')::INTERVAL;

    -- Create task
    INSERT INTO tasks (
      org_id, user_id, deal_id, contact_id,
      title, description, status, priority, due_date
    ) VALUES (
      NEW.org_id,
      NEW.user_id,
      NEW.deal_id,
      NEW.contact_id,
      template.task_title,
      template.task_description,
      'pending',
      template.priority,
      follow_up_date
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER smart_task_trigger AFTER INSERT ON activities
  FOR EACH ROW EXECUTE FUNCTION trigger_smart_task_creation();

-- ============================================================================
-- PART 8: Initialize Default Organization
-- ============================================================================

-- Get or create default organization
DO $$
DECLARE
  default_org_id UUID;
BEGIN
  -- Check if organizations table has any records
  IF NOT EXISTS (SELECT 1 FROM organizations LIMIT 1) THEN
    INSERT INTO organizations (name, slug, description)
    VALUES ('Default Customer Organization', 'customer-default', 'Auto-created default organization')
    RETURNING id INTO default_org_id;
  END IF;
END $$;

-- ============================================================================
-- PART 9: Summary
-- ============================================================================
-- This script creates a complete multi-tenant database with:
-- - Organizations (tenants) for complete data isolation
-- - Users with admin roles
-- - Contacts, Deals, Activities, Tasks for CRM functionality
-- - Calendar events for Google Calendar integration
-- - Smart task templates for automation
-- - Workflows for custom automation
-- - RLS policies for row-level security on all tables
-- - Triggers for automatic timestamp updates and smart task creation
-- - All data is automatically org-isolated
-- ============================================================================
