# Fix Schema Mismatch - Step-by-Step Guide

## Problem
The bootstrap schema is missing columns that exist in production, causing all data inserts to fail.

## Solution
Run the `fix-schema-mismatch.sql` file in the Supabase dashboard to add missing columns.

## Steps

### 1. Open Supabase Dashboard
Navigate to: https://supabase.com/dashboard/project/jczngsvpywgrlgdwzjbr

### 2. Open SQL Editor
- Click **"SQL Editor"** in the left sidebar
- Click **"New query"** button

### 3. Run the Fix Script
Copy the contents of `fix-schema-mismatch.sql` and paste into the SQL Editor, then click **"Run"**.

Alternatively, you can copy this SQL directly:

```sql
-- Add missing columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS clerk_org_id TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS clerk_org_id TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS annual_value NUMERIC;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS ai_training_metadata JSONB;

-- Create workflow_definitions table first (needed by workflow_executions)
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

-- Create communication_events table
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

-- Create workflow_executions table
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

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_profiles_clerk_user_id ON profiles(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_clerk_org_id ON contacts(clerk_org_id);
CREATE INDEX IF NOT EXISTS idx_activities_clerk_org_id ON activities(clerk_org_id);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_user_id ON workflow_definitions(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_organization_id ON workflow_definitions(organization_id);
CREATE INDEX IF NOT EXISTS idx_communication_events_user_id ON communication_events(user_id);
CREATE INDEX IF NOT EXISTS idx_communication_events_contact_id ON communication_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_user_id ON workflow_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_definition_id ON workflow_executions(workflow_definition_id);
```

### 4. Verify Success
You should see output like:
```
Success. No rows returned
```

This means the ALTER TABLE and CREATE TABLE statements executed successfully.

### 5. Re-run Data Sync
After the schema is fixed, run:
```bash
node sync-data-via-api.mjs
```

This will:
- Fetch all 10,947+ records from production
- Insert them into development-v2 (now with matching schema)
- Verify the data counts

## Expected Results

After running the data sync, you should see:
```
✅ profiles: ~XX records
✅ organizations: ~XX records
✅ contacts: ~XXXX records
✅ deals: ~XXX records
✅ activities: ~XXXX records
✅ tasks: ~XXX records
✅ meetings: ~XXX records
✅ communication_events: ~XX records
✅ workflow_definitions: ~XX records
✅ workflow_executions: ~XX records
```

## Troubleshooting

### If you see errors about foreign key constraints
This means the data sync order needs adjustment. The script will handle this automatically by continuing with other tables.

### If columns still appear to be missing
Wait 1-2 minutes for PostgREST schema cache to refresh, then re-run the sync.

### If you need to start over
Run this in SQL Editor to drop all data:
```sql
TRUNCATE profiles, organizations, contacts, deals, activities, tasks, meetings, communication_events, workflow_definitions, workflow_executions CASCADE;
```

Then re-run `node sync-data-via-api.mjs`.
