-- Migration: Optimize Query Performance
-- Addresses performance issues identified in pg_stat_statements analysis
-- Applied: 2025-12-10
--
-- Key findings:
-- 1. realtime.list_changes consuming 87.9% of DB time (600K calls)
-- 2. meeting_attendees queries averaging 725ms (missing index)
-- 3. meetings queries with suboptimal join performance
--
-- This migration adds missing indexes to improve query performance
--
-- NOTE: Using CREATE INDEX (not CONCURRENTLY) because migrations run in transactions.
-- For production with large tables, consider running these manually with CONCURRENTLY
-- outside of the migration system during low-traffic periods.

-- ============================================================================
-- SECTION 1: meeting_attendees index (fixes 725ms avg query time)
-- ============================================================================

-- Add index for meeting_id lookups on meeting_attendees
-- This table is queried frequently when loading meeting details
CREATE INDEX IF NOT EXISTS idx_meeting_attendees_meeting_id
ON public.meeting_attendees(meeting_id);

-- ============================================================================
-- SECTION 2: meetings table indexes (fixes complex join queries)
-- ============================================================================

-- Index for owner_user_id filtering (used in WHERE clause)
CREATE INDEX IF NOT EXISTS idx_meetings_owner_user_id
ON public.meetings(owner_user_id);

-- Index for owner_email filtering (used in WHERE clause OR condition)
CREATE INDEX IF NOT EXISTS idx_meetings_owner_email
ON public.meetings(owner_email);

-- Index for meeting_start ordering (used in ORDER BY DESC)
CREATE INDEX IF NOT EXISTS idx_meetings_meeting_start_desc
ON public.meetings(meeting_start DESC);

-- Composite index for the common query pattern: filter by owner + sort by date
CREATE INDEX IF NOT EXISTS idx_meetings_owner_user_id_meeting_start
ON public.meetings(owner_user_id, meeting_start DESC);

-- ============================================================================
-- SECTION 3: Related table indexes for JOIN performance
-- ============================================================================

-- Index for meeting_action_items JOIN on meeting_id
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_meeting_id
ON public.meeting_action_items(meeting_id);

-- Index for tasks JOIN on meeting_id (if not already exists)
CREATE INDEX IF NOT EXISTS idx_tasks_meeting_id
ON public.tasks(meeting_id);

-- ============================================================================
-- SECTION 4: Analyze tables to update statistics
-- ============================================================================

-- Update table statistics for the query planner
ANALYZE public.meeting_attendees;
ANALYZE public.meetings;
ANALYZE public.meeting_action_items;
ANALYZE public.tasks;

-- ============================================================================
-- NOTES ON REALTIME SUBSCRIPTION OVERHEAD
-- ============================================================================
--
-- The realtime.list_changes query consumes 87.9% of database time.
-- This is Supabase Realtime polling for changes on subscribed tables.
--
-- To reduce this overhead, review your realtime subscriptions:
--
-- 1. Check current realtime-enabled tables:
--    SELECT schemaname, tablename
--    FROM pg_publication_tables
--    WHERE pubname = 'supabase_realtime';
--
-- 2. Disable realtime on tables that don't need it:
--    ALTER PUBLICATION supabase_realtime DROP TABLE public.table_name;
--
-- 3. In your frontend code, ensure you're:
--    - Unsubscribing from channels when components unmount
--    - Using specific filters to limit subscription scope
--    - Not subscribing to high-volume tables unnecessarily
--
-- Common tables that often don't need realtime:
-- - Audit/log tables
-- - Historical data tables
-- - Tables only updated by background jobs
-- - Tables with infrequent updates
-- ============================================================================
