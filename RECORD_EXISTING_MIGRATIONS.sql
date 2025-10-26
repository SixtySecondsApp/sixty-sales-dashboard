-- ============================================================================
-- RECORD EXISTING MIGRATIONS
-- Use this if tables exist but migrations aren't recorded in schema_migrations
-- This prevents "already exists" errors by marking migrations as complete
-- ============================================================================

-- Check current state first
DO $$
DECLARE
  v_meeting_contacts_exists BOOLEAN;
  v_insights_exists BOOLEAN;
  v_migration_3_recorded BOOLEAN;
  v_migration_5_recorded BOOLEAN;
BEGIN
  -- Check if tables exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'meeting_contacts'
  ) INTO v_meeting_contacts_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'contact_meeting_insights'
  ) INTO v_insights_exists;

  -- Check if migrations are recorded
  SELECT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version = '20251025000003'
  ) INTO v_migration_3_recorded;

  SELECT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version = '20251025000005'
  ) INTO v_migration_5_recorded;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'CURRENT STATE:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'meeting_contacts table: %', CASE WHEN v_meeting_contacts_exists THEN 'EXISTS' ELSE 'MISSING' END;
  RAISE NOTICE 'Migration #3 recorded: %', CASE WHEN v_migration_3_recorded THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE '';
  RAISE NOTICE 'insights tables: %', CASE WHEN v_insights_exists THEN 'EXISTS' ELSE 'MISSING' END;
  RAISE NOTICE 'Migration #5 recorded: %', CASE WHEN v_migration_5_recorded THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE '========================================';

  -- Record Migration #3 if table exists but not recorded
  IF v_meeting_contacts_exists AND NOT v_migration_3_recorded THEN
    INSERT INTO supabase_migrations.schema_migrations (version, name)
    VALUES ('20251025000003', 'create_meeting_contacts_junction')
    ON CONFLICT (version) DO NOTHING;
    RAISE NOTICE '✅ Recorded Migration #3 as applied';
  END IF;

  -- Record Migration #5 if table exists but not recorded
  IF v_insights_exists AND NOT v_migration_5_recorded THEN
    INSERT INTO supabase_migrations.schema_migrations (version, name)
    VALUES ('20251025000005', 'create_meeting_insights_tables')
    ON CONFLICT (version) DO NOTHING;
    RAISE NOTICE '✅ Recorded Migration #5 as applied';
  END IF;

  IF NOT v_meeting_contacts_exists AND NOT v_insights_exists THEN
    RAISE NOTICE 'No tables found - migrations have not been applied yet';
  END IF;
END $$;

-- Verify the recording worked
SELECT
  version,
  name
FROM supabase_migrations.schema_migrations
WHERE version IN ('20251025000003', '20251025000005')
ORDER BY version;
