-- Run this query in Supabase Dashboard SQL Editor to check migration status
-- https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/sql/new

-- 1. Check which October 25, 2025 migrations are applied
SELECT
  version,
  name,
  inserted_at
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20251025%'
ORDER BY version;

-- 2. Count total migrations applied
SELECT COUNT(*) as total_oct25_migrations
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20251025%';

-- Expected: 16 migrations total
-- If you see fewer than 16, migrations are still pending

-- 3. Check if specific tables exist (to verify what's been created)
SELECT
  table_name,
  CASE
    WHEN table_name = 'contact_meeting_insights' THEN 'Migration #5'
    WHEN table_name = 'company_meeting_insights' THEN 'Migration #5'
    WHEN table_name = 'meeting_contacts' THEN 'Migration #3'
    WHEN table_name = 'meeting_action_items' THEN 'Should exist already'
    WHEN table_name = 'pipeline_stage_recommendations' THEN 'Migration #7 (use FIX version)'
    WHEN table_name = 'task_notifications' THEN 'Migration #9'
    ELSE 'Other'
  END as created_by
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'contact_meeting_insights',
    'company_meeting_insights',
    'meeting_contacts',
    'meeting_action_items',
    'pipeline_stage_recommendations',
    'task_notifications'
  )
ORDER BY table_name;

-- 4. Check if problematic indexes exist (indicates partial migration application)
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE indexname IN (
  'idx_contact_insights_contact',
  'idx_company_insights_company',
  'idx_meeting_contacts_meeting',
  'idx_meeting_contacts_contact'
)
ORDER BY indexname;

-- 5. Check new columns added by migrations
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'companies' AND column_name IN ('source', 'first_seen_at'))
    OR (table_name = 'contacts' AND column_name IN ('source', 'first_seen_at'))
    OR (table_name = 'meetings' AND column_name IN ('transcript_text', 'source', 'first_seen_at'))
    OR (table_name = 'meeting_action_items' AND column_name IN ('task_id', 'sync_status', 'ai_task_type'))
    OR (table_name = 'activities' AND column_name = 'meeting_id')
  )
ORDER BY table_name, column_name;
