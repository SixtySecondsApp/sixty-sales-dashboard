-- Diagnostic Migration - Check Migration 13 Failure
-- This will help us understand why no deals were migrated

-- Check 1: Do we have valid deals to migrate?
DO $$
DECLARE
  valid_deal_count INTEGER;
  sample_deal RECORD;
BEGIN
  RAISE NOTICE '=== DIAGNOSTIC CHECK 1: VALID DEALS ===';

  SELECT COUNT(*) INTO valid_deal_count
  FROM deals
  WHERE contact_email IS NOT NULL
    AND contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';

  RAISE NOTICE 'Deals with valid email: %', valid_deal_count;

  -- Get a sample deal
  SELECT id, company, contact_name, contact_email, owner_id
  INTO sample_deal
  FROM deals
  WHERE contact_email IS NOT NULL
    AND contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  LIMIT 1;

  IF sample_deal.id IS NOT NULL THEN
    RAISE NOTICE 'Sample deal found:';
    RAISE NOTICE '  ID: %', sample_deal.id;
    RAISE NOTICE '  Company: %', sample_deal.company;
    RAISE NOTICE '  Contact Name: %', sample_deal.contact_name;
    RAISE NOTICE '  Contact Email: %', sample_deal.contact_email;
    RAISE NOTICE '  Owner ID: %', sample_deal.owner_id;
  ELSE
    RAISE WARNING 'No valid deals found!';
  END IF;
END $$;

-- Check 2: Test the migration function manually
DO $$
DECLARE
  test_deal RECORD;
  test_result JSONB;
  v_company_id UUID;
  v_contact_id UUID;
BEGIN
  RAISE NOTICE '=== DIAGNOSTIC CHECK 2: FUNCTION TEST ===';

  -- Get a test deal
  SELECT id, company, contact_name, contact_email, owner_id
  INTO test_deal
  FROM deals
  WHERE contact_email IS NOT NULL
    AND contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  LIMIT 1;

  IF test_deal.id IS NULL THEN
    RAISE WARNING 'No test deal found - cannot test function!';
    RETURN;
  END IF;

  -- Call the migration function
  BEGIN
    test_result := migrate_deal_entities(test_deal);

    RAISE NOTICE 'Function returned: %', test_result;
    RAISE NOTICE 'Success: %', (test_result->>'success')::BOOLEAN;
    RAISE NOTICE 'Company ID: %', test_result->>'company_id';
    RAISE NOTICE 'Contact ID: %', test_result->>'contact_id';

    IF (test_result->>'success')::BOOLEAN THEN
      v_company_id := (test_result->>'company_id')::UUID;
      v_contact_id := (test_result->>'contact_id')::UUID;

      -- Check if entities were actually created
      IF EXISTS (SELECT 1 FROM companies WHERE id = v_company_id) THEN
        RAISE NOTICE '✅ Company exists in database';
      ELSE
        RAISE WARNING '❌ Company was NOT created in database!';
      END IF;

      IF EXISTS (SELECT 1 FROM contacts WHERE id = v_contact_id) THEN
        RAISE NOTICE '✅ Contact exists in database';
      ELSE
        RAISE WARNING '❌ Contact was NOT created in database!';
      END IF;

      -- Try to update the deal
      UPDATE deals
      SET company_id = v_company_id,
          primary_contact_id = v_contact_id,
          updated_at = NOW()
      WHERE id = test_deal.id;

      RAISE NOTICE '✅ Deal updated successfully';

    ELSE
      RAISE WARNING '❌ Migration function returned success=false';
    END IF;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Function call failed: %', SQLERRM;
  END;
END $$;

-- Check 3: Verify if the test deal was updated
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  RAISE NOTICE '=== DIAGNOSTIC CHECK 3: DEAL UPDATE STATUS ===';

  SELECT COUNT(*) INTO updated_count
  FROM deals
  WHERE company_id IS NOT NULL AND primary_contact_id IS NOT NULL;

  RAISE NOTICE 'Deals with entities: %', updated_count;

  IF updated_count > 0 THEN
    RAISE NOTICE '✅ SUCCESS - At least one deal was migrated!';
  ELSE
    RAISE WARNING '❌ FAILURE - No deals were migrated!';
  END IF;
END $$;

-- Check 4: Look for error messages in deal_migration_reviews
DO $$
DECLARE
  error_summary RECORD;
BEGIN
  RAISE NOTICE '=== DIAGNOSTIC CHECK 4: ERROR SUMMARY ===';

  FOR error_summary IN
    SELECT reason, COUNT(*) as count
    FROM deal_migration_reviews
    GROUP BY reason
    ORDER BY count DESC
  LOOP
    RAISE NOTICE 'Reason: % - Count: %', error_summary.reason, error_summary.count;
  END LOOP;
END $$;

-- Check 5: Check if migration function exists
DO $$
BEGIN
  RAISE NOTICE '=== DIAGNOSTIC CHECK 5: FUNCTION EXISTS ===';

  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'migrate_deal_entities'
  ) THEN
    RAISE NOTICE '✅ migrate_deal_entities function exists';
  ELSE
    RAISE WARNING '❌ migrate_deal_entities function does NOT exist!';
  END IF;
END $$;
