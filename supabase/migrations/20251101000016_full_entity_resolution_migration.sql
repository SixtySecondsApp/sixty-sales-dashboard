-- Full Entity Resolution Migration
-- Based on successful diagnostics from Migration 15
-- This version will migrate ALL deals with valid emails

-- Step 1: Clean up test data from diagnostics
DELETE FROM contacts WHERE email IN ('test@test.com', 'test@example.com');
DELETE FROM companies WHERE name = 'Test Company';

-- Step 2: Disable user-defined triggers only (not system triggers)
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE 'Disabling user-defined triggers...';
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
  RAISE WARNING 'Could not disable triggers: %', SQLERRM;
END $$;

-- Step 3: Clear existing deal relationships
DO $$
DECLARE
  updated_deals INTEGER;
BEGIN
  TRUNCATE TABLE deal_migration_reviews CASCADE;

  UPDATE deals
  SET company_id = NULL,
      primary_contact_id = NULL,
      updated_at = NOW();

  GET DIAGNOSTICS updated_deals = ROW_COUNT;
  RAISE NOTICE 'Cleared % deal entity relationships', updated_deals;
END $$;

-- Step 4: Delete orphaned contacts (not referenced by deals OR meetings)
DO $$
DECLARE
  deleted_contacts INTEGER;
BEGIN
  DELETE FROM contacts c
  WHERE NOT EXISTS (SELECT 1 FROM deals WHERE primary_contact_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM meetings WHERE primary_contact_id = c.id);

  GET DIAGNOSTICS deleted_contacts = ROW_COUNT;
  RAISE NOTICE 'Deleted % orphaned contacts', deleted_contacts;
END $$;

-- Step 5: Delete orphaned companies (not referenced by deals OR meetings)
DO $$
DECLARE
  deleted_companies INTEGER;
BEGIN
  DELETE FROM companies c
  WHERE NOT EXISTS (SELECT 1 FROM deals WHERE company_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM meetings WHERE company_id = c.id);

  GET DIAGNOSTICS deleted_companies = ROW_COUNT;
  RAISE NOTICE 'Deleted % orphaned companies', deleted_companies;
END $$;

-- Step 6: Verify migration function exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'migrate_deal_entities'
  ) THEN
    RAISE EXCEPTION 'Migration function migrate_deal_entities does not exist! Run Migration 13 first.';
  END IF;

  RAISE NOTICE 'Migration function verified';
END $$;

-- Step 7: Run full migration for ALL deals with valid emails
DO $$
DECLARE
  deal_record RECORD;
  migration_result JSONB;
  success_count INTEGER := 0;
  skip_count INTEGER := 0;
  error_count INTEGER := 0;
  total_to_migrate INTEGER;
BEGIN
  -- Count total deals to migrate
  SELECT COUNT(*) INTO total_to_migrate
  FROM deals
  WHERE contact_email IS NOT NULL
    AND contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';

  RAISE NOTICE '=== STARTING FULL MIGRATION ===';
  RAISE NOTICE 'Total deals with valid emails: %', total_to_migrate;

  FOR deal_record IN
    SELECT id, company, contact_name, contact_email, owner_id
    FROM deals
    WHERE contact_email IS NOT NULL
      AND contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    ORDER BY created_at DESC  -- Process newest deals first
  LOOP
    BEGIN
      migration_result := migrate_deal_entities(deal_record);

      IF (migration_result->>'success')::BOOLEAN THEN
        -- Update deal with new entity relationships
        UPDATE deals
        SET company_id = (migration_result->>'company_id')::UUID,
            primary_contact_id = (migration_result->>'contact_id')::UUID,
            updated_at = NOW()
        WHERE id = deal_record.id;

        success_count := success_count + 1;

        -- Progress updates every 50 deals
        IF success_count % 50 = 0 THEN
          RAISE NOTICE 'Migrated % of % deals (%.1f%%)...',
                       success_count, total_to_migrate,
                       (success_count::FLOAT / total_to_migrate * 100);
        END IF;
      ELSE
        -- Flag for manual review
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
      -- Log error and flag for review
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

  RAISE NOTICE '=== MIGRATION COMPLETE ===';
  RAISE NOTICE 'Success: % (%.1f%%)', success_count, (success_count::FLOAT / total_to_migrate * 100);
  RAISE NOTICE 'Skipped: % (%.1f%%)', skip_count, (skip_count::FLOAT / total_to_migrate * 100);
  RAISE NOTICE 'Errors: % (%.1f%%)', error_count, (error_count::FLOAT / total_to_migrate * 100);
END $$;

-- Step 8: Flag deals without valid email for manual review
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

-- Step 9: Re-enable user-defined triggers
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE 'Re-enabling user-defined triggers...';
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
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not re-enable triggers: %', SQLERRM;
END $$;

-- Step 10: Final report
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
  WHERE created_at >= NOW() - INTERVAL '10 minutes';

  SELECT COUNT(*) INTO contacts_created
  FROM contacts
  WHERE created_at >= NOW() - INTERVAL '10 minutes';

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

  IF migrated_deals::FLOAT / NULLIF(total_deals, 0) >= 0.90 THEN
    RAISE NOTICE '✅ SUCCESS - Migration achieved ≥90%% coverage!';
  ELSIF migrated_deals::FLOAT / NULLIF(total_deals, 0) >= 0.80 THEN
    RAISE NOTICE '⚠️  PARTIAL SUCCESS - Migration achieved ≥80%% coverage';
  ELSE
    RAISE WARNING '❌ MIGRATION NEEDS REVIEW - Coverage below 80%%';
  END IF;
END $$;
