-- Migration: Fix Security Linter Errors
-- Purpose: Address 40 security issues identified by Supabase linter
-- Categories: Exposed auth.users, Security Definer Views, RLS Disabled tables
-- Date: 2025-11-27

-- ============================================================================
-- PART 1: Fix Security Definer Views (12 views)
-- Recreate views with security_invoker = true to enforce RLS of querying user
-- ============================================================================

-- 1.1 Fix v_failed_transcript_retries
DROP VIEW IF EXISTS v_failed_transcript_retries CASCADE;
CREATE VIEW v_failed_transcript_retries
WITH (security_invoker = true)
AS
SELECT
  rtj.id,
  rtj.meeting_id,
  m.title as meeting_title,
  m.fathom_recording_id,
  rtj.user_id,
  p.email as user_email,
  rtj.recording_id,
  rtj.attempt_count,
  rtj.max_attempts,
  rtj.last_error,
  rtj.created_at,
  rtj.updated_at,
  rtj.completed_at,
  EXTRACT(EPOCH FROM (NOW() - rtj.updated_at)) / 60 as minutes_since_last_update
FROM fathom_transcript_retry_jobs rtj
LEFT JOIN meetings m ON m.id = rtj.meeting_id
LEFT JOIN profiles p ON p.id = rtj.user_id
WHERE rtj.status = 'failed'
ORDER BY rtj.updated_at DESC;

GRANT SELECT ON v_failed_transcript_retries TO authenticated;

-- 1.2 Fix v_pending_transcript_retries
DROP VIEW IF EXISTS v_pending_transcript_retries CASCADE;
CREATE VIEW v_pending_transcript_retries
WITH (security_invoker = true)
AS
SELECT
  rtj.id,
  rtj.meeting_id,
  m.title as meeting_title,
  m.fathom_recording_id,
  rtj.user_id,
  p.email as user_email,
  rtj.recording_id,
  rtj.attempt_count,
  rtj.max_attempts,
  rtj.next_retry_at,
  rtj.last_error,
  rtj.created_at,
  rtj.updated_at,
  CASE
    WHEN rtj.next_retry_at <= NOW() THEN 'ready'
    ELSE 'waiting'
  END as retry_status,
  EXTRACT(EPOCH FROM (rtj.next_retry_at - NOW())) / 60 as minutes_until_retry
FROM fathom_transcript_retry_jobs rtj
LEFT JOIN meetings m ON m.id = rtj.meeting_id
LEFT JOIN profiles p ON p.id = rtj.user_id
WHERE rtj.status IN ('pending', 'processing')
ORDER BY rtj.next_retry_at ASC;

GRANT SELECT ON v_pending_transcript_retries TO authenticated;

-- 1.3 Fix v_transcript_retry_stats
DROP VIEW IF EXISTS v_transcript_retry_stats CASCADE;
CREATE VIEW v_transcript_retry_stats
WITH (security_invoker = true)
AS
SELECT
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
  COUNT(*) FILTER (WHERE status IN ('pending', 'processing') AND next_retry_at <= NOW()) as ready_to_retry,
  AVG(attempt_count) FILTER (WHERE status = 'completed') as avg_attempts_to_complete,
  MAX(attempt_count) as max_attempts_made,
  COUNT(DISTINCT user_id) as unique_users_with_retries,
  COUNT(DISTINCT meeting_id) as unique_meetings_with_retries
FROM fathom_transcript_retry_jobs;

GRANT SELECT ON v_transcript_retry_stats TO authenticated;

-- 1.4 Fix activities_with_profile (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'activities_with_profile' AND schemaname = 'public') THEN
    DROP VIEW IF EXISTS activities_with_profile CASCADE;
    CREATE VIEW activities_with_profile
    WITH (security_invoker = true)
    AS
    SELECT
      a.*,
      p.id as profile_id,
      COALESCE(p.first_name || ' ' || p.last_name, p.email) as profile_full_name,
      p.avatar_url as profile_avatar_url
    FROM activities a
    LEFT JOIN profiles p ON a.user_id = p.id;

    GRANT SELECT ON activities_with_profile TO authenticated;
  END IF;
END $$;

-- 1.5 Fix deal_splits_with_users
DROP VIEW IF EXISTS deal_splits_with_users CASCADE;
CREATE VIEW deal_splits_with_users
WITH (security_invoker = true)
AS
SELECT
  ds.*,
  p.first_name,
  p.last_name,
  p.email,
  (p.first_name || ' ' || p.last_name) as full_name,
  d.name as deal_name,
  d.value as deal_value,
  d.owner_id as deal_owner_id
FROM deal_splits ds
JOIN profiles p ON ds.user_id = p.id
JOIN deals d ON ds.deal_id = d.id;

GRANT SELECT ON deal_splits_with_users TO authenticated;

-- 1.6 Fix deal_activities_with_profile
DROP VIEW IF EXISTS deal_activities_with_profile CASCADE;
CREATE VIEW deal_activities_with_profile
WITH (security_invoker = true)
AS
SELECT
  da.id,
  da.deal_id,
  da.user_id,
  da.activity_type,
  da.notes,
  da.due_date,
  da.completed,
  da.created_at,
  da.updated_at,
  da.contact_email,
  da.is_matched,
  p.id as profile_id,
  COALESCE(p.first_name || ' ' || p.last_name, p.email) as profile_full_name,
  p.avatar_url as profile_avatar_url
FROM deal_activities da
LEFT JOIN profiles p ON da.user_id = p.id;

GRANT SELECT ON deal_activities_with_profile TO authenticated;

-- 1.7 Fix client_churn_analytics
DROP VIEW IF EXISTS client_churn_analytics CASCADE;
CREATE VIEW client_churn_analytics
WITH (security_invoker = true)
AS
SELECT
  c.id,
  c.company_name,
  c.status,
  c.subscription_amount,
  c.notice_given_date,
  c.final_billing_date,
  c.churn_date,
  c.churn_reason,
  get_days_until_churn(c.final_billing_date) as days_until_final_billing,
  CASE
    WHEN c.status = 'notice_given' AND c.final_billing_date IS NOT NULL THEN
      CASE
        WHEN c.final_billing_date > CURRENT_DATE THEN 'Active - Notice Period'
        WHEN c.final_billing_date = CURRENT_DATE THEN 'Final Billing Today'
        ELSE 'Should Be Churned'
      END
    WHEN c.status = 'churned' THEN 'Churned'
    WHEN c.status = 'active' THEN 'Active'
    ELSE c.status::text
  END as churn_status,
  CASE
    WHEN c.status = 'notice_given' AND c.final_billing_date > CURRENT_DATE THEN
      -- DATE - DATE returns integer (days), so divide directly by 30
      c.subscription_amount * CEIL((c.final_billing_date - CURRENT_DATE)::numeric / 30)
    ELSE 0
  END as remaining_revenue_estimate
FROM clients c;

GRANT SELECT ON client_churn_analytics TO authenticated;

-- 1.8 Fix calendar_events_with_contacts
DROP VIEW IF EXISTS calendar_events_with_contacts CASCADE;
CREATE VIEW calendar_events_with_contacts
WITH (security_invoker = true)
AS
SELECT
  ce.*,
  COALESCE(c.full_name, CONCAT(c.first_name, ' ', c.last_name)) AS contact_name,
  c.email AS contact_email,
  c.phone AS contact_phone,
  co.name AS company_name,
  co.domain AS company_domain
FROM calendar_events ce
LEFT JOIN contacts c ON ce.contact_id = c.id
LEFT JOIN companies co ON ce.company_id = co.id;

GRANT SELECT ON calendar_events_with_contacts TO authenticated;

-- 1.9 Fix user_task_list_configs
DROP VIEW IF EXISTS user_task_list_configs CASCADE;
CREATE VIEW user_task_list_configs
WITH (security_invoker = true)
AS
SELECT
  c.*,
  CASE
    WHEN c.priority_filter = '{}' THEN 'All priorities'
    WHEN 'high' = ANY(c.priority_filter) AND 'critical' = ANY(c.priority_filter) THEN 'High & Critical only'
    WHEN 'high' = ANY(c.priority_filter) THEN 'High priority only'
    WHEN 'medium' = ANY(c.priority_filter) THEN 'Medium and above'
    ELSE 'Custom filter'
  END as priority_description,
  CASE
    WHEN c.is_primary THEN 'Primary list'
    WHEN array_length(c.priority_filter, 1) > 0 THEN 'Filtered list'
    ELSE 'Secondary list'
  END as list_type
FROM google_tasks_list_configs c
WHERE c.sync_enabled = true
ORDER BY c.is_primary DESC, c.display_order, c.created_at;

GRANT SELECT ON user_task_list_configs TO authenticated;

-- 1.10 Fix lead_source_summary
DROP VIEW IF EXISTS lead_source_summary CASCADE;
CREATE VIEW lead_source_summary
WITH (security_invoker = true)
AS
SELECT
  l.source_id,
  ls.source_key,
  ls.name AS source_name,
  COALESCE(l.source_channel, ls.channel) AS channel,
  COALESCE(l.source_medium, ls.utm_medium) AS medium,
  COALESCE(l.source_campaign, ls.utm_campaign) AS campaign,
  l.owner_id,
  COUNT(l.id) AS total_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'converted') AS converted_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'ready') AS ready_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'prepping') AS prepping_leads,
  MIN(l.created_at) AS first_lead_at,
  MAX(l.created_at) AS last_lead_at
FROM leads l
LEFT JOIN lead_sources ls ON ls.id = l.source_id
WHERE l.deleted_at IS NULL
GROUP BY
  l.source_id,
  ls.source_key,
  ls.name,
  COALESCE(l.source_channel, ls.channel),
  COALESCE(l.source_medium, ls.utm_medium),
  COALESCE(l.source_campaign, ls.utm_campaign),
  l.owner_id;

GRANT SELECT ON lead_source_summary TO authenticated;

-- 1.11 Fix team_meeting_analytics
DROP VIEW IF EXISTS team_meeting_analytics CASCADE;
CREATE VIEW team_meeting_analytics
WITH (security_invoker = true)
AS
SELECT
  p.id as user_id,
  COALESCE(
    NULLIF(TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))), ''),
    p.email
  ) as full_name,
  p.email,
  COUNT(m.id) as total_meetings,
  AVG(m.sentiment_score) as avg_sentiment,
  AVG(m.talk_time_rep_pct) as avg_talk_time,
  AVG(m.coach_rating) as avg_coach_rating,
  COUNT(CASE WHEN m.sentiment_score > 0.2 THEN 1 END) as positive_meetings,
  COUNT(CASE WHEN m.sentiment_score < -0.2 THEN 1 END) as negative_meetings,
  SUM(m.duration_minutes) as total_duration_minutes,
  MAX(m.meeting_start) as last_meeting_date,
  MIN(m.meeting_start) as first_meeting_date
FROM profiles p
LEFT JOIN meetings m ON m.owner_user_id = p.id
WHERE m.meeting_start >= NOW() - INTERVAL '30 days'
  OR m.meeting_start IS NULL
GROUP BY p.id, p.first_name, p.last_name, p.email;

GRANT SELECT ON team_meeting_analytics TO authenticated;

-- ============================================================================
-- PART 2: Fix Exposed Auth Users in deal_migration_review_details
-- Replace auth.users reference with profiles table
-- ============================================================================

DROP VIEW IF EXISTS deal_migration_review_details CASCADE;
CREATE VIEW deal_migration_review_details
WITH (security_invoker = true)
AS
SELECT
  dmr.id AS review_id,
  dmr.deal_id,
  dmr.reason,
  dmr.status,
  dmr.original_company,
  dmr.original_contact_name,
  dmr.original_contact_email,
  dmr.suggested_company_id,
  dmr.suggested_contact_id,
  dmr.resolution_notes,
  dmr.created_at AS flagged_at,
  dmr.resolved_at,
  d.name AS deal_name,
  d.value AS deal_value,
  d.owner_id,
  -- Use profiles instead of auth.users to avoid exposing auth data
  p.email AS owner_email,
  sc.name AS suggested_company_name,
  sct.full_name AS suggested_contact_name
FROM deal_migration_reviews dmr
JOIN deals d ON dmr.deal_id = d.id
LEFT JOIN profiles p ON d.owner_id = p.id
LEFT JOIN companies sc ON dmr.suggested_company_id = sc.id
LEFT JOIN contacts sct ON dmr.suggested_contact_id = sct.id
WHERE dmr.status = 'pending'
ORDER BY dmr.created_at DESC;

GRANT SELECT ON deal_migration_review_details TO authenticated;

-- ============================================================================
-- PART 3: Enable RLS on Tables (27 tables)
-- ============================================================================

-- 3.1 Category A: Public Read, Admin Write (Reference Data)
-- stages table
ALTER TABLE stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stages_authenticated_read" ON stages;
CREATE POLICY "stages_authenticated_read" ON stages
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "stages_admin_write" ON stages;
CREATE POLICY "stages_admin_write" ON stages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "stages_admin_update" ON stages;
CREATE POLICY "stages_admin_update" ON stages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "stages_admin_delete" ON stages;
CREATE POLICY "stages_admin_delete" ON stages
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- app_settings table
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_authenticated_read" ON app_settings;
CREATE POLICY "app_settings_authenticated_read" ON app_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "app_settings_admin_write" ON app_settings;
CREATE POLICY "app_settings_admin_write" ON app_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "app_settings_admin_update" ON app_settings;
CREATE POLICY "app_settings_admin_update" ON app_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "app_settings_admin_delete" ON app_settings;
CREATE POLICY "app_settings_admin_delete" ON app_settings
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 3.2 Category B: Admin-Only (Backup Tables)
-- meeting_action_items_backup_20250106
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meeting_action_items_backup_20250106' AND table_schema = 'public') THEN
    ALTER TABLE meeting_action_items_backup_20250106 ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "meeting_action_items_backup_admin_only" ON meeting_action_items_backup_20250106;
    CREATE POLICY "meeting_action_items_backup_admin_only" ON meeting_action_items_backup_20250106
      FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
      );
  END IF;
END $$;

-- tasks_backup_20250106
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks_backup_20250106' AND table_schema = 'public') THEN
    ALTER TABLE tasks_backup_20250106 ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "tasks_backup_admin_only" ON tasks_backup_20250106;
    CREATE POLICY "tasks_backup_admin_only" ON tasks_backup_20250106
      FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
      );
  END IF;
END $$;

-- 3.3 Category C: Service Role Only (Workflow System Tables)
-- These tables need RLS enabled but no policies - service role bypasses RLS
-- Using DO blocks to handle tables that may not exist
DO $$
DECLARE
  workflow_tables TEXT[] := ARRAY[
    'execution_checkpoints',
    'scenario_fixtures',
    'variable_storage',
    'node_fixtures',
    'workflow_environments',
    'workflow_contracts',
    'execution_snapshots',
    'workflow_dead_letter_queue',
    'workflow_rate_limits',
    'workflow_circuit_breakers',
    'http_request_recordings',
    'workflow_idempotency_keys',
    'workflow_batch_windows',
    'workflow_environment_promotions'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY workflow_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl AND table_schema = 'public') THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;
END $$;

-- 3.4 Category D: User-Scoped Data
-- user_profiles table - already has RLS enabled, just ensure it's on
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles' AND table_schema = 'public') THEN
    -- RLS is already enabled with policy in 20250817000001_add_transaction_management.sql
    -- Just ensure RLS is enabled (idempotent)
    ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
    -- Note: user_id is TEXT type, policy already exists: user_id = auth.uid()::text
  END IF;
END $$;

-- meeting_contacts table (needs user_id check via meeting ownership)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meeting_contacts' AND table_schema = 'public') THEN
    ALTER TABLE meeting_contacts ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "meeting_contacts_via_meeting" ON meeting_contacts;
    CREATE POLICY "meeting_contacts_via_meeting" ON meeting_contacts
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM meetings m
          WHERE m.id = meeting_contacts.meeting_id
          AND m.owner_user_id = auth.uid()
        )
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
      );
  END IF;
END $$;

-- contact_meeting_insights table
-- This table uses contact_id, not user_id - link through contacts table (which uses owner_id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contact_meeting_insights' AND table_schema = 'public') THEN
    ALTER TABLE contact_meeting_insights ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "contact_meeting_insights_own_data" ON contact_meeting_insights;
    CREATE POLICY "contact_meeting_insights_own_data" ON contact_meeting_insights
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM contacts c
          WHERE c.id = contact_meeting_insights.contact_id
          AND c.owner_id = auth.uid()
        )
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
      );
  END IF;
END $$;

-- company_meeting_insights table
-- This table uses company_id, not user_id - link through companies table (which uses owner_id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'company_meeting_insights' AND table_schema = 'public') THEN
    ALTER TABLE company_meeting_insights ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "company_meeting_insights_own_data" ON company_meeting_insights;
    CREATE POLICY "company_meeting_insights_own_data" ON company_meeting_insights
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM companies co
          WHERE co.id = company_meeting_insights.company_id
          AND co.owner_id = auth.uid()
        )
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
      );
  END IF;
END $$;

-- pipeline_stage_recommendations table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pipeline_stage_recommendations' AND table_schema = 'public') THEN
    ALTER TABLE pipeline_stage_recommendations ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "pipeline_stage_recommendations_own_data" ON pipeline_stage_recommendations;
    CREATE POLICY "pipeline_stage_recommendations_own_data" ON pipeline_stage_recommendations
      FOR ALL TO authenticated
      USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
      );
  END IF;
END $$;

-- workflow_executions table (user-scoped)
-- Note: This table may already have RLS from another migration
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_executions' AND table_schema = 'public') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'workflow_executions' AND policyname = 'workflow_executions_own_data'
    ) THEN
      ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

      CREATE POLICY "workflow_executions_own_data" ON workflow_executions
        FOR ALL TO authenticated
        USING (
          user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
        );
    END IF;
  END IF;
END $$;

-- 3.5 Category E: Org-Scoped Data
-- deal_migration_reviews table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deal_migration_reviews' AND table_schema = 'public') THEN
    ALTER TABLE deal_migration_reviews ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "deal_migration_reviews_admin_only" ON deal_migration_reviews;
    CREATE POLICY "deal_migration_reviews_admin_only" ON deal_migration_reviews
      FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
      );
  END IF;
END $$;

-- 3.6 Category F: Integration/Sync Tables (Admin Only)
-- clerk_sync_log table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clerk_sync_log' AND table_schema = 'public') THEN
    ALTER TABLE clerk_sync_log ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "clerk_sync_log_admin_only" ON clerk_sync_log;
    CREATE POLICY "clerk_sync_log_admin_only" ON clerk_sync_log
      FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
      );
  END IF;
END $$;

-- webhook_mirror_config table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'webhook_mirror_config' AND table_schema = 'public') THEN
    ALTER TABLE webhook_mirror_config ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "webhook_mirror_config_admin_only" ON webhook_mirror_config;
    CREATE POLICY "webhook_mirror_config_admin_only" ON webhook_mirror_config
      FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
      );
  END IF;
END $$;

-- ============================================================================
-- PART 4: Add Comments
-- ============================================================================

COMMENT ON VIEW v_failed_transcript_retries IS 'View of all failed transcript retry jobs for monitoring (security_invoker enabled)';
COMMENT ON VIEW v_pending_transcript_retries IS 'View of all pending/processing transcript retry jobs (security_invoker enabled)';
COMMENT ON VIEW v_transcript_retry_stats IS 'Aggregate statistics for transcript retry system (security_invoker enabled)';
COMMENT ON VIEW deal_splits_with_users IS 'Deal splits with user profile information (security_invoker enabled)';
COMMENT ON VIEW deal_activities_with_profile IS 'Deal activities with user profile information (security_invoker enabled)';
COMMENT ON VIEW client_churn_analytics IS 'View for analyzing client churn patterns (security_invoker enabled)';
COMMENT ON VIEW deal_migration_review_details IS 'Admin view for deal migration reviews (security_invoker enabled, auth.users exposure fixed)';
COMMENT ON VIEW calendar_events_with_contacts IS 'Calendar events with contact/company info (security_invoker enabled)';
COMMENT ON VIEW user_task_list_configs IS 'User task list configurations (security_invoker enabled)';
COMMENT ON VIEW lead_source_summary IS 'Aggregated lead metrics by source (security_invoker enabled)';
COMMENT ON VIEW team_meeting_analytics IS 'Aggregated team meeting metrics (security_invoker enabled)';

-- ============================================================================
-- Migration Complete
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Security Linter Errors Fixed Successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Summary:';
  RAISE NOTICE '  - Fixed 12 Security Definer Views (security_invoker = true)';
  RAISE NOTICE '  - Fixed 1 Exposed Auth Users issue (deal_migration_review_details)';
  RAISE NOTICE '  - Enabled RLS on 27 tables with appropriate policies';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 RLS Categories:';
  RAISE NOTICE '  - Category A (Public Read): stages, app_settings';
  RAISE NOTICE '  - Category B (Admin Only): backup tables';
  RAISE NOTICE '  - Category C (Service Role): workflow_* tables';
  RAISE NOTICE '  - Category D (User-Scoped): user_profiles, insights tables';
  RAISE NOTICE '  - Category E (Org-Scoped): deal_migration_reviews';
  RAISE NOTICE '  - Category F (Admin Only): sync/integration tables';
  RAISE NOTICE '';
END $$;
