-- Auto-Create Company from Contact Email
-- This trigger automatically creates companies when new contacts are added

-- Step 1: Create function to auto-create company from contact email
CREATE OR REPLACE FUNCTION auto_create_company_from_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_domain TEXT;
  v_company_id UUID;
  v_company_name TEXT;
BEGIN
  -- Only process if contact has email and no company_id yet
  IF NEW.email IS NOT NULL AND NEW.company_id IS NULL THEN

    -- Extract domain from email
    v_domain := LOWER(TRIM(SUBSTRING(NEW.email FROM '@(.*)$')));

    -- Skip personal email domains
    IF v_domain NOT IN ('gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
                         'icloud.com', 'me.com', 'aol.com', 'live.com', 'msn.com',
                         'protonmail.com', 'yandex.com', 'mail.com') THEN

      -- Check if company with this domain already exists
      SELECT id INTO v_company_id
      FROM companies
      WHERE LOWER(domain) = v_domain
      LIMIT 1;

      -- If company doesn't exist, create it
      IF v_company_id IS NULL THEN
        -- Generate company name from domain (capitalize first letter of each word)
        v_company_name := INITCAP(REPLACE(SPLIT_PART(v_domain, '.', 1), '-', ' '));

        -- Create the company
        INSERT INTO companies (
          name,
          domain,
          owner_id,
          source,
          created_at,
          updated_at
        )
        VALUES (
          v_company_name,
          v_domain,
          COALESCE(NEW.owner_id, (SELECT id FROM auth.users LIMIT 1)),
          'auto_contact',  -- Mark as auto-created from contact
          NOW(),
          NOW()
        )
        RETURNING id INTO v_company_id;

        RAISE NOTICE 'Auto-created company: % (%) for contact: %', v_company_name, v_domain, NEW.email;
      END IF;

      -- Link contact to company
      NEW.company_id := v_company_id;

    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Step 2: Create trigger on contacts table
DROP TRIGGER IF EXISTS trigger_auto_create_company_from_contact ON contacts;

CREATE TRIGGER trigger_auto_create_company_from_contact
  BEFORE INSERT OR UPDATE OF email
  ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_company_from_contact();

-- Step 3: Add comment for documentation
COMMENT ON FUNCTION auto_create_company_from_contact() IS
'Automatically creates a company from contact email domain if one does not exist.
Skips personal email domains (gmail, outlook, etc.).
Runs before INSERT or UPDATE on contacts table.';

-- Step 4: Test the trigger with a sample
DO $$
DECLARE
  test_contact_id UUID;
  test_company_id UUID;
  test_email TEXT := 'test@autocompany-test.com';
BEGIN
  RAISE NOTICE '=== TESTING AUTO-COMPANY CREATION ===';

  -- Disable audit trigger for test
  ALTER TABLE contacts DISABLE TRIGGER IF EXISTS audit_trigger;

  -- Insert a test contact
  INSERT INTO contacts (
    first_name,
    last_name,
    email,
    owner_id,
    created_at,
    updated_at
  )
  VALUES (
    'Test',
    'User',
    test_email,
    (SELECT id FROM auth.users LIMIT 1),
    NOW(),
    NOW()
  )
  RETURNING id, company_id INTO test_contact_id, test_company_id;

  IF test_company_id IS NOT NULL THEN
    RAISE NOTICE '✅ SUCCESS - Auto-created company for contact';
    RAISE NOTICE 'Contact ID: %', test_contact_id;
    RAISE NOTICE 'Company ID: %', test_company_id;

    -- Verify company was created
    IF EXISTS (
      SELECT 1 FROM companies
      WHERE id = test_company_id
        AND domain = 'autocompany-test.com'
    ) THEN
      RAISE NOTICE '✅ VERIFIED - Company exists with correct domain';
    END IF;

    -- Clean up test data
    DELETE FROM contacts WHERE id = test_contact_id;
    DELETE FROM companies WHERE id = test_company_id;
    RAISE NOTICE '✅ Test data cleaned up';
  ELSE
    RAISE WARNING '❌ FAILED - Company was not auto-created';
  END IF;

  -- Test with personal email (should NOT create company)
  INSERT INTO contacts (
    first_name,
    email,
    owner_id,
    created_at,
    updated_at
  )
  VALUES (
    'Gmail',
    'test@gmail.com',
    (SELECT id FROM auth.users LIMIT 1),
    NOW(),
    NOW()
  )
  RETURNING id, company_id INTO test_contact_id, test_company_id;

  IF test_company_id IS NULL THEN
    RAISE NOTICE '✅ SUCCESS - Personal email (gmail.com) correctly skipped';
    DELETE FROM contacts WHERE id = test_contact_id;
  ELSE
    RAISE WARNING '❌ FAILED - Personal email should not create company';
    DELETE FROM contacts WHERE id = test_contact_id;
  END IF;

  -- Re-enable audit trigger
  ALTER TABLE contacts ENABLE TRIGGER IF EXISTS audit_trigger;

  RAISE NOTICE '=== TEST COMPLETE ===';

END $$;

-- Step 5: Report
SELECT
  'Trigger Status' as status,
  'Auto-company creation enabled for new contacts' as message,
  'Personal emails (gmail, outlook, etc.) are skipped' as note;
