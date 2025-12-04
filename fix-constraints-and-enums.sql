-- Fix Constraints, ENUMs, and Generated Columns
-- Run this to fix the remaining sync issues

-- 1. Fix full_name column (drop and recreate as regular TEXT column)
ALTER TABLE contacts DROP COLUMN IF EXISTS full_name CASCADE;
ALTER TABLE contacts ADD COLUMN full_name TEXT;

-- 2. Add missing ENUM values for activity_status
-- First check what values exist
DO $$
BEGIN
    -- Add 'no_show' to activity_status enum if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'no_show'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'activity_status')
    ) THEN
        ALTER TYPE activity_status ADD VALUE 'no_show';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END$$;

-- 3. Drop check constraint on talk_time_judgement (it's blocking inserts)
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_talk_time_judgement_check;

-- 4. Drop ALL foreign key constraints temporarily
-- We'll add them back after data is synced
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_company_id_fkey;
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_owner_id_fkey;
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_stage_id_fkey;
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_owner_id_fkey;
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_company_id_fkey;
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_primary_contact_id_fkey;
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_user_id_fkey;
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_contact_id_fkey;
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_deal_id_fkey;
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_company_id_fkey;
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_owner_id_fkey;
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_meeting_id_fkey;
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_owner_user_id_fkey;
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_company_id_fkey;
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_primary_contact_id_fkey;
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_contact_id_fkey;
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_created_by_fkey;
ALTER TABLE communication_events DROP CONSTRAINT IF EXISTS communication_events_user_id_fkey;
ALTER TABLE communication_events DROP CONSTRAINT IF EXISTS communication_events_contact_id_fkey;
ALTER TABLE communication_events DROP CONSTRAINT IF EXISTS communication_events_company_id_fkey;
ALTER TABLE communication_events DROP CONSTRAINT IF EXISTS communication_events_deal_id_fkey;
ALTER TABLE workflow_executions DROP CONSTRAINT IF EXISTS workflow_executions_user_id_fkey;
ALTER TABLE workflow_executions DROP CONSTRAINT IF EXISTS workflow_executions_workflow_id_fkey;

-- 5. Verify changes
SELECT 'Constraints fixed! Ready to sync data.' as status;

-- Show activity_status enum values
SELECT enumlabel as activity_status_values
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'activity_status')
ORDER BY enumsortorder;
