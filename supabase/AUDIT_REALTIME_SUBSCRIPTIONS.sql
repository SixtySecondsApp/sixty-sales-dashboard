-- ============================================================================
-- REALTIME SUBSCRIPTION AUDIT SCRIPT
-- ============================================================================
-- Run these queries in Supabase SQL Editor to identify realtime optimization opportunities
-- The realtime.list_changes query is consuming 87.9% of your database time!

-- ============================================================================
-- 1. List all tables currently enabled for realtime
-- ============================================================================
SELECT
    schemaname,
    tablename,
    'ALTER PUBLICATION supabase_realtime DROP TABLE ' || schemaname || '.' || tablename || ';' AS disable_command
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY schemaname, tablename;

-- ============================================================================
-- 2. Check active realtime subscriptions
-- ============================================================================
SELECT * FROM realtime.subscription;

-- ============================================================================
-- 3. Identify high-volume tables that might not need realtime
-- Tables with lots of inserts/updates are expensive to track
-- ============================================================================
SELECT
    schemaname,
    relname AS tablename,
    n_tup_ins AS inserts,
    n_tup_upd AS updates,
    n_tup_del AS deletes,
    n_tup_ins + n_tup_upd + n_tup_del AS total_changes,
    CASE
        WHEN pt.tablename IS NOT NULL THEN 'YES - Consider disabling'
        ELSE 'No'
    END AS realtime_enabled
FROM pg_stat_user_tables st
LEFT JOIN pg_publication_tables pt
    ON st.schemaname = pt.schemaname
    AND st.relname = pt.tablename
    AND pt.pubname = 'supabase_realtime'
WHERE st.schemaname = 'public'
ORDER BY total_changes DESC
LIMIT 30;

-- ============================================================================
-- 4. Tables that are likely candidates to DISABLE realtime
-- ============================================================================
-- Based on common patterns, these table types often don't need realtime:

-- Audit/log tables (historical, not user-facing)
-- SELECT tablename FROM pg_publication_tables
-- WHERE pubname = 'supabase_realtime'
-- AND (tablename LIKE '%_log%' OR tablename LIKE '%_audit%' OR tablename LIKE '%_history%');

-- ============================================================================
-- 5. RECOMMENDED TABLES TO DISABLE REALTIME
-- ============================================================================
-- Based on your schema, consider disabling realtime on:
--
-- High-volume background tables:
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.ai_search_index_queue;
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.email_sync_queue;
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.workflow_executions;
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.workflow_execution_logs;
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.communication_events;
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.cost_tracking;
--
-- Historical/audit tables:
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.meeting_transcripts;
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.email_messages;
--
-- Rarely viewed directly:
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.meeting_attendees;
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.meeting_action_items;

-- ============================================================================
-- 6. Check which tables your app ACTUALLY subscribes to
-- ============================================================================
-- Search your frontend code for these patterns:
--
-- grep -r "supabase.channel" src/
-- grep -r ".on('postgres_changes'" src/
-- grep -r "realtime.subscribe" src/
--
-- Only keep realtime enabled for tables your app actually subscribes to!

-- ============================================================================
-- 7. AFTER DISABLING: Verify the changes
-- ============================================================================
-- After running DROP TABLE commands, verify with:
-- SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
