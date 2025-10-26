-- Verify all 16 October 25, 2025 migrations are complete
-- Run this in Supabase Dashboard SQL Editor

-- Count total migrations
SELECT COUNT(*) as total_migrations
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20251025%';
-- Expected: 16

-- List all applied migrations
SELECT
  version,
  name
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20251025%'
ORDER BY version;

-- Check key tables exist
SELECT
  table_name,
  'EXISTS' as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'meeting_contacts',
    'contact_meeting_insights',
    'company_meeting_insights',
    'pipeline_stage_recommendations',
    'task_notifications'
  )
ORDER BY table_name;
-- Expected: 5 tables

-- Check key columns added
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
    OR (table_name = 'tasks' AND column_name = 'meeting_action_item_id')
  )
ORDER BY table_name, column_name;
-- Expected: 12+ columns

-- Check storage bucket exists
SELECT
  id,
  name,
  public
FROM storage.buckets
WHERE id = 'meeting-assets';
-- Expected: 1 row with public = true

-- Final summary
DO $$
DECLARE
  v_migration_count INTEGER;
  v_table_count INTEGER;
  v_bucket_exists BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO v_migration_count
  FROM supabase_migrations.schema_migrations
  WHERE version LIKE '20251025%';

  SELECT COUNT(*) INTO v_table_count
  FROM information_schema.tables
  WHERE table_name IN ('meeting_contacts', 'contact_meeting_insights', 'company_meeting_insights', 'pipeline_stage_recommendations', 'task_notifications');

  SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'meeting-assets') INTO v_bucket_exists;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION VERIFICATION SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migrations applied: % (expected: 16)', v_migration_count;
  RAISE NOTICE 'New tables created: % (expected: 5)', v_table_count;
  RAISE NOTICE 'Storage bucket exists: %', CASE WHEN v_bucket_exists THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE '';

  IF v_migration_count = 16 AND v_table_count = 5 AND v_bucket_exists THEN
    RAISE NOTICE '✅ ALL MIGRATIONS COMPLETE - Ready for Edge Functions';
  ELSE
    RAISE NOTICE '⚠️ INCOMPLETE - Review output above';
  END IF;

  RAISE NOTICE '========================================';
END $$;
