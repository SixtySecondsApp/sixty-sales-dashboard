-- ============================================================================
-- MIGRATION RECOVERY SCRIPT
-- Run this to check current state and clean up partial migrations
-- ============================================================================

-- STEP 1: Check what's already applied
-- ============================================================================

DO $$
DECLARE
  v_migration_count INTEGER;
BEGIN
  -- Check migration count
  SELECT COUNT(*) INTO v_migration_count
  FROM supabase_migrations.schema_migrations
  WHERE version LIKE '20251025%';

  RAISE NOTICE 'Found % October 25 migrations already applied', v_migration_count;
  RAISE NOTICE 'Expected: 16 total migrations';
END $$;

-- List all applied migrations
SELECT
  version,
  name
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20251025%'
ORDER BY version;

-- STEP 2: Check for partially applied migrations
-- ============================================================================

-- Check Migration #3 (meeting_contacts table)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meeting_contacts') THEN
    RAISE NOTICE 'Migration #3: meeting_contacts table EXISTS';
  ELSE
    RAISE NOTICE 'Migration #3: meeting_contacts table MISSING';
  END IF;
END $$;

-- Check Migration #5 (insights tables)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contact_meeting_insights') THEN
    RAISE NOTICE 'Migration #5: contact_meeting_insights table EXISTS';
  ELSE
    RAISE NOTICE 'Migration #5: contact_meeting_insights table MISSING';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'company_meeting_insights') THEN
    RAISE NOTICE 'Migration #5: company_meeting_insights table EXISTS';
  ELSE
    RAISE NOTICE 'Migration #5: company_meeting_insights table MISSING';
  END IF;
END $$;

-- STEP 3: Identify problematic indexes that are blocking re-runs
-- ============================================================================

SELECT
  'Index exists: ' || indexname as status,
  tablename,
  indexname
FROM pg_indexes
WHERE indexname IN (
  -- Migration #3 indexes
  'idx_meeting_contacts_meeting',
  'idx_meeting_contacts_contact',
  'idx_meeting_contacts_primary',
  'idx_meetings_primary_contact',
  -- Migration #5 indexes
  'idx_contact_insights_contact',
  'idx_contact_insights_last_meeting',
  'idx_company_insights_company',
  'idx_company_insights_last_meeting'
)
ORDER BY indexname;

-- STEP 4: Check if migrations were recorded in schema_migrations
-- ============================================================================

WITH expected_migrations AS (
  SELECT unnest(ARRAY[
    '20251025000001',
    '20251025000002',
    '20251025000003',
    '20251025000004',
    '20251025000005',
    '20251025000006',
    '20251025000007',
    '20251025200000',
    '20251025201000',
    '20251025202000',
    '20251025203000',
    '20251025210000',
    '20251025210500'
  ]) as version
)
SELECT
  em.version,
  CASE
    WHEN sm.version IS NOT NULL THEN '✅ Applied'
    ELSE '❌ Missing'
  END as status
FROM expected_migrations em
LEFT JOIN supabase_migrations.schema_migrations sm ON sm.version = em.version
ORDER BY em.version;

-- STEP 5: Recommendation
-- ============================================================================

DO $$
DECLARE
  v_migration_count INTEGER;
  v_tables_exist INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_migration_count
  FROM supabase_migrations.schema_migrations
  WHERE version LIKE '20251025%';

  SELECT COUNT(*) INTO v_tables_exist
  FROM information_schema.tables
  WHERE table_name IN ('meeting_contacts', 'contact_meeting_insights', 'company_meeting_insights');

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DIAGNOSIS:';
  RAISE NOTICE '========================================';

  IF v_migration_count = 0 AND v_tables_exist > 0 THEN
    RAISE NOTICE 'Issue: Tables exist but migrations not recorded in schema_migrations';
    RAISE NOTICE 'Cause: Migrations were applied manually without recording';
    RAISE NOTICE 'Solution: Run RECORD_EXISTING_MIGRATIONS.sql to mark them as applied';
  ELSIF v_migration_count > 0 AND v_tables_exist > 0 THEN
    RAISE NOTICE 'Status: Some migrations already applied';
    RAISE NOTICE 'Solution: Continue with next migration in sequence';
    RAISE NOTICE 'Check output above to see which migrations are complete';
  ELSIF v_migration_count = 0 AND v_tables_exist = 0 THEN
    RAISE NOTICE 'Status: No migrations applied yet';
    RAISE NOTICE 'Solution: Start with migration #1';
  ELSE
    RAISE NOTICE 'Status: Partial application detected';
    RAISE NOTICE 'Solution: Review output above and continue with next migration';
  END IF;

  RAISE NOTICE '========================================';
END $$;
