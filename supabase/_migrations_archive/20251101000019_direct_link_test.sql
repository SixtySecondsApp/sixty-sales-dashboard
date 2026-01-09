-- Direct Link Test - Manually link deals to existing entities
-- This bypasses the function to test if direct UPDATE works

DO $$
DECLARE
  deal_record RECORD;
  company_record RECORD;
  contact_record RECORD;
  linked_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting direct link test...';

  -- Get one deal without entities
  SELECT id, contact_email
  INTO deal_record
  FROM deals
  WHERE company_id IS NULL
    AND contact_email IS NOT NULL
    AND contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  LIMIT 1;

  IF deal_record.id IS NULL THEN
    RAISE WARNING 'No deals found without entities!';
    RETURN;
  END IF;

  RAISE NOTICE 'Testing with deal: % (email: %)', deal_record.id, deal_record.contact_email;

  -- Find matching contact
  SELECT id, company_id, email
  INTO contact_record
  FROM contacts
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(deal_record.contact_email))
  LIMIT 1;

  IF contact_record.id IS NULL THEN
    RAISE WARNING 'No contact found for email: %', deal_record.contact_email;
    RETURN;
  END IF;

  RAISE NOTICE 'Found contact: % (company: %)', contact_record.id, contact_record.company_id;

  -- Get company
  SELECT id, name
  INTO company_record
  FROM companies
  WHERE id = contact_record.company_id;

  IF company_record.id IS NULL THEN
    RAISE WARNING 'No company found for id: %', contact_record.company_id;
    RETURN;
  END IF;

  RAISE NOTICE 'Found company: % (%)', company_record.id, company_record.name;

  -- Try direct UPDATE
  BEGIN
    UPDATE deals
    SET company_id = company_record.id,
        primary_contact_id = contact_record.id,
        updated_at = NOW()
    WHERE id = deal_record.id;

    GET DIAGNOSTICS linked_count = ROW_COUNT;

    IF linked_count > 0 THEN
      RAISE NOTICE '✅ SUCCESS - Updated % deal', linked_count;

      -- Verify the update
      IF EXISTS (
        SELECT 1 FROM deals
        WHERE id = deal_record.id
          AND company_id = company_record.id
          AND primary_contact_id = contact_record.id
      ) THEN
        RAISE NOTICE '✅ VERIFIED - Deal now has entities linked';
      ELSE
        RAISE WARNING '❌ VERIFICATION FAILED - Deal still has NULL entities';
      END IF;
    ELSE
      RAISE WARNING '❌ UPDATE FAILED - No rows updated';
    END IF;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌ UPDATE ERROR: %', SQLERRM;
  END;

END $$;

-- Check result
SELECT
  COUNT(*) as total_deals,
  COUNT(company_id) as with_company,
  COUNT(primary_contact_id) as with_contact
FROM deals;
