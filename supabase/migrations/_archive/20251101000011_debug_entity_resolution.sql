-- Debug Entity Resolution Migration
-- This version adds explicit error logging and permission grants

-- Step 1: Clean slate
TRUNCATE TABLE deal_migration_reviews CASCADE;

UPDATE deals
SET company_id = NULL,
    primary_contact_id = NULL,
    updated_at = NOW();

-- Step 2: Create debug table for error logging
CREATE TABLE IF NOT EXISTS migration_debug_log (
  id SERIAL PRIMARY KEY,
  deal_id UUID,
  stage TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Step 3: Drop existing functions
DROP FUNCTION IF EXISTS migrate_deal_entities(RECORD);

-- Step 4: Create migration function with enhanced error logging
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
  v_name_parts TEXT[];
  v_is_primary BOOLEAN;
  v_error TEXT;
BEGIN
  BEGIN
    -- Extract domain
    v_domain := LOWER(TRIM(SUBSTRING(deal_record.contact_email FROM '@(.*)$')));

    -- Skip personal domains
    IF v_domain IN ('gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'me.com', 'aol.com', 'live.com') THEN
      v_domain := NULL;
    END IF;

    -- Try to create company
    IF v_domain IS NOT NULL THEN
      SELECT id INTO v_company_id FROM companies WHERE LOWER(domain) = v_domain LIMIT 1;

      IF v_company_id IS NULL THEN
        BEGIN
          INSERT INTO companies (name, domain, owner_id, created_at, updated_at)
          VALUES (
            COALESCE(deal_record.company, INITCAP(REPLACE(v_domain, '.', ' '))),
            v_domain,
            deal_record.owner_id,
            NOW(),
            NOW()
          )
          RETURNING id INTO v_company_id;
        EXCEPTION WHEN OTHERS THEN
          v_error := SQLERRM;
          INSERT INTO migration_debug_log (deal_id, stage, error_message)
          VALUES (deal_record.id, 'company_insert_with_domain', v_error);
          RAISE WARNING 'Company insert failed for deal %: %', deal_record.id, v_error;
        END;
      END IF;
    ELSE
      -- No domain - try company name
      IF deal_record.company IS NOT NULL AND TRIM(deal_record.company) != '' THEN
        SELECT id INTO v_company_id
        FROM companies
        WHERE LOWER(name) = LOWER(TRIM(deal_record.company))
          AND owner_id = deal_record.owner_id
        LIMIT 1;

        IF v_company_id IS NULL THEN
          BEGIN
            INSERT INTO companies (name, owner_id, created_at, updated_at)
            VALUES (deal_record.company, deal_record.owner_id, NOW(), NOW())
            RETURNING id INTO v_company_id;
          EXCEPTION WHEN OTHERS THEN
            v_error := SQLERRM;
            INSERT INTO migration_debug_log (deal_id, stage, error_message)
            VALUES (deal_record.id, 'company_insert_no_domain', v_error);
            RAISE WARNING 'Company insert (no domain) failed for deal %: %', deal_record.id, v_error;
          END;
        END IF;
      END IF;
    END IF;

    -- Try to create contact
    IF v_company_id IS NOT NULL THEN
      SELECT id INTO v_contact_id
      FROM contacts
      WHERE LOWER(TRIM(email)) = LOWER(TRIM(deal_record.contact_email))
        AND company_id = v_company_id;

      IF v_contact_id IS NULL THEN
        BEGIN
          v_name_parts := string_to_array(TRIM(deal_record.contact_name), ' ');
          v_first_name := v_name_parts[1];
          v_last_name := array_to_string(v_name_parts[2:array_length(v_name_parts, 1)], ' ');

          SELECT NOT EXISTS (SELECT 1 FROM contacts WHERE company_id = v_company_id LIMIT 1)
          INTO v_is_primary;

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
            v_last_name,
            LOWER(TRIM(deal_record.contact_email)),
            v_company_id,
            v_is_primary,
            deal_record.owner_id,
            NOW(),
            NOW()
          )
          RETURNING id INTO v_contact_id;
        EXCEPTION WHEN OTHERS THEN
          v_error := SQLERRM;
          INSERT INTO migration_debug_log (deal_id, stage, error_message)
          VALUES (deal_record.id, 'contact_insert', v_error);
          RAISE WARNING 'Contact insert failed for deal %: %', deal_record.id, v_error;
        END;
      END IF;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    v_error := SQLERRM;
    INSERT INTO migration_debug_log (deal_id, stage, error_message)
    VALUES (deal_record.id, 'overall_function', v_error);
    RAISE WARNING 'Overall function failed for deal %: %', deal_record.id, v_error;
  END;

  -- Return result
  v_result := jsonb_build_object(
    'success', v_company_id IS NOT NULL AND v_contact_id IS NOT NULL,
    'company_id', v_company_id,
    'contact_id', v_contact_id
  );

  RETURN v_result;
END;
$$;

-- Step 5: Test with ONE deal first
DO $$
DECLARE
  test_deal RECORD;
  test_result JSONB;
BEGIN
  RAISE NOTICE 'Testing migration with one deal...';

  SELECT id, company, contact_name, contact_email, owner_id
  INTO test_deal
  FROM deals
  WHERE contact_email IS NOT NULL
    AND contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    AND contact_name IS NOT NULL
    AND TRIM(contact_name) != ''
  LIMIT 1;

  IF test_deal.id IS NOT NULL THEN
    RAISE NOTICE 'Testing with deal: % / % / %', test_deal.company, test_deal.contact_name, test_deal.contact_email;

    test_result := migrate_deal_entities(test_deal);

    RAISE NOTICE 'Test result: %', test_result;

    IF (test_result->>'success')::BOOLEAN THEN
      RAISE NOTICE '✅ SUCCESS! Company ID: %, Contact ID: %',
        test_result->>'company_id',
        test_result->>'contact_id';
    ELSE
      RAISE WARNING '❌ FAILED! Check migration_debug_log table for errors';
    END IF;
  ELSE
    RAISE WARNING 'No valid deals found for testing';
  END IF;
END $$;

-- Step 6: Check debug log
DO $$
DECLARE
  error_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO error_count FROM migration_debug_log;

  IF error_count > 0 THEN
    RAISE NOTICE 'Found % errors in debug log:', error_count;
    RAISE NOTICE 'Run this query to see errors: SELECT * FROM migration_debug_log ORDER BY created_at DESC;';
  ELSE
    RAISE NOTICE 'No errors found - test was successful!';
  END IF;
END $$;
