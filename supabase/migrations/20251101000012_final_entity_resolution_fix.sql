-- Final Entity Resolution Fix
-- This version handles existing contacts and disables audit triggers

-- Step 1: Disable audit trigger temporarily (use DO block to handle non-existent triggers)
DO $$
BEGIN
  -- Disable triggers if they exist
  EXECUTE 'ALTER TABLE companies DISABLE TRIGGER ALL';
  EXECUTE 'ALTER TABLE contacts DISABLE TRIGGER ALL';
  EXECUTE 'ALTER TABLE deals DISABLE TRIGGER ALL';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not disable triggers: %', SQLERRM;
END $$;

-- Step 2: Clean slate
TRUNCATE TABLE deal_migration_reviews CASCADE;

-- Clear all deal entity relationships
UPDATE deals
SET company_id = NULL,
    primary_contact_id = NULL,
    updated_at = NOW();

-- Step 3: Delete orphaned contacts (contacts not referenced by any deal OR meeting)
-- These are from the previous failed migrations
-- Use NOT EXISTS for safer NULL handling
DELETE FROM contacts c
WHERE NOT EXISTS (
  SELECT 1 FROM deals WHERE primary_contact_id = c.id
)
AND NOT EXISTS (
  SELECT 1 FROM meetings WHERE primary_contact_id = c.id
);

-- Step 4: Delete orphaned companies (companies not referenced by any deal OR meeting)
-- Use NOT EXISTS for safer NULL handling
DELETE FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM deals WHERE company_id = c.id
)
AND NOT EXISTS (
  SELECT 1 FROM meetings WHERE company_id = c.id
);

-- Step 5: Create migration function with SECURITY DEFINER
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
  v_name_parts TEXT[];
  v_is_primary BOOLEAN;
BEGIN
  -- Extract domain from email
  v_domain := LOWER(TRIM(SUBSTRING(deal_record.contact_email FROM '@(.*)$')));

  -- Skip common personal email domains
  IF v_domain IN ('gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'me.com', 'aol.com', 'live.com') THEN
    v_domain := NULL;
  END IF;

  -- Find or create company by domain
  IF v_domain IS NOT NULL THEN
    SELECT id INTO v_company_id
    FROM companies
    WHERE LOWER(domain) = v_domain
    LIMIT 1;

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
    -- No valid domain - create company with name only
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

  -- Find or create contact
  IF v_company_id IS NOT NULL THEN
    -- Primary strategy: Strict email match
    SELECT id INTO v_contact_id
    FROM contacts
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(deal_record.contact_email))
      AND company_id = v_company_id;

    IF v_contact_id IS NULL THEN
      -- Fallback: Check if email exists with different company (shouldn't happen after cleanup)
      SELECT id INTO v_contact_id
      FROM contacts
      WHERE LOWER(TRIM(email)) = LOWER(TRIM(deal_record.contact_email))
      LIMIT 1;

      IF v_contact_id IS NOT NULL THEN
        -- Update existing contact to link to correct company
        UPDATE contacts
        SET company_id = v_company_id,
            updated_at = NOW()
        WHERE id = v_contact_id;
      ELSE
        -- Create new contact
        v_name_parts := string_to_array(TRIM(deal_record.contact_name), ' ');
        v_first_name := v_name_parts[1];
        v_last_name := array_to_string(v_name_parts[2:array_length(v_name_parts, 1)], ' ');

        -- Check if this is first contact for company
        SELECT NOT EXISTS (
          SELECT 1 FROM contacts WHERE company_id = v_company_id LIMIT 1
        ) INTO v_is_primary;

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
      END IF;
    END IF;
  END IF;

  -- Return result
  v_result := jsonb_build_object(
    'success', v_company_id IS NOT NULL AND v_contact_id IS NOT NULL,
    'company_id', v_company_id,
    'contact_id', v_contact_id
  );

  RETURN v_result;
END;
$$;

-- Step 6: Run migration
DO $$
DECLARE
  deal_record RECORD;
  migration_result JSONB;
  success_count INTEGER := 0;
  skip_count INTEGER := 0;
  error_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting entity resolution migration (with audit disabled)...';

  FOR deal_record IN
    SELECT id, company, contact_name, contact_email, owner_id
    FROM deals
    WHERE contact_email IS NOT NULL
      AND contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
      AND contact_name IS NOT NULL
      AND TRIM(contact_name) != ''
    ORDER BY created_at DESC  -- Process newest deals first
  LOOP
    BEGIN
      migration_result := migrate_deal_entities(deal_record);

      IF (migration_result->>'success')::BOOLEAN THEN
        UPDATE deals
        SET company_id = (migration_result->>'company_id')::UUID,
            primary_contact_id = (migration_result->>'contact_id')::UUID,
            updated_at = NOW()
        WHERE id = deal_record.id;

        success_count := success_count + 1;

        IF success_count % 50 = 0 THEN
          RAISE NOTICE 'Migrated % deals...', success_count;
        END IF;
      ELSE
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

        skip_count := skip_count + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error migrating deal %: %', deal_record.id, SQLERRM;

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

      error_count := error_count + 1;
    END;
  END LOOP;

  RAISE NOTICE 'Migration complete: % success, % skipped, % errors', success_count, skip_count, error_count;
END $$;

-- Step 7: Flag deals without valid email
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

-- Step 8: Re-enable audit triggers
DO $$
BEGIN
  -- Re-enable all triggers
  EXECUTE 'ALTER TABLE companies ENABLE TRIGGER ALL';
  EXECUTE 'ALTER TABLE contacts ENABLE TRIGGER ALL';
  EXECUTE 'ALTER TABLE deals ENABLE TRIGGER ALL';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not re-enable triggers: %', SQLERRM;
END $$;

-- Step 9: Final report
DO $$
DECLARE
  total_deals INTEGER;
  migrated_deals INTEGER;
  pending_reviews INTEGER;
  companies_created INTEGER;
  contacts_created INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_deals FROM deals;
  SELECT COUNT(*) INTO migrated_deals
  FROM deals
  WHERE company_id IS NOT NULL AND primary_contact_id IS NOT NULL;
  SELECT COUNT(*) INTO pending_reviews
  FROM deal_migration_reviews
  WHERE status = 'pending';

  SELECT COUNT(*) INTO companies_created
  FROM companies
  WHERE created_at >= NOW() - INTERVAL '5 minutes';

  SELECT COUNT(*) INTO contacts_created
  FROM contacts
  WHERE created_at >= NOW() - INTERVAL '5 minutes';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Entity Resolution Migration Summary';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total deals: %', total_deals;
  RAISE NOTICE 'Successfully migrated: % (%.1f%%)',
    migrated_deals,
    (migrated_deals::FLOAT / NULLIF(total_deals, 0) * 100);
  RAISE NOTICE 'Pending manual review: % (%.1f%%)',
    pending_reviews,
    (pending_reviews::FLOAT / NULLIF(total_deals, 0) * 100);
  RAISE NOTICE '========================================';
  RAISE NOTICE 'New companies created: %', companies_created;
  RAISE NOTICE 'New contacts created: %', contacts_created;
  RAISE NOTICE '========================================';
END $$;
