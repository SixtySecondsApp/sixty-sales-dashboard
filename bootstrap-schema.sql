-- ============================================================================
-- SIXTY SALES DASHBOARD - BOOTSTRAP SCHEMA
-- ============================================================================
-- This file combines essential migrations for bootstrapping a new database
-- Run this in Supabase SQL Editor to set up the development environment
--
-- Combined from migrations:
-- 1. 20250126124441_lively_butterfly.sql - Core tables (profiles, teams, activities)
-- 2. 20250113180730_create_multi_tenant_tables.sql - Organizations & multi-tenancy
-- 3. 20250127120000_create_companies_table.sql - Companies table
-- 4. 20250515_create_pipeline_tables.sql - Deals/pipeline tables
-- 5. 20250601200000_create_tasks_table.sql - Tasks table
-- 6. 20250827_create_meetings_tables.sql - Meetings tables
-- 7. 20250902_fix_all_missing_crm_structures.sql - CRM fixes and contacts
-- 8. 20250905100000_create_workflow_tables.sql - Workflow automation
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;

-- ============================================================================
-- SECTION 1: ENUMS & CUSTOM TYPES
-- ============================================================================

-- Activity types
DO $$ BEGIN
  CREATE TYPE activity_type AS ENUM ('outbound', 'meeting', 'proposal', 'sale');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Activity status
DO $$ BEGIN
  CREATE TYPE activity_status AS ENUM ('pending', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Activity priority
DO $$ BEGIN
  CREATE TYPE activity_priority AS ENUM ('low', 'medium', 'high');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Member role
DO $$ BEGIN
  CREATE TYPE member_role AS ENUM ('member', 'leader', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- SECTION 2: CORE USER TABLES
-- ============================================================================

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  email text UNIQUE NOT NULL,
  stage text,
  avatar_url text,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- SECTION 3: TEAM TABLES
-- ============================================================================

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Team members table
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role member_role DEFAULT 'member',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- ============================================================================
-- SECTION 4: ORGANIZATION TABLES (Multi-Tenancy)
-- ============================================================================

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  CONSTRAINT organizations_name_not_empty CHECK (length(trim(name)) > 0)
);

-- Organization memberships table
CREATE TABLE IF NOT EXISTS organization_memberships (
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'readonly')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

-- Organization invitations table
CREATE TABLE IF NOT EXISTS organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email CITEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'readonly')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_pending_invitation UNIQUE NULLS NOT DISTINCT (org_id, email, accepted_at)
);

-- ============================================================================
-- SECTION 5: CRM CORE TABLES
-- ============================================================================

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT UNIQUE,
  industry TEXT,
  size TEXT CHECK (size IN ('startup', 'small', 'medium', 'large', 'enterprise')),
  website TEXT,
  address TEXT,
  phone TEXT,
  description TEXT,
  linkedin_url TEXT,
  owner_id UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT GENERATED ALWAYS AS (
    CASE
      WHEN first_name IS NOT NULL AND last_name IS NOT NULL THEN first_name || ' ' || last_name
      WHEN first_name IS NOT NULL THEN first_name
      WHEN last_name IS NOT NULL THEN last_name
      ELSE NULL
    END
  ) STORED,
  title TEXT,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES profiles(id),
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- SECTION 6: PIPELINE & DEALS TABLES
-- ============================================================================

-- Deal stages table
CREATE TABLE IF NOT EXISTS deal_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL,
  order_position INTEGER NOT NULL,
  default_probability INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deals table
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  value DECIMAL(12,2) NOT NULL,
  description TEXT,
  stage_id UUID REFERENCES deal_stages(id) NOT NULL,
  owner_id UUID REFERENCES auth.users(id) NOT NULL,
  expected_close_date DATE,
  probability INTEGER,
  status TEXT DEFAULT 'active',
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  primary_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  stage_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deal activities table
CREATE TABLE IF NOT EXISTS deal_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  activity_type TEXT NOT NULL,
  notes TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deal stage history table
CREATE TABLE IF NOT EXISTS deal_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
  stage_id UUID REFERENCES deal_stages(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  entered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  exited_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER
);

-- ============================================================================
-- SECTION 7: ACTIVITIES TABLE
-- ============================================================================

-- Activities table (enhanced with CRM links)
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  type activity_type NOT NULL,
  status activity_status DEFAULT 'pending',
  priority activity_priority DEFAULT 'medium',
  client_name text NOT NULL,
  details text,
  amount decimal(12,2),
  date timestamptz NOT NULL DEFAULT now(),
  avatar_url text,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  auto_matched BOOLEAN DEFAULT false,
  is_processed BOOLEAN DEFAULT false,
  contact_identifier TEXT,
  contact_identifier_type TEXT,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- SECTION 8: TASKS TABLE
-- ============================================================================

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  notes TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'overdue')),
  task_type TEXT DEFAULT 'general' CHECK (task_type IN ('call', 'email', 'meeting', 'follow_up', 'proposal', 'demo', 'general')),
  assigned_to UUID REFERENCES auth.users(id) NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  contact_email TEXT,
  contact_name TEXT,
  company TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (due_date IS NULL OR due_date > created_at),
  CHECK (
    company_id IS NOT NULL OR
    contact_id IS NOT NULL OR
    contact_email IS NOT NULL OR
    deal_id IS NOT NULL
  )
);

-- ============================================================================
-- SECTION 9: MEETINGS TABLES
-- ============================================================================

-- Meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fathom_recording_id TEXT UNIQUE NOT NULL,
  title TEXT,
  share_url TEXT,
  calls_url TEXT,
  meeting_start TIMESTAMPTZ,
  meeting_end TIMESTAMPTZ,
  duration_minutes NUMERIC,
  owner_user_id UUID REFERENCES auth.users(id),
  owner_email TEXT,
  team_name TEXT,
  company_id UUID REFERENCES companies(id),
  primary_contact_id UUID REFERENCES contacts(id),
  summary TEXT,
  transcript_doc_url TEXT,
  sentiment_score NUMERIC CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
  coach_rating NUMERIC CHECK (coach_rating >= 0 AND coach_rating <= 100),
  coach_summary TEXT,
  talk_time_rep_pct NUMERIC,
  talk_time_customer_pct NUMERIC,
  talk_time_judgement TEXT CHECK (talk_time_judgement IN ('good', 'high', 'low')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meeting attendees table
CREATE TABLE IF NOT EXISTS meeting_attendees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  is_external BOOLEAN DEFAULT false,
  role TEXT
);

-- Meeting action items table
CREATE TABLE IF NOT EXISTS meeting_action_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  title TEXT,
  assignee_name TEXT,
  assignee_email TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category TEXT,
  deadline_at TIMESTAMPTZ,
  completed BOOLEAN DEFAULT false,
  ai_generated BOOLEAN DEFAULT false,
  timestamp_seconds NUMERIC,
  playback_url TEXT,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meeting topics table
CREATE TABLE IF NOT EXISTS meeting_topics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  label TEXT
);

-- Meeting metrics table
CREATE TABLE IF NOT EXISTS meeting_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  words_spoken_rep INTEGER,
  words_spoken_customer INTEGER,
  avg_response_latency_ms INTEGER,
  interruption_count INTEGER
);

-- ============================================================================
-- SECTION 10: TARGETS TABLE
-- ============================================================================

-- Targets table
CREATE TABLE IF NOT EXISTS targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  revenue_target decimal(12,2) NOT NULL,
  outbound_target integer NOT NULL,
  meetings_target integer NOT NULL,
  proposal_target integer NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (user_id IS NOT NULL OR team_id IS NOT NULL),
  CHECK (start_date <= end_date)
);

-- ============================================================================
-- SECTION 11: ACTIVITY SYNC RULES TABLE
-- ============================================================================

-- Activity sync rules table
CREATE TABLE IF NOT EXISTS activity_sync_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('sale', 'outbound', 'meeting', 'proposal')),
  min_priority TEXT DEFAULT 'medium' CHECK (min_priority IN ('low', 'medium', 'high')),
  auto_create_deal BOOLEAN DEFAULT false,
  target_stage_name TEXT,
  owner_id UUID REFERENCES profiles(id) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(activity_type, owner_id)
);

-- ============================================================================
-- SECTION 12: WORKFLOW AUTOMATION TABLES
-- ============================================================================

-- User automation rules table
CREATE TABLE IF NOT EXISTS user_automation_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rule_name TEXT NOT NULL,
  rule_description TEXT,
  canvas_data JSONB,
  trigger_type TEXT NOT NULL,
  trigger_conditions JSONB DEFAULT '{}'::jsonb,
  action_type TEXT NOT NULL,
  action_config JSONB DEFAULT '{}'::jsonb,
  template_id TEXT,
  is_active BOOLEAN DEFAULT false,
  priority_level INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- SECTION 13: INDEXES FOR PERFORMANCE
-- ============================================================================

-- Organizations indexes
CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON organizations(created_by);
CREATE INDEX IF NOT EXISTS idx_organizations_is_active ON organizations(is_active);
CREATE INDEX IF NOT EXISTS idx_organizations_created_at ON organizations(created_at);

-- Organization memberships indexes
CREATE INDEX IF NOT EXISTS idx_organization_memberships_user_id ON organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_memberships_org_id ON organization_memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_organization_memberships_role ON organization_memberships(role);

-- Organization invitations indexes
CREATE INDEX IF NOT EXISTS idx_organization_invitations_org_id ON organization_invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_email ON organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_token ON organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_expires_at ON organization_invitations(expires_at) WHERE accepted_at IS NULL;

-- Companies indexes
CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);
CREATE INDEX IF NOT EXISTS idx_companies_owner_id ON companies(owner_id);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);

-- Deals indexes
CREATE INDEX IF NOT EXISTS idx_deals_company_id ON deals(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_primary_contact_id ON deals(primary_contact_id);

-- Activities indexes
CREATE INDEX IF NOT EXISTS idx_activities_company_id ON activities(company_id);
CREATE INDEX IF NOT EXISTS idx_activities_contact_id ON activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_activities_deal_id ON activities(deal_id);

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
CREATE INDEX IF NOT EXISTS idx_tasks_deal_id ON tasks(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON tasks(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_contact_id ON tasks(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_contact_email ON tasks(contact_email) WHERE contact_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_status ON tasks(assigned_to, status) WHERE status != 'completed';
CREATE INDEX IF NOT EXISTS idx_tasks_due_date_status ON tasks(due_date, status) WHERE status NOT IN ('completed', 'cancelled');

-- Meetings indexes
CREATE INDEX IF NOT EXISTS idx_meetings_owner_user_id ON meetings(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_meeting_start ON meetings(meeting_start DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_attendees_email ON meeting_attendees(email);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_assignee_email ON meeting_action_items(assignee_email);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_completed ON meeting_action_items(completed);

-- Workflow automation indexes
CREATE INDEX IF NOT EXISTS idx_user_automation_rules_user_id ON user_automation_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_user_automation_rules_is_active ON user_automation_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_user_automation_rules_trigger_type ON user_automation_rules(trigger_type);

-- ============================================================================
-- SECTION 14: FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, email, stage)
  VALUES (
    new.id,
    split_part(new.raw_user_meta_data->>'full_name', ' ', 1),
    split_part(new.raw_user_meta_data->>'full_name', ' ', 2),
    new.email,
    'Trainee'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_automation_rules_updated_at ON user_automation_rules;
CREATE TRIGGER update_user_automation_rules_updated_at
  BEFORE UPDATE ON user_automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to update overdue tasks
CREATE OR REPLACE FUNCTION update_overdue_tasks()
RETURNS void AS $$
BEGIN
  UPDATE tasks
  SET status = 'overdue'
  WHERE due_date < NOW()
    AND status NOT IN ('completed', 'cancelled')
    AND completed = false;
END;
$$ LANGUAGE plpgsql;

-- Function to sync task contact info from relationships
CREATE OR REPLACE FUNCTION sync_task_contact_info()
RETURNS TRIGGER AS $$
BEGIN
  -- If company_id is set, populate company name
  IF NEW.company_id IS NOT NULL AND (NEW.company IS NULL OR NEW.company = '') THEN
    SELECT name INTO NEW.company
    FROM companies
    WHERE id = NEW.company_id;
  END IF;

  -- If contact_id is set, populate contact info
  IF NEW.contact_id IS NOT NULL THEN
    SELECT
      COALESCE(full_name, CONCAT(first_name, ' ', last_name), email),
      email,
      companies.name
    INTO NEW.contact_name, NEW.contact_email, NEW.company
    FROM contacts
    LEFT JOIN companies ON contacts.company_id = companies.id
    WHERE contacts.id = NEW.contact_id;
  END IF;

  -- If deal_id is set, populate from deal info
  IF NEW.deal_id IS NOT NULL AND (NEW.company IS NULL OR NEW.contact_email IS NULL) THEN
    SELECT
      COALESCE(NEW.company, deals.company),
      COALESCE(NEW.contact_email, deals.contact_email),
      COALESCE(NEW.contact_name, deals.contact_name)
    INTO NEW.company, NEW.contact_email, NEW.contact_name
    FROM deals
    WHERE deals.id = NEW.deal_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply sync trigger
DROP TRIGGER IF EXISTS sync_task_contact_info_trigger ON tasks;
CREATE TRIGGER sync_task_contact_info_trigger
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION sync_task_contact_info();

-- Organization helper functions
CREATE OR REPLACE FUNCTION current_user_orgs(p_user_id UUID)
RETURNS TABLE(org_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT om.org_id
  FROM organization_memberships om
  WHERE om.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_org_member(p_user_id UUID, p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM organization_memberships
    WHERE user_id = p_user_id AND org_id = p_org_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_org_role(p_user_id UUID, p_org_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role
    FROM organization_memberships
    WHERE user_id = p_user_id AND org_id = p_org_id
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_super_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = p_user_id AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECTION 15: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_sync_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_automation_rules ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Teams policies
DROP POLICY IF EXISTS "Team members can read team data" ON teams;
CREATE POLICY "Team members can read team data"
  ON teams FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = teams.id
      AND team_members.user_id = auth.uid()
    )
  );

-- Team members policies
DROP POLICY IF EXISTS "Team members can read membership data" ON team_members;
CREATE POLICY "Team members can read membership data"
  ON team_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('leader', 'admin')
    )
  );

-- Activities policies
DROP POLICY IF EXISTS "Users can read own and team activities" ON activities;
CREATE POLICY "Users can read own and team activities"
  ON activities FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = activities.team_id
      AND team_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create own activities" ON activities;
CREATE POLICY "Users can create own activities"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own activities" ON activities;
CREATE POLICY "Users can update own activities"
  ON activities FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Targets policies
DROP POLICY IF EXISTS "Users can read own and team targets" ON targets;
CREATE POLICY "Users can read own and team targets"
  ON targets FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = targets.team_id
      AND team_members.user_id = auth.uid()
    )
  );

-- Organizations policies
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON organizations;
CREATE POLICY "Users can view organizations they belong to"
  ON organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE org_id = organizations.id
      AND user_id = auth.uid()
    )
    OR is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Super admins can manage all organizations" ON organizations;
CREATE POLICY "Super admins can manage all organizations"
  ON organizations FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Organization memberships policies
DROP POLICY IF EXISTS "Users can view memberships in their organizations" ON organization_memberships;
CREATE POLICY "Users can view memberships in their organizations"
  ON organization_memberships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships om
      WHERE om.org_id = organization_memberships.org_id
      AND om.user_id = auth.uid()
    )
    OR is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Owners and admins can add members" ON organization_memberships;
CREATE POLICY "Owners and admins can add members"
  ON organization_memberships FOR INSERT
  WITH CHECK (
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    OR is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Owners and admins can update members" ON organization_memberships;
CREATE POLICY "Owners and admins can update members"
  ON organization_memberships FOR UPDATE
  USING (
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    OR is_super_admin(auth.uid())
  )
  WITH CHECK (
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    OR is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Owners and admins can remove members" ON organization_memberships;
CREATE POLICY "Owners and admins can remove members"
  ON organization_memberships FOR DELETE
  USING (
    (get_org_role(auth.uid(), org_id) IN ('owner', 'admin') AND user_id != auth.uid())
    OR is_super_admin(auth.uid())
  );

-- Organization invitations policies
DROP POLICY IF EXISTS "Users can view invitations in their organizations" ON organization_invitations;
CREATE POLICY "Users can view invitations in their organizations"
  ON organization_invitations FOR SELECT
  USING (
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    OR is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Owners and admins can create invitations" ON organization_invitations;
CREATE POLICY "Owners and admins can create invitations"
  ON organization_invitations FOR INSERT
  WITH CHECK (
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    OR is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Owners and admins can update invitations" ON organization_invitations;
CREATE POLICY "Owners and admins can update invitations"
  ON organization_invitations FOR UPDATE
  USING (
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    OR is_super_admin(auth.uid())
  )
  WITH CHECK (
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    OR is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Owners and admins can delete invitations" ON organization_invitations;
CREATE POLICY "Owners and admins can delete invitations"
  ON organization_invitations FOR DELETE
  USING (
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    OR is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Users can view their own pending invitations" ON organization_invitations;
CREATE POLICY "Users can view their own pending invitations"
  ON organization_invitations FOR SELECT
  USING (
    LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
    AND accepted_at IS NULL
    AND expires_at > NOW()
  );

-- Companies policies
DROP POLICY IF EXISTS "Companies are viewable by all authenticated users" ON companies;
CREATE POLICY "Companies are viewable by all authenticated users"
  ON companies FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can create companies" ON companies;
CREATE POLICY "Users can create companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own companies" ON companies;
CREATE POLICY "Users can update their own companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() OR owner_id IS NULL)
  WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL);

-- Contacts policies
DROP POLICY IF EXISTS "Contacts are viewable by all authenticated users" ON contacts;
CREATE POLICY "Contacts are viewable by all authenticated users"
  ON contacts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can create contacts" ON contacts;
CREATE POLICY "Users can create contacts"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own contacts" ON contacts;
CREATE POLICY "Users can update their own contacts"
  ON contacts FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() OR owner_id IS NULL)
  WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL);

-- Deals policies
DROP POLICY IF EXISTS "Users can view their own deals" ON deals;
CREATE POLICY "Users can view their own deals"
  ON deals FOR SELECT
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own deals" ON deals;
CREATE POLICY "Users can insert their own deals"
  ON deals FOR INSERT
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own deals" ON deals;
CREATE POLICY "Users can update their own deals"
  ON deals FOR UPDATE
  USING (owner_id = auth.uid());

-- Deal activities policies
DROP POLICY IF EXISTS "Users can view their deal activities" ON deal_activities;
CREATE POLICY "Users can view their deal activities"
  ON deal_activities FOR SELECT
  USING (
    deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert deal activities" ON deal_activities;
CREATE POLICY "Users can insert deal activities"
  ON deal_activities FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid())
  );

-- Deal stage history policies
DROP POLICY IF EXISTS "Users can view their deal stage history" ON deal_stage_history;
CREATE POLICY "Users can view their deal stage history"
  ON deal_stage_history FOR SELECT
  USING (
    deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid())
  );

-- Tasks policies
DROP POLICY IF EXISTS "Users can view their tasks" ON tasks;
CREATE POLICY "Users can view their tasks"
  ON tasks FOR SELECT
  USING (
    assigned_to = auth.uid() OR
    created_by = auth.uid() OR
    deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can create tasks" ON tasks;
CREATE POLICY "Users can create tasks"
  ON tasks FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    (
      assigned_to = auth.uid() OR
      assigned_to IN (SELECT id FROM auth.users WHERE id = assigned_to) OR
      deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their tasks" ON tasks;
CREATE POLICY "Users can update their tasks"
  ON tasks FOR UPDATE
  USING (
    assigned_to = auth.uid() OR
    created_by = auth.uid() OR
    deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete their tasks" ON tasks;
CREATE POLICY "Users can delete their tasks"
  ON tasks FOR DELETE
  USING (
    created_by = auth.uid() OR
    assigned_to = auth.uid()
  );

-- Meetings policies
DROP POLICY IF EXISTS "Users can view their own meetings" ON meetings;
CREATE POLICY "Users can view their own meetings"
  ON meetings FOR SELECT
  USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Users can view team meetings" ON meetings;
CREATE POLICY "Users can view team meetings"
  ON meetings FOR SELECT
  USING (
    team_name IN (
      SELECT team_name FROM meetings WHERE owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own meetings" ON meetings;
CREATE POLICY "Users can insert their own meetings"
  ON meetings FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Users can update their own meetings" ON meetings;
CREATE POLICY "Users can update their own meetings"
  ON meetings FOR UPDATE
  USING (auth.uid() = owner_user_id);

-- Meeting attendees policies
DROP POLICY IF EXISTS "View attendees for accessible meetings" ON meeting_attendees;
CREATE POLICY "View attendees for accessible meetings"
  ON meeting_attendees FOR SELECT
  USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE
        owner_user_id = auth.uid() OR
        team_name IN (
          SELECT team_name FROM meetings WHERE owner_user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Manage attendees for own meetings" ON meeting_attendees;
CREATE POLICY "Manage attendees for own meetings"
  ON meeting_attendees FOR ALL
  USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE owner_user_id = auth.uid()
    )
  );

-- Meeting action items policies
DROP POLICY IF EXISTS "View action items for accessible meetings" ON meeting_action_items;
CREATE POLICY "View action items for accessible meetings"
  ON meeting_action_items FOR SELECT
  USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE
        owner_user_id = auth.uid() OR
        team_name IN (
          SELECT team_name FROM meetings WHERE owner_user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Manage action items for own meetings" ON meeting_action_items;
CREATE POLICY "Manage action items for own meetings"
  ON meeting_action_items FOR ALL
  USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE owner_user_id = auth.uid()
    )
  );

-- Meeting topics policies
DROP POLICY IF EXISTS "View topics for accessible meetings" ON meeting_topics;
CREATE POLICY "View topics for accessible meetings"
  ON meeting_topics FOR SELECT
  USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE
        owner_user_id = auth.uid() OR
        team_name IN (
          SELECT team_name FROM meetings WHERE owner_user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Manage topics for own meetings" ON meeting_topics;
CREATE POLICY "Manage topics for own meetings"
  ON meeting_topics FOR ALL
  USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE owner_user_id = auth.uid()
    )
  );

-- Meeting metrics policies
DROP POLICY IF EXISTS "View metrics for accessible meetings" ON meeting_metrics;
CREATE POLICY "View metrics for accessible meetings"
  ON meeting_metrics FOR SELECT
  USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE
        owner_user_id = auth.uid() OR
        team_name IN (
          SELECT team_name FROM meetings WHERE owner_user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Manage metrics for own meetings" ON meeting_metrics;
CREATE POLICY "Manage metrics for own meetings"
  ON meeting_metrics FOR ALL
  USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE owner_user_id = auth.uid()
    )
  );

-- Activity sync rules policies
DROP POLICY IF EXISTS "Users can view their own sync rules" ON activity_sync_rules;
CREATE POLICY "Users can view their own sync rules"
  ON activity_sync_rules FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage their own sync rules" ON activity_sync_rules;
CREATE POLICY "Users can manage their own sync rules"
  ON activity_sync_rules FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- User automation rules policies
DROP POLICY IF EXISTS "Users can view own automation rules" ON user_automation_rules;
CREATE POLICY "Users can view own automation rules"
  ON user_automation_rules FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own automation rules" ON user_automation_rules;
CREATE POLICY "Users can create own automation rules"
  ON user_automation_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own automation rules" ON user_automation_rules;
CREATE POLICY "Users can update own automation rules"
  ON user_automation_rules FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own automation rules" ON user_automation_rules;
CREATE POLICY "Users can delete own automation rules"
  ON user_automation_rules FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- SECTION 16: GRANTS & PERMISSIONS
-- ============================================================================

-- Grant permissions on views (if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks_with_relations') THEN
    GRANT SELECT ON tasks_with_relations TO authenticated;
  END IF;
END $$;

-- Grant permissions on user automation rules
GRANT ALL ON user_automation_rules TO authenticated;

-- ============================================================================
-- SECTION 17: COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE organizations IS 'Organizations (tenants) in the multi-tenant system';
COMMENT ON TABLE organization_memberships IS 'Links users to organizations with roles';
COMMENT ON TABLE organization_invitations IS 'Invitations for users to join organizations';
COMMENT ON TABLE activity_sync_rules IS 'Rules for automatically creating and managing deals from activities';
COMMENT ON TABLE user_automation_rules IS 'Stores user-created workflow automation rules';

COMMENT ON FUNCTION current_user_orgs(UUID) IS 'Returns all organization IDs for a given user';
COMMENT ON FUNCTION is_org_member(UUID, UUID) IS 'Checks if a user is a member of an organization';
COMMENT ON FUNCTION get_org_role(UUID, UUID) IS 'Gets the role of a user in an organization';
COMMENT ON FUNCTION is_super_admin(UUID) IS 'Checks if a user is a super admin (is_admin flag)';

-- ============================================================================
-- BOOTSTRAP COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Sixty Sales Dashboard - Bootstrap Schema Installation Complete';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Run any additional feature-specific migrations as needed';
  RAISE NOTICE '2. Insert default deal stages using appropriate migration';
  RAISE NOTICE '3. Configure Supabase Edge Functions for API endpoints';
  RAISE NOTICE '4. Set up authentication providers in Supabase dashboard';
  RAISE NOTICE '============================================================================';
END $$;
