-- ============================================================================
-- CUSTOMER DATABASE SCHEMA INITIALIZATION
-- ============================================================================
-- This script initializes a new customer-specific database with:
-- - Complete CRM schema (organizations, contacts, deals, activities, tasks)
-- - Row-Level Security (RLS) for multi-organization isolation within customer
-- - Automatic timestamps and audit triggers
-- - Indexes for performance optimization
-- - Smart task generation triggers
--
-- This same schema is used for all customer databases, with RLS enforcing
-- that each organization only sees its own data.
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For full-text search

-- ============================================================================
-- CUSTOM TYPES
-- ============================================================================

CREATE TYPE pipeline_stage AS ENUM (
  'sql',
  'opportunity',
  'verbal',
  'signed'
);

CREATE TYPE activity_type AS ENUM (
  'call',
  'email',
  'meeting',
  'proposal',
  'task',
  'note'
);

CREATE TYPE task_status AS ENUM (
  'open',
  'in_progress',
  'completed',
  'canceled'
);

CREATE TYPE task_priority AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

CREATE TYPE workflow_status AS ENUM (
  'draft',
  'active',
  'paused',
  'archived'
);

-- ============================================================================
-- TABLE: ORGANIZATIONS (Multi-organization within customer)
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  logo_url TEXT,
  website VARCHAR(255),
  industry VARCHAR(100),

  -- Settings
  timezone VARCHAR(50) DEFAULT 'UTC',
  currency VARCHAR(3) DEFAULT 'USD',

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_organizations_name ON organizations(name);

-- ============================================================================
-- TABLE: USERS (Team members)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- User Info
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  avatar_url TEXT,

  -- Permissions
  role VARCHAR(50) DEFAULT 'user', -- 'admin', 'user', 'viewer'
  is_admin BOOLEAN DEFAULT false,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(org_id, email)
);

CREATE INDEX idx_users_org_id ON users(org_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(org_id, role);

-- ============================================================================
-- TABLE: CONTACTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,

  -- Contact Info
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  company VARCHAR(255),
  job_title VARCHAR(100),

  -- Additional Info
  notes TEXT,
  linkedin_url VARCHAR(255),
  twitter_handle VARCHAR(100),

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_contacts_org_id ON contacts(org_id);
CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_contacts_email ON contacts(org_id, email);
CREATE INDEX idx_contacts_company ON contacts(org_id, company);
CREATE INDEX idx_contacts_search ON contacts USING gin(to_tsvector('english', first_name || ' ' || last_name || ' ' || COALESCE(company, '')));

-- ============================================================================
-- TABLE: DEALS
-- ============================================================================

CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

  -- Deal Info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  company_name VARCHAR(255),

  -- Deal Value
  one_off_revenue DECIMAL(12, 2) DEFAULT 0,
  mrr DECIMAL(12, 2) DEFAULT 0, -- Monthly Recurring Revenue
  ltv DECIMAL(12, 2) GENERATED ALWAYS AS ((mrr * 3) + one_off_revenue) STORED,

  -- Pipeline
  stage pipeline_stage DEFAULT 'sql'::pipeline_stage,

  -- Dates
  expected_close_date DATE,
  closed_at TIMESTAMP,

  -- Revenue Split (for admin use)
  is_split_deal BOOLEAN DEFAULT false,
  split_data JSONB, -- Stores split information

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT valid_revenue CHECK (one_off_revenue >= 0 AND mrr >= 0)
);

CREATE INDEX idx_deals_org_id ON deals(org_id);
CREATE INDEX idx_deals_user_id ON deals(user_id);
CREATE INDEX idx_deals_contact_id ON deals(contact_id);
CREATE INDEX idx_deals_stage ON deals(org_id, stage);
CREATE INDEX idx_deals_closed ON deals(org_id, closed_at) WHERE closed_at IS NOT NULL;
CREATE INDEX idx_deals_ltv ON deals(org_id, ltv);

-- ============================================================================
-- TABLE: ACTIVITIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

  -- Activity Info
  type activity_type NOT NULL,
  subject VARCHAR(255),
  description TEXT,

  -- Details
  duration_minutes INT,
  notes TEXT,

  -- Dates
  activity_date TIMESTAMP NOT NULL,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activities_org_id ON activities(org_id);
CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_activities_deal_id ON activities(deal_id);
CREATE INDEX idx_activities_contact_id ON activities(contact_id);
CREATE INDEX idx_activities_type ON activities(org_id, type);
CREATE INDEX idx_activities_date ON activities(org_id, activity_date DESC);

-- ============================================================================
-- TABLE: TASKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

  -- Task Info
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- Status & Priority
  status task_status DEFAULT 'open'::task_status,
  priority task_priority DEFAULT 'medium'::task_priority,

  -- Dates
  due_date DATE,
  completed_at TIMESTAMP,

  -- Reminders
  remind_at TIMESTAMP,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tasks_org_id ON tasks(org_id);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_deal_id ON tasks(deal_id);
CREATE INDEX idx_tasks_contact_id ON tasks(contact_id);
CREATE INDEX idx_tasks_status ON tasks(org_id, status);
CREATE INDEX idx_tasks_priority ON tasks(org_id, priority);
CREATE INDEX idx_tasks_due_date ON tasks(org_id, due_date) WHERE status != 'completed'::task_status;

-- ============================================================================
-- TABLE: CALENDAR EVENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

  -- Event Info
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(255),

  -- External Integration
  external_id VARCHAR(255), -- Google Calendar event ID
  external_source VARCHAR(50), -- 'google_calendar', 'outlook', etc

  -- Dates
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  is_all_day BOOLEAN DEFAULT false,

  -- Recurrence (simple support)
  recurrence_rule TEXT,

  -- Attendees (JSON array)
  attendees JSONB DEFAULT '[]'::jsonb,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT valid_dates CHECK (end_time > start_time),
  UNIQUE(org_id, user_id, external_id)
);

CREATE INDEX idx_calendar_events_org_id ON calendar_events(org_id);
CREATE INDEX idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX idx_calendar_events_deal_id ON calendar_events(deal_id);
CREATE INDEX idx_calendar_events_contact_id ON calendar_events(contact_id);
CREATE INDEX idx_calendar_events_date ON calendar_events(org_id, start_time);

-- ============================================================================
-- TABLE: SMART TASK TEMPLATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS smart_task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Template Info
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Trigger Condition
  trigger_activity_type activity_type NOT NULL,
  trigger_match_notes TEXT, -- Optional: only trigger if notes contain this

  -- Task to Create
  task_title VARCHAR(255) NOT NULL,
  task_description TEXT,
  task_priority task_priority DEFAULT 'medium'::task_priority,

  -- Delay before creating task
  delay_days INT DEFAULT 3,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_smart_task_templates_org_id ON smart_task_templates(org_id);
CREATE INDEX idx_smart_task_templates_active ON smart_task_templates(org_id, is_active);

-- ============================================================================
-- TABLE: WORKFLOWS
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,

  -- Workflow Info
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Configuration (stored as JSON)
  trigger JSONB NOT NULL, -- What event triggers this
  actions JSONB NOT NULL, -- Array of actions to perform

  -- Status
  status workflow_status DEFAULT 'draft'::workflow_status,

  -- Usage Tracking
  execution_count INT DEFAULT 0,
  last_executed_at TIMESTAMP,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_workflows_org_id ON workflows(org_id);
CREATE INDEX idx_workflows_user_id ON workflows(user_id);
CREATE INDEX idx_workflows_status ON workflows(org_id, status);

-- ============================================================================
-- TABLE: WORKFLOW EXECUTIONS (Audit trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

  -- Execution Info
  status VARCHAR(50) NOT NULL, -- 'success', 'failed', 'partial'
  error_message TEXT,

  -- Results
  results JSONB, -- JSON object with action results

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_workflow_executions_org_id ON workflow_executions(org_id);
CREATE INDEX idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_date ON workflow_executions(org_id, created_at DESC);

-- ============================================================================
-- TABLE: AUDIT LOG (Activity for this customer)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,

  -- Action Info
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),

  -- Changes
  old_values JSONB,
  new_values JSONB,

  -- Metadata
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_org_id ON audit_logs(org_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(org_id, action);
CREATE INDEX idx_audit_logs_created ON audit_logs(org_id, created_at DESC);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Update updated_at timestamp on any UPDATE
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-create follow-up task from activities using smart templates
CREATE OR REPLACE FUNCTION trigger_smart_task_creation()
RETURNS TRIGGER AS $$
DECLARE
  v_template RECORD;
BEGIN
  -- Find matching smart task templates
  FOR v_template IN
    SELECT * FROM smart_task_templates
    WHERE org_id = NEW.org_id
      AND trigger_activity_type = NEW.type
      AND is_active = true
  LOOP
    -- Create task with delay
    INSERT INTO tasks (
      org_id, user_id, deal_id, contact_id,
      title, description, priority,
      due_date, created_at
    ) VALUES (
      NEW.org_id,
      NEW.user_id,
      NEW.deal_id,
      NEW.contact_id,
      v_template.task_title,
      v_template.task_description,
      v_template.task_priority,
      CURRENT_DATE + (v_template.delay_days || ' days')::INTERVAL,
      NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update timestamps
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

-- Smart task creation on activity insert
CREATE TRIGGER smart_task_trigger AFTER INSERT ON activities
  FOR EACH ROW EXECUTE FUNCTION trigger_smart_task_creation();

-- ============================================================================
-- INITIAL DATA - Create default organization
-- ============================================================================

INSERT INTO organizations (name, description, timezone, currency)
VALUES (
  'Default Organization',
  'Default organization for this customer',
  'UTC',
  'USD'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View: Deal Summary with Contact and User Info
CREATE OR REPLACE VIEW deal_summary AS
SELECT
  d.id,
  d.org_id,
  d.name,
  d.company_name,
  d.one_off_revenue,
  d.mrr,
  d.ltv,
  d.stage,
  d.expected_close_date,
  d.is_split_deal,
  c.first_name || ' ' || c.last_name as contact_name,
  c.email,
  c.company,
  u.name as owner_name,
  u.email as owner_email,
  d.created_at,
  d.updated_at
FROM deals d
LEFT JOIN contacts c ON d.contact_id = c.id
LEFT JOIN users u ON d.user_id = u.id
ORDER BY d.created_at DESC;

-- View: Pipeline Summary by Stage
CREATE OR REPLACE VIEW pipeline_summary AS
SELECT
  org_id,
  stage,
  COUNT(*) as deal_count,
  SUM(ltv) as total_value,
  AVG(ltv) as avg_deal_value,
  COUNT(CASE WHEN closed_at IS NOT NULL THEN 1 END) as closed_deals
FROM deals
GROUP BY org_id, stage
ORDER BY org_id, stage;

-- View: Task Summary by Status
CREATE OR REPLACE VIEW task_summary AS
SELECT
  org_id,
  status,
  priority,
  COUNT(*) as task_count,
  COUNT(CASE WHEN due_date <= CURRENT_DATE AND status != 'completed'::task_status THEN 1 END) as overdue_count
FROM tasks
GROUP BY org_id, status, priority
ORDER BY org_id, priority DESC, status;

-- ============================================================================
-- END OF CUSTOMER DATABASE INITIALIZATION
-- ============================================================================
