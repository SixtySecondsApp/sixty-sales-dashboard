-- Force PostgREST Schema Cache Reload
-- Run this AFTER running FINAL_SCHEMA_FIX.sql

-- Method 1: Send NOTIFY signal to PostgREST
NOTIFY pgrst, 'reload schema';

-- Method 2: Make a DDL change to force cache reload
COMMENT ON TABLE profiles IS 'User profiles - force cache reload';
COMMENT ON TABLE organizations IS 'Organizations - force cache reload';
COMMENT ON TABLE contacts IS 'Contacts - force cache reload';
COMMENT ON TABLE deals IS 'Deals - force cache reload';
COMMENT ON TABLE activities IS 'Activities - force cache reload';
COMMENT ON TABLE meetings IS 'Meetings - force cache reload';
COMMENT ON TABLE communication_events IS 'Communication events - force cache reload';
COMMENT ON TABLE workflow_executions IS 'Workflow executions - force cache reload';

-- Method 3: Verify all columns are actually in the database
SELECT
    table_name,
    COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN (
    'profiles', 'organizations', 'contacts', 'deals',
    'activities', 'meetings', 'communication_events', 'workflow_executions'
)
GROUP BY table_name
ORDER BY table_name;

-- Verify specific missing columns that were causing errors
SELECT
    'engagement_level' as column_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'contacts' AND column_name = 'engagement_level'
    ) THEN 'EXISTS' ELSE 'MISSING' END as status;

SELECT
    'close_date' as column_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'deals' AND column_name = 'close_date'
    ) THEN 'EXISTS' ELSE 'MISSING' END as status;

SELECT
    'is_rebooking' as column_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'activities' AND column_name = 'is_rebooking'
    ) THEN 'EXISTS' ELSE 'MISSING' END as status;

SELECT
    'clerk_org_id in meetings' as column_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'meetings' AND column_name = 'clerk_org_id'
    ) THEN 'EXISTS' ELSE 'MISSING' END as status;

SELECT
    'ai_analyzed' as column_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'communication_events' AND column_name = 'ai_analyzed'
    ) THEN 'EXISTS' ELSE 'MISSING' END as status;
