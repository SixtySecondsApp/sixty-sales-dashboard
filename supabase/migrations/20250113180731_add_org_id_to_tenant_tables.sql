-- Multi-Tenant Architecture: Add org_id to tenant-scoped tables
-- This migration adds org_id column to all tables that store tenant data
-- Initially nullable to allow backfilling, will be made NOT NULL in backfill migration
-- NOTE: Uses conditional logic because some tables may be created in later migrations

-- Helper function to add org_id column if table exists
CREATE OR REPLACE FUNCTION add_org_id_if_table_exists(p_table_name TEXT)
RETURNS VOID AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = p_table_name) THEN
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE', p_table_name);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Helper function to create index if table exists
CREATE OR REPLACE FUNCTION create_org_id_index_if_table_exists(p_table_name TEXT)
RETURNS VOID AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = p_table_name) THEN
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_org_id ON %I(org_id)', p_table_name, p_table_name);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Helper function to create composite index if table exists
CREATE OR REPLACE FUNCTION create_org_id_created_at_index_if_table_exists(p_table_name TEXT)
RETURNS VOID AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = p_table_name
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = p_table_name AND column_name = 'created_at'
  ) THEN
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_org_id_created_at ON %I(org_id, created_at)', p_table_name, p_table_name);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Add org_id to Core CRM tables (if they exist)
SELECT add_org_id_if_table_exists('deals');
SELECT add_org_id_if_table_exists('tasks');
SELECT add_org_id_if_table_exists('activities');
SELECT add_org_id_if_table_exists('contacts');
SELECT add_org_id_if_table_exists('companies');
SELECT add_org_id_if_table_exists('leads');
SELECT add_org_id_if_table_exists('clients');

-- Meetings table (uses owner_user_id, not user_id)
SELECT add_org_id_if_table_exists('meetings');

-- Calendar tables
SELECT add_org_id_if_table_exists('calendar_events');
SELECT add_org_id_if_table_exists('calendar_calendars');

-- Deal-related tables
SELECT add_org_id_if_table_exists('deal_splits');

-- Lead-related tables
SELECT add_org_id_if_table_exists('lead_prep_notes');

-- Workflow and automation tables
SELECT add_org_id_if_table_exists('workflow_executions');
SELECT add_org_id_if_table_exists('user_automation_rules');
SELECT add_org_id_if_table_exists('smart_task_templates');

-- Notes tables
SELECT add_org_id_if_table_exists('deal_notes');
SELECT add_org_id_if_table_exists('contact_notes');
SELECT add_org_id_if_table_exists('company_notes');

-- Google integration tables (tenant-scoped)
SELECT add_org_id_if_table_exists('google_integrations');

-- Create indexes for performance (org_id will be used in WHERE clauses frequently)
SELECT create_org_id_index_if_table_exists('deals');
SELECT create_org_id_created_at_index_if_table_exists('deals');
SELECT create_org_id_index_if_table_exists('tasks');
SELECT create_org_id_created_at_index_if_table_exists('tasks');
SELECT create_org_id_index_if_table_exists('activities');
SELECT create_org_id_created_at_index_if_table_exists('activities');
SELECT create_org_id_index_if_table_exists('contacts');
SELECT create_org_id_created_at_index_if_table_exists('contacts');
SELECT create_org_id_index_if_table_exists('companies');
SELECT create_org_id_created_at_index_if_table_exists('companies');
SELECT create_org_id_index_if_table_exists('leads');
SELECT create_org_id_created_at_index_if_table_exists('leads');
SELECT create_org_id_index_if_table_exists('clients');
SELECT create_org_id_index_if_table_exists('meetings');
SELECT create_org_id_created_at_index_if_table_exists('meetings');
SELECT create_org_id_index_if_table_exists('calendar_events');
SELECT create_org_id_created_at_index_if_table_exists('calendar_events');
SELECT create_org_id_index_if_table_exists('calendar_calendars');
SELECT create_org_id_index_if_table_exists('deal_splits');
SELECT create_org_id_index_if_table_exists('lead_prep_notes');
SELECT create_org_id_index_if_table_exists('workflow_executions');
SELECT create_org_id_index_if_table_exists('user_automation_rules');
SELECT create_org_id_index_if_table_exists('smart_task_templates');
SELECT create_org_id_index_if_table_exists('google_integrations');

-- Helper function to add comment if column exists
CREATE OR REPLACE FUNCTION add_org_id_comment_if_exists(p_table_name TEXT, p_comment TEXT)
RETURNS VOID AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = p_table_name AND column_name = 'org_id'
  ) THEN
    EXECUTE format('COMMENT ON COLUMN %I.org_id IS %L', p_table_name, p_comment);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation (only if column was added)
SELECT add_org_id_comment_if_exists('deals', 'Organization (tenant) that owns this deal');
SELECT add_org_id_comment_if_exists('tasks', 'Organization (tenant) that owns this task');
SELECT add_org_id_comment_if_exists('activities', 'Organization (tenant) that owns this activity');
SELECT add_org_id_comment_if_exists('contacts', 'Organization (tenant) that owns this contact');
SELECT add_org_id_comment_if_exists('companies', 'Organization (tenant) that owns this company');
SELECT add_org_id_comment_if_exists('leads', 'Organization (tenant) that owns this lead');
SELECT add_org_id_comment_if_exists('meetings', 'Organization (tenant) that owns this meeting');
SELECT add_org_id_comment_if_exists('calendar_events', 'Organization (tenant) that owns this calendar event');

-- Clean up helper functions (they're only needed for this migration)
DROP FUNCTION IF EXISTS add_org_id_if_table_exists(TEXT);
DROP FUNCTION IF EXISTS create_org_id_index_if_table_exists(TEXT);
DROP FUNCTION IF EXISTS create_org_id_created_at_index_if_table_exists(TEXT);
DROP FUNCTION IF EXISTS add_org_id_comment_if_exists(TEXT, TEXT);
