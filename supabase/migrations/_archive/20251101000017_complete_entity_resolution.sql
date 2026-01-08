-- Complete Entity Resolution Migration
-- Self-contained version that includes function definition
-- This ensures the function exists before running the migration

-- Step 1: Clean up any test data
DELETE FROM contacts WHERE email IN ('test@test.com', 'test@example.com');
DELETE FROM companies WHERE name = 'Test Company';

-- Step 2: Disable user-defined triggers
DO $$
DECLARE
  r RECORD;
BEGIN
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
    EXECUTE format('ALTER TABLE %I.%I DISABLE TRIGGER %I',
                   r.schemaname, r.tablename, r.trigname);
  END LOOP;
END $$;

-- Step 3: Clear deal relationships
DO $$
BEGIN
  TRUNCATE TABLE deal_migration_reviews CASCADE;

  UPDATE deals
  SET company_id = NULL,
      primary_contact_id = NULL,
      updated_at = NOW();
END $$;

-- Step 4: Delete orphaned entities
DELETE FROM contacts c
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE primary_contact_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM meetings WHERE primary_contact_id = c.id);

DELETE FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM meetings WHERE company_id = c.id);

-- Step 5: Create/Replace migration function
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

        IF v_contact_id IS NULL THEN
          -- Create new contact
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

-- Step 6: Run migration for ALL deals
DO $$
DECLARE
  deal_record RECORD;
  migration_result JSONB;
  success_count INTEGER := 0;
  error_count INTEGER := 0;
  total_count INTEGER := 0;
BEGIN
  FOR deal_record IN
    SELECT id, company, contact_name, contact_email, owner_id
    FROM deals
    WHERE contact_email IS NOT NULL
      AND contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    ORDER BY created_at DESC
  LOOP
    total_count := total_count + 1;

    BEGIN
      migration_result := migrate_deal_entities(deal_record);

      IF (migration_result->>'success')::BOOLEAN THEN
        UPDATE deals
        SET company_id = (migration_result->>'company_id')::UUID,
            primary_contact_id = (migration_result->>'contact_id')::UUID,
            updated_at = NOW()
        WHERE id = deal_record.id;

        success_count := success_count + 1;
      ELSE
        error_count := error_count + 1;

        INSERT INTO deal_migration_reviews (
          deal_id,
          reason,
          original_company,
          original_contact_name,
          original_contact_email
        )
        VALUES (
          deal_record.id,
          'entity_creation_failed',
          deal_record.company,
          deal_record.contact_name,
          deal_record.contact_email
        );
      END IF;

    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;

      INSERT INTO deal_migration_reviews (
        deal_id,
        reason,
        original_company,
        original_contact_name,
        original_contact_email,
        resolution_notes
      )
      VALUES (
        deal_record.id,
        'entity_creation_failed',
        deal_record.company,
        deal_record.contact_name,
        deal_record.contact_email,
        SQLERRM
      )
      ON CONFLICT DO NOTHING;
    END;
  END LOOP;

  RAISE NOTICE 'Migration complete: % total, % success, % errors',
               total_count, success_count, error_count;
END $$;

-- Step 7: Flag invalid deals
INSERT INTO deal_migration_reviews (
  deal_id,
  reason,
  original_company,
  original_contact_name,
  original_contact_email
)
SELECT
  id,
  CASE
    WHEN contact_email IS NULL THEN 'no_email'
    WHEN NOT contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN 'invalid_email'
    ELSE 'fuzzy_match_uncertainty'
  END,
  company,
  contact_name,
  contact_email
FROM deals
WHERE company_id IS NULL OR primary_contact_id IS NULL
ON CONFLICT DO NOTHING;

-- Step 8: Re-enable triggers
DO $$
DECLARE
  r RECORD;
BEGIN
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
  END LOOP;
END $$;

-- Step 9: Final report
DO $$
DECLARE
  total_deals INTEGER;
  migrated_deals INTEGER;
  new_companies INTEGER;
  new_contacts INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_deals FROM deals;
  SELECT COUNT(*) INTO migrated_deals FROM deals WHERE company_id IS NOT NULL AND primary_contact_id IS NOT NULL;
  SELECT COUNT(*) INTO new_companies FROM companies WHERE created_at >= NOW() - INTERVAL '10 minutes';
  SELECT COUNT(*) INTO new_contacts FROM contacts WHERE created_at >= NOW() - INTERVAL '10 minutes';

  RAISE NOTICE '=== FINAL RESULTS ===';
  RAISE NOTICE 'Total deals: %', total_deals;
  RAISE NOTICE 'Migrated: % (%.1f%%)', migrated_deals, (migrated_deals::FLOAT / total_deals * 100);
  RAISE NOTICE 'Companies created: %', new_companies;
  RAISE NOTICE 'Contacts created: %', new_contacts;
END $$;
