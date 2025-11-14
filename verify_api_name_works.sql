-- Verify api_name column exists and is working correctly
-- Run this in Supabase SQL Editor

-- 1. Check if api_name column exists
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'booking_sources'
  AND column_name = 'api_name';

-- Expected: 1 row with data_type = 'text', is_nullable = 'NO' (or 'YES' if not yet set to NOT NULL)

-- 2. Check if unique constraint exists on api_name
SELECT
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'booking_sources'
  AND constraint_name LIKE '%api_name%';

-- Expected: 1 row with constraint_type = 'UNIQUE'

-- 3. Check if index exists on api_name
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'booking_sources'
  AND indexname LIKE '%api_name%';

-- Expected: 1 row with indexname = 'idx_booking_sources_api_name'

-- 4. Verify all existing sources have api_name populated
SELECT
  name,
  api_name,
  CASE 
    WHEN api_name IS NULL THEN '❌ MISSING'
    WHEN api_name = '' THEN '❌ EMPTY'
    WHEN api_name !~ '^[a-z0-9_]+$' THEN '❌ INVALID FORMAT'
    ELSE '✅ OK'
  END as status
FROM booking_sources
ORDER BY sort_order, name;

-- Expected: All rows should show '✅ OK'

-- 5. Check for duplicate api_name values
SELECT
  api_name,
  COUNT(*) as count
FROM booking_sources
WHERE api_name IS NOT NULL
GROUP BY api_name
HAVING COUNT(*) > 1;

-- Expected: 0 rows (no duplicates)

-- 6. Sample data to verify structure
SELECT
  id,
  name,
  api_name,
  category,
  is_active,
  sort_order
FROM booking_sources
ORDER BY sort_order, name
LIMIT 10;

-- 7. Test query by api_name (example)
SELECT
  name,
  api_name,
  category
FROM booking_sources
WHERE api_name = 'facebook_ads';

-- Expected: 1 row with name = 'Facebook Ads'

-- Summary
DO $$
DECLARE
  v_column_exists BOOLEAN;
  v_index_exists BOOLEAN;
  v_null_count INTEGER;
  v_duplicate_count INTEGER;
BEGIN
  -- Check column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'booking_sources'
      AND column_name = 'api_name'
  ) INTO v_column_exists;

  -- Check index exists
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'booking_sources'
      AND indexname = 'idx_booking_sources_api_name'
  ) INTO v_index_exists;

  -- Count NULL api_name values
  SELECT COUNT(*) INTO v_null_count
  FROM booking_sources
  WHERE api_name IS NULL;

  -- Count duplicates
  SELECT COUNT(*) INTO v_duplicate_count
  FROM (
    SELECT api_name, COUNT(*) as cnt
    FROM booking_sources
    WHERE api_name IS NOT NULL
    GROUP BY api_name
    HAVING COUNT(*) > 1
  ) duplicates;

  RAISE NOTICE '=== API_NAME VERIFICATION SUMMARY ===';
  RAISE NOTICE 'Column exists: %', v_column_exists;
  RAISE NOTICE 'Index exists: %', v_index_exists;
  RAISE NOTICE 'NULL api_name count: %', v_null_count;
  RAISE NOTICE 'Duplicate api_name count: %', v_duplicate_count;
  
  IF v_column_exists AND v_index_exists AND v_null_count = 0 AND v_duplicate_count = 0 THEN
    RAISE NOTICE '✅ ALL CHECKS PASSED - api_name is working correctly!';
  ELSE
    RAISE NOTICE '⚠️  SOME ISSUES DETECTED - Review the results above';
  END IF;
END $$;


