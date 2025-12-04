-- ========================================
-- Complete Schema Fix for Development-v2
-- ========================================
-- Run this entire file in Supabase dashboard SQL Editor
-- Then run: node sync-data-via-api.mjs

-- Step 1: Drop foreign key constraint temporarily
-- This prevents errors when syncing organizations before auth.users
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_created_by_fkey;

-- Step 2: Add all missing columns
-- profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company TEXT;

-- deals
ALTER TABLE deals ADD COLUMN IF NOT EXISTS clerk_org_id UUID;

-- activities
ALTER TABLE activities ADD COLUMN IF NOT EXISTS execution_order INTEGER;

-- meetings
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS calendar_invitees_type JSONB;

-- communication_events
ALTER TABLE communication_events ADD COLUMN IF NOT EXISTS action_items JSONB;

-- workflow_executions
ALTER TABLE workflow_executions ADD COLUMN IF NOT EXISTS action_results JSONB;

-- Step 3: Create missing workflow_definitions table
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

-- Step 4: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_user_id ON workflow_definitions(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_organization_id ON workflow_definitions(organization_id);

-- Step 5: Verify schema changes
SELECT
    'Schema fix complete!' as status,
    COUNT(DISTINCT table_name) as tables_checked
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN (
    'profiles', 'organizations', 'contacts', 'deals',
    'activities', 'meetings', 'communication_events',
    'workflow_definitions', 'workflow_executions'
);

-- Note: The organizations_created_by_fkey constraint will be re-added
-- automatically by the sync script after auth.users is populated
