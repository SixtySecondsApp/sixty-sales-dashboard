-- Fix Orphaned Contacts - Link contacts to companies based on email domain
-- This fixes the issue where contacts have company_id = NULL

DO $$
DECLARE
  updated_count INTEGER := 0;
  r RECORD;
  v_domain TEXT;
  v_company_id UUID;
BEGIN
  RAISE NOTICE 'Fixing orphaned contacts...';

  FOR r IN
    SELECT id, email
    FROM contacts
    WHERE company_id IS NULL
      AND email IS NOT NULL
  LOOP
    -- Extract domain from email
    v_domain := LOWER(TRIM(SUBSTRING(r.email FROM '@(.*)$')));

    -- Skip personal email domains
    IF v_domain NOT IN ('gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'me.com', 'aol.com', 'live.com') THEN
      -- Find matching company by domain
      SELECT id INTO v_company_id
      FROM companies
      WHERE LOWER(domain) = v_domain
      LIMIT 1;

      IF v_company_id IS NOT NULL THEN
        -- Link contact to company
        UPDATE contacts
        SET company_id = v_company_id,
            updated_at = NOW()
        WHERE id = r.id;

        updated_count := updated_count + 1;
      END IF;
    END IF;

    v_company_id := NULL;  -- Reset for next iteration
  END LOOP;

  RAISE NOTICE 'Updated % orphaned contacts with company links', updated_count;
END $$;

-- Now run the migration again for deals without entities
DO $$
DECLARE
  deal_record RECORD;
  migration_result JSONB;
  success_count INTEGER := 0;
  error_count INTEGER := 0;
  v_company_id UUID;
  v_contact_id UUID;
BEGIN
  RAISE NOTICE 'Linking deals to fixed entities...';

  FOR deal_record IN
    SELECT id, contact_email
    FROM deals
    WHERE company_id IS NULL
      AND contact_email IS NOT NULL
      AND contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  LOOP
    -- Find contact by email
    SELECT id, company_id INTO v_contact_id, v_company_id
    FROM contacts
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(deal_record.contact_email))
      AND company_id IS NOT NULL  -- Must have company
    LIMIT 1;

    IF v_contact_id IS NOT NULL AND v_company_id IS NOT NULL THEN
      -- Link deal to entities
      UPDATE deals
      SET company_id = v_company_id,
          primary_contact_id = v_contact_id,
          updated_at = NOW()
      WHERE id = deal_record.id;

      success_count := success_count + 1;

      IF success_count % 50 = 0 THEN
        RAISE NOTICE 'Linked % deals...', success_count;
      END IF;
    ELSE
      error_count := error_count + 1;
    END IF;

    v_contact_id := NULL;
    v_company_id := NULL;
  END LOOP;

  RAISE NOTICE 'Linked % deals successfully, % failed', success_count, error_count;
END $$;

-- Final report
SELECT
  'Final Results' as status,
  COUNT(*) as total_deals,
  COUNT(company_id) as with_company,
  COUNT(primary_contact_id) as with_contact,
  ROUND(100.0 * COUNT(company_id) / COUNT(*), 1) as coverage_pct
FROM deals;
