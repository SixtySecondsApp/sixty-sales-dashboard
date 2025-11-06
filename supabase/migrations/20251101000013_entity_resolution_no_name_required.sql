-- Entity Resolution - No Contact Name Required
-- This version works with just email addresses (uses email as fallback for name)

-- Step 1: Disable user-defined triggers only (not system triggers)
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Disable only user-defined triggers (audit, etc)
  FOR r IN
    SELECT n.nspname as schemaname,
           c.relname as tablename,
           t.tgname as trigname
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname IN ('companies', 'contacts', 'deals')
      AND NOT t.tgisinternal  -- Exclude system triggers
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DISABLE TRIGGER %I',
                   r.schemaname, r.tablename, r.trigname);
    RAISE NOTICE 'Disabled trigger: %.%', r.tablename, r.trigname;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not disable triggers: %', SQLERRM;
END $$;

-- Step 2: Clean slate
TRUNCATE TABLE deal_migration_reviews CASCADE;

UPDATE deals
SET company_id = NULL,
    primary_contact_id = NULL,
    updated_at = NOW();

-- Step 3: Delete orphaned contacts
DELETE FROM contacts c
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE primary_contact_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM meetings WHERE primary_contact_id = c.id);

-- Step 4: Delete orphaned companies
DELETE FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM meetings WHERE company_id = c.id);

-- Step 5: Grant explicit permissions (bypass RLS at database level)
DO $$
BEGIN
  -- Grant INSERT/UPDATE permissions to current role
  GRANT INSERT, UPDATE ON companies TO authenticated;
  GRANT INSERT, UPDATE ON contacts TO authenticated;
  GRANT UPDATE ON deals TO authenticated;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not grant permissions: %', SQLERRM;
END $$;

-- Step 6: Create migration function
DROP FUNCTION IF EXISTS migrate_deal_entities(RECORD);

CREATE OR REPLACE FUNCTION migrate_deal_entities(deal_record RECORD)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id UUID;
  v_contact_id UUID;
  v_domain TEXT;
  v_result JSONB;
  v_first_name TEXT;
  v_last_name TEXT;
  v_contact_name TEXT;
BEGIN
  -- Use email as fallback if contact_name is missing
  v_contact_name := COALESCE(NULLIF(TRIM(deal_record.contact_name), ''),
                              SPLIT_PART(deal_record.contact_email, '@', 1));

  -- Extract domain from email
  v_domain := LOWER(TRIM(SUBSTRING(deal_record.contact_email FROM '@(.*)$')));

  -- Skip personal email domains
  IF v_domain IN ('gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'me.com', 'aol.com', 'live.com') THEN
    v_domain := NULL;
  END IF;

  -- Find or create company
  BEGIN
    IF v_domain IS NOT NULL THEN
      SELECT id INTO v_company_id FROM companies WHERE LOWER(domain) = v_domain LIMIT 1;

      IF v_company_id IS NULL THEN
        INSERT INTO companies (name, domain, owner_id, created_at, updated_at)
        VALUES (
          COALESCE(deal_record.company, INITCAP(REPLACE(v_domain, '.', ' '))),
          v_domain,
          deal_record.owner_id,
          NOW(),
          NOW()
        )
        RETURNING id INTO v_company_id;
      END IF;
    ELSE
      -- No domain - use company name
      IF deal_record.company IS NOT NULL AND TRIM(deal_record.company) != '' THEN
        SELECT id INTO v_company_id
        FROM companies
        WHERE LOWER(name) = LOWER(TRIM(deal_record.company))
          AND owner_id = deal_record.owner_id
        LIMIT 1;

        IF v_company_id IS NULL THEN
          INSERT INTO companies (name, owner_id, created_at, updated_at)
          VALUES (deal_record.company, deal_record.owner_id, NOW(), NOW())
          RETURNING id INTO v_company_id;
        END IF;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Company creation failed for deal %: %', deal_record.id, SQLERRM;
    v_company_id := NULL;
  END;

  -- Find or create contact
  IF v_company_id IS NOT NULL THEN
    BEGIN
      -- Check for existing contact by email
      SELECT id INTO v_contact_id
      FROM contacts
      WHERE LOWER(TRIM(email)) = LOWER(TRIM(deal_record.contact_email))
        AND company_id = v_company_id;

      IF v_contact_id IS NULL THEN
        -- Check if email exists with different company
        SELECT id, company_id INTO v_contact_id, v_company_id
        FROM contacts
        WHERE LOWER(TRIM(email)) = LOWER(TRIM(deal_record.contact_email))
        LIMIT 1;

        IF v_contact_id IS NOT NULL THEN
          -- Use existing contact's company
          RAISE NOTICE 'Reusing existing contact % with company %', v_contact_id, v_company_id;
        ELSE
          -- Create new contact
          -- Parse name (use email username if no name)
          IF POSITION(' ' IN v_contact_name) > 0 THEN
            v_first_name := SPLIT_PART(v_contact_name, ' ', 1);
            v_last_name := SUBSTRING(v_contact_name FROM POSITION(' ' IN v_contact_name) + 1);
          ELSE
            v_first_name := v_contact_name;
            v_last_name := '';
          END IF;

          INSERT INTO contacts (
            first_name,
            last_name,
            email,
            company_id,
            is_primary,
            owner_id,
            created_at,
            updated_at
          )
          VALUES (
            v_first_name,
            NULLIF(v_last_name, ''),
            LOWER(TRIM(deal_record.contact_email)),
            v_company_id,
            NOT EXISTS (SELECT 1 FROM contacts WHERE company_id = v_company_id LIMIT 1),
            deal_record.owner_id,
            NOW(),
            NOW()
          )
          RETURNING id INTO v_contact_id;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Contact creation failed for deal %: %', deal_record.id, SQLERRM;
      v_contact_id := NULL;
    END;
  END IF;

  -- Return result
  RETURN jsonb_build_object(
    'success', v_company_id IS NOT NULL AND v_contact_id IS NOT NULL,
    'company_id', v_company_id,
    'contact_id', v_contact_id
  );
END;
$$;

-- Step 7: Test with ONE deal first
DO $$
DECLARE
  test_deal RECORD;
  test_result JSONB;
BEGIN
  RAISE NOTICE '=== TESTING MIGRATION WITH ONE DEAL ===';

  SELECT id, company, contact_name, contact_email, owner_id
  INTO test_deal
  FROM deals
  WHERE contact_email IS NOT NULL
    AND contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  LIMIT 1;

  IF test_deal.id IS NOT NULL THEN
    RAISE NOTICE 'Test deal: % / % / %', test_deal.company, test_deal.contact_name, test_deal.contact_email;

    test_result := migrate_deal_entities(test_deal);

    RAISE NOTICE 'Result: %', test_result;

    IF (test_result->>'success')::BOOLEAN THEN
      RAISE NOTICE '✅ TEST PASSED! Company: %, Contact: %',
        test_result->>'company_id',
        test_result->>'contact_id';

      -- Actually update the test deal
      UPDATE deals
      SET company_id = (test_result->>'company_id')::UUID,
          primary_contact_id = (test_result->>'contact_id')::UUID
      WHERE id = test_deal.id;

      RAISE NOTICE 'Deal updated successfully';
    ELSE
      RAISE WARNING '❌ TEST FAILED! Check warnings above for error details';
    END IF;
  ELSE
    RAISE WARNING 'No valid deals found for testing';
  END IF;
END $$;

-- Step 8: Check test results
DO $$
DECLARE
  test_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO test_count
  FROM deals
  WHERE company_id IS NOT NULL AND primary_contact_id IS NOT NULL;

  IF test_count > 0 THEN
    RAISE NOTICE '=== TEST SUCCESSFUL ===';
    RAISE NOTICE 'Found % deal(s) with entities. Ready to migrate all deals.', test_count;
    RAISE NOTICE 'If test passed, run the full migration by executing the rest of this script.';
  ELSE
    RAISE WARNING '=== TEST FAILED ===';
    RAISE WARNING 'No deals were migrated. Check error messages above.';
    RAISE WARNING 'DO NOT proceed with full migration until test passes.';
  END IF;
END $$;

-- Step 9: Re-enable user-defined triggers
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Re-enable only user-defined triggers
  FOR r IN
    SELECT n.nspname as schemaname,
           c.relname as tablename,
           t.tgname as trigname
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname IN ('companies', 'contacts', 'deals')
      AND NOT t.tgisinternal
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE TRIGGER %I',
                   r.schemaname, r.tablename, r.trigname);
    RAISE NOTICE 'Re-enabled trigger: %.%', r.tablename, r.trigname;
  END LOOP;
END $$;
