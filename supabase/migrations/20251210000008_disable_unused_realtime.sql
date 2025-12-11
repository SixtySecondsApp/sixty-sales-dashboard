-- Migration: Disable Realtime on Unused Tables
-- Addresses the realtime.list_changes consuming 87.9% of database time
-- Applied: 2025-12-10
--
-- ANALYSIS SUMMARY:
-- The following tables ARE actively subscribed to in the frontend code:
-- - activities
-- - branding_settings
-- - calendar_events
-- - company_notes
-- - deal_health_alerts
-- - deal_health_scores
-- - deals
-- - email_threads
-- - emails
-- - fathom_integrations
-- - fathom_sync_state
-- - meeting_action_items
-- - meeting_file_search_index
-- - meeting_index_queue
-- - meetings
-- - meetings_waitlist
-- - next_action_suggestions
-- - notifications
-- - org_file_search_stores
-- - pipeline_stage_recommendations
-- - relationship_health_scores
-- - roadmap_suggestions
-- - sentiment_alerts
-- - task_notifications
-- - tasks
-- - user_onboarding_progress
-- - waitlist_onboarding_progress
-- - waitlist_shares
--
-- All OTHER tables can have realtime disabled to reduce overhead.

-- ============================================================================
-- STEP 1: Check current realtime-enabled tables (for reference)
-- ============================================================================
-- Run this query first to see what's currently enabled:
-- SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- ============================================================================
-- STEP 2: Disable realtime on HIGH-VOLUME tables NOT in the active list
-- ============================================================================

-- Background processing queues (high volume, no frontend subscription)
DO $$
BEGIN
    -- ai_search_index_queue - background indexing, no realtime needed
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'ai_search_index_queue') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.ai_search_index_queue;
        RAISE NOTICE 'Disabled realtime on ai_search_index_queue';
    END IF;

    -- email_sync_queue - background sync, no realtime needed
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'email_sync_queue') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.email_sync_queue;
        RAISE NOTICE 'Disabled realtime on email_sync_queue';
    END IF;

    -- workflow_executions - internal workflow state, not subscribed
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'workflow_executions') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.workflow_executions;
        RAISE NOTICE 'Disabled realtime on workflow_executions';
    END IF;

    -- workflow_execution_logs - audit logs, not subscribed
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'workflow_execution_logs') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.workflow_execution_logs;
        RAISE NOTICE 'Disabled realtime on workflow_execution_logs';
    END IF;

    -- communication_events - high volume analytics, not subscribed
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'communication_events') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.communication_events;
        RAISE NOTICE 'Disabled realtime on communication_events';
    END IF;

    -- cost_tracking - internal metrics, not subscribed
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'cost_tracking') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.cost_tracking;
        RAISE NOTICE 'Disabled realtime on cost_tracking';
    END IF;

    -- meeting_transcripts - large text data, loaded on demand
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'meeting_transcripts') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.meeting_transcripts;
        RAISE NOTICE 'Disabled realtime on meeting_transcripts';
    END IF;

    -- email_messages - high volume, loaded via emails table subscription
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'email_messages') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.email_messages;
        RAISE NOTICE 'Disabled realtime on email_messages';
    END IF;

    -- meeting_attendees - loaded with meetings, not subscribed directly
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'meeting_attendees') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.meeting_attendees;
        RAISE NOTICE 'Disabled realtime on meeting_attendees';
    END IF;

    -- contacts - loaded on demand, not subscribed
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'contacts') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.contacts;
        RAISE NOTICE 'Disabled realtime on contacts';
    END IF;

    -- companies - loaded on demand, not subscribed
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'companies') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.companies;
        RAISE NOTICE 'Disabled realtime on companies';
    END IF;

    -- user_profiles - rarely changes, not subscribed
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'user_profiles') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.user_profiles;
        RAISE NOTICE 'Disabled realtime on user_profiles';
    END IF;

    -- organizations - rarely changes, not subscribed
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'organizations') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.organizations;
        RAISE NOTICE 'Disabled realtime on organizations';
    END IF;

    -- user_google_tokens - auth data, not subscribed
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'user_google_tokens') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.user_google_tokens;
        RAISE NOTICE 'Disabled realtime on user_google_tokens';
    END IF;

    -- smart_task_templates - admin config, not subscribed
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'smart_task_templates') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.smart_task_templates;
        RAISE NOTICE 'Disabled realtime on smart_task_templates';
    END IF;

    -- extraction_rules - config data, not subscribed
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'extraction_rules') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.extraction_rules;
        RAISE NOTICE 'Disabled realtime on extraction_rules';
    END IF;

    -- user_writing_styles - config data, not subscribed
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'user_writing_styles') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.user_writing_styles;
        RAISE NOTICE 'Disabled realtime on user_writing_styles';
    END IF;

    -- workflow_definitions - config data, not subscribed
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'workflow_definitions') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.workflow_definitions;
        RAISE NOTICE 'Disabled realtime on workflow_definitions';
    END IF;

    -- user_automation_rules - config data, not subscribed
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'user_automation_rules') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.user_automation_rules;
        RAISE NOTICE 'Disabled realtime on user_automation_rules';
    END IF;

    -- google_integrations - auth data, not subscribed
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'google_integrations') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.google_integrations;
        RAISE NOTICE 'Disabled realtime on google_integrations';
    END IF;

    -- slack_connections - config data, not subscribed
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'slack_connections') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.slack_connections;
        RAISE NOTICE 'Disabled realtime on slack_connections';
    END IF;

    -- slack_deal_rooms - config data, not subscribed
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'slack_deal_rooms') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.slack_deal_rooms;
        RAISE NOTICE 'Disabled realtime on slack_deal_rooms';
    END IF;

    -- user_sync_status - background state, not subscribed
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'user_sync_status') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.user_sync_status;
        RAISE NOTICE 'Disabled realtime on user_sync_status';
    END IF;
END $$;

-- ============================================================================
-- STEP 3: Verify remaining realtime tables
-- ============================================================================
-- After running, check what's left:
-- SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename;

-- ============================================================================
-- EXPECTED OUTCOME:
-- By disabling realtime on ~20+ tables that aren't subscribed to,
-- we should significantly reduce the 87.9% DB overhead from realtime.list_changes
-- ============================================================================
