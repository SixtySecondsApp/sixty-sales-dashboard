-- Fix Schema Mismatch: Add Missing Columns to Development-v2
-- This script adds columns that exist in production but are missing from the bootstrap schema

-- Add clerk_user_id to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;

-- Add clerk_org_id to contacts
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS clerk_org_id TEXT;

-- Add clerk_org_id to activities
ALTER TABLE activities
ADD COLUMN IF NOT EXISTS clerk_org_id TEXT;

-- Add annual_value to deals
ALTER TABLE deals
ADD COLUMN IF NOT EXISTS annual_value NUMERIC;

-- Add ai_training_metadata to meetings
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS ai_training_metadata JSONB;

-- Create workflow_definitions table first (referenced by workflow_executions)
CREATE TABLE IF NOT EXISTS workflow_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    user_id UUID REFERENCES auth.users(id),
    organization_id UUID REFERENCES organizations(id),
    trigger_type TEXT NOT NULL,
    trigger_config JSONB,
    actions JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create communication_events table if it doesn't exist
CREATE TABLE IF NOT EXISTS communication_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    organization_id UUID REFERENCES organizations(id),
    contact_id UUID REFERENCES contacts(id),
    company_id UUID REFERENCES companies(id),
    event_type TEXT NOT NULL,
    event_data JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create workflow_executions table if it doesn't exist
CREATE TABLE IF NOT EXISTS workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_definition_id UUID REFERENCES workflow_definitions(id),
    user_id UUID REFERENCES auth.users(id),
    organization_id UUID REFERENCES organizations(id),
    status TEXT NOT NULL DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    execution_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_profiles_clerk_user_id ON profiles(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_clerk_org_id ON contacts(clerk_org_id);
CREATE INDEX IF NOT EXISTS idx_activities_clerk_org_id ON activities(clerk_org_id);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_user_id ON workflow_definitions(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_organization_id ON workflow_definitions(organization_id);
CREATE INDEX IF NOT EXISTS idx_communication_events_user_id ON communication_events(user_id);
CREATE INDEX IF NOT EXISTS idx_communication_events_contact_id ON communication_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_user_id ON workflow_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_definition_id ON workflow_executions(workflow_definition_id);

-- Verify the changes
SELECT
  'profiles' as table_name,
  COUNT(*) FILTER (WHERE column_name = 'clerk_user_id') as has_clerk_user_id
FROM information_schema.columns
WHERE table_name = 'profiles';

SELECT
  'contacts' as table_name,
  COUNT(*) FILTER (WHERE column_name = 'clerk_org_id') as has_clerk_org_id
FROM information_schema.columns
WHERE table_name = 'contacts';

SELECT
  'activities' as table_name,
  COUNT(*) FILTER (WHERE column_name = 'clerk_org_id') as has_clerk_org_id
FROM information_schema.columns
WHERE table_name = 'activities';

SELECT
  'deals' as table_name,
  COUNT(*) FILTER (WHERE column_name = 'annual_value') as has_annual_value
FROM information_schema.columns
WHERE table_name = 'deals';

SELECT
  'meetings' as table_name,
  COUNT(*) FILTER (WHERE column_name = 'ai_training_metadata') as has_ai_training_metadata
FROM information_schema.columns
WHERE table_name = 'meetings';

SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('communication_events', 'workflow_executions');
