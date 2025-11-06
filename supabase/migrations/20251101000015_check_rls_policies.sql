-- Check RLS Policies and Permissions
-- This will show us what's blocking the migration

-- Check 1: RLS Status on tables
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '=== RLS STATUS ===';

  FOR r IN
    SELECT schemaname, tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('companies', 'contacts', 'deals')
    ORDER BY tablename
  LOOP
    RAISE NOTICE 'Table %.%: RLS %', r.schemaname, r.tablename,
                 CASE WHEN r.rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END;
  END LOOP;
END $$;

-- Check 2: Active RLS Policies
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '=== ACTIVE RLS POLICIES ===';

  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, qual
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('companies', 'contacts', 'deals')
    ORDER BY tablename, policyname
  LOOP
    RAISE NOTICE 'Policy: %.% - % (Command: %)',
                 r.tablename, r.policyname, r.cmd, r.qual;
  END LOOP;
END $$;

-- Check 3: Test INSERT without migration function
DO $$
DECLARE
  test_company_id UUID;
  test_contact_id UUID;
BEGIN
  RAISE NOTICE '=== DIRECT INSERT TEST ===';

  -- Try to insert a company directly
  BEGIN
    INSERT INTO companies (name, domain, owner_id, created_at, updated_at)
    VALUES ('Test Company', 'test.com',
            (SELECT id FROM auth.users LIMIT 1),
            NOW(), NOW())
    RETURNING id INTO test_company_id;

    RAISE NOTICE '✅ Company insert succeeded: %', test_company_id;

    -- Try to insert a contact
    INSERT INTO contacts (first_name, last_name, email, company_id, owner_id, created_at, updated_at)
    VALUES ('Test', 'User', 'test@test.com', test_company_id,
            (SELECT id FROM auth.users LIMIT 1),
            NOW(), NOW())
    RETURNING id INTO test_contact_id;

    RAISE NOTICE '✅ Contact insert succeeded: %', test_contact_id;

    -- Clean up test data
    DELETE FROM contacts WHERE id = test_contact_id;
    DELETE FROM companies WHERE id = test_company_id;

    RAISE NOTICE '✅ Direct inserts work - RLS is not the issue';

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌ Direct insert failed: %', SQLERRM;
  END;
END $$;

-- Check 4: Test migration function with explicit deal data
DO $$
DECLARE
  test_result JSONB;
  test_deal RECORD;
BEGIN
  RAISE NOTICE '=== MIGRATION FUNCTION TEST ===';

  -- Create a test deal record manually
  SELECT
    gen_random_uuid() as id,
    'Test Company' as company,
    'Test User' as contact_name,
    'test@example.com' as contact_email,
    (SELECT id FROM auth.users LIMIT 1) as owner_id
  INTO test_deal;

  RAISE NOTICE 'Testing with deal:';
  RAISE NOTICE '  Company: %', test_deal.company;
  RAISE NOTICE '  Contact: %', test_deal.contact_name;
  RAISE NOTICE '  Email: %', test_deal.contact_email;

  BEGIN
    test_result := migrate_deal_entities(test_deal);

    RAISE NOTICE 'Result: %', test_result;

    IF (test_result->>'success')::BOOLEAN THEN
      RAISE NOTICE '✅ Function returned success';
      RAISE NOTICE '  Company ID: %', test_result->>'company_id';
      RAISE NOTICE '  Contact ID: %', test_result->>'contact_id';

      -- Verify entities exist
      IF EXISTS (SELECT 1 FROM companies WHERE id = (test_result->>'company_id')::UUID) THEN
        RAISE NOTICE '  ✅ Company was created';
        DELETE FROM companies WHERE id = (test_result->>'company_id')::UUID;
      ELSE
        RAISE WARNING '  ❌ Company NOT found in database!';
      END IF;

      IF EXISTS (SELECT 1 FROM contacts WHERE id = (test_result->>'contact_id')::UUID) THEN
        RAISE NOTICE '  ✅ Contact was created';
        DELETE FROM contacts WHERE id = (test_result->>'contact_id')::UUID;
      ELSE
        RAISE WARNING '  ❌ Contact NOT found in database!';
      END IF;

    ELSE
      RAISE WARNING '❌ Function returned success=false';
    END IF;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌ Function call failed: %', SQLERRM;
  END;
END $$;

-- Check 5: Check function definition
DO $$
DECLARE
  func_def TEXT;
BEGIN
  RAISE NOTICE '=== FUNCTION DEFINITION ===';

  SELECT prosecdef INTO func_def
  FROM pg_proc
  WHERE proname = 'migrate_deal_entities';

  IF func_def IS NOT NULL THEN
    RAISE NOTICE 'Function exists with SECURITY DEFINER: %', func_def;
  ELSE
    RAISE WARNING 'Function not found!';
  END IF;
END $$;
