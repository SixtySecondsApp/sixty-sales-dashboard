-- Check meetings table and data
-- This script verifies the meetings table exists and shows any meeting records

-- ========================================
-- Check if meetings table exists
-- ========================================
SELECT 
    'Table Check' as check_type,
    EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'meetings' 
        AND table_schema = 'public'
    ) as meetings_table_exists;

-- ========================================
-- Count meetings records
-- ========================================
SELECT 
    'Record Count' as check_type,
    COUNT(*) as total_meetings,
    COUNT(DISTINCT owner_user_id) as unique_owners,
    MIN(meeting_start) as earliest_meeting,
    MAX(meeting_start) as latest_meeting
FROM meetings;

-- ========================================
-- Show recent meetings
-- ========================================
SELECT 
    'Recent Meetings' as check_type,
    id,
    title,
    meeting_start,
    duration_minutes,
    owner_user_id,
    fathom_recording_id,
    created_at
FROM meetings
ORDER BY created_at DESC
LIMIT 5;

-- ========================================
-- Check for meetings created by Fathom webhook
-- ========================================
SELECT 
    'Fathom Meetings' as check_type,
    COUNT(*) as fathom_meetings_count
FROM meetings
WHERE fathom_recording_id IS NOT NULL;

-- ========================================
-- Check workflow executions for meeting creation
-- ========================================
SELECT 
    'Workflow Executions' as check_type,
    id,
    workflow_id,
    trigger_type,
    execution_status,
    trigger_data->>'payload_type' as payload_type,
    trigger_data->>'fathom_id' as fathom_id,
    started_at,
    completed_at
FROM workflow_executions
WHERE trigger_data->>'payload_type' = 'summary'
OR action_results->>'action' = 'meeting_upserted'
ORDER BY started_at DESC
LIMIT 5;

-- ========================================
-- Check if there's an owner_user_id for your user
-- ========================================
SELECT 
    'Your Meetings' as check_type,
    COUNT(*) as your_meeting_count
FROM meetings
WHERE owner_user_id = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'; -- Your user ID