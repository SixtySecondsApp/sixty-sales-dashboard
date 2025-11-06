-- Rollback and Re-run Entity Resolution Migration
-- This script fixes the RLS permission issue that caused the initial migration to fail

-- Step 1: Rollback failed migration data
BEGIN;

-- Remove flagged reviews (they'll be recreated correctly)
DELETE FROM deal_migration_reviews;

-- Clear any partially created entity relationships
UPDATE deals
SET company_id = NULL,
    primary_contact_id = NULL,
    updated_at = NOW()
WHERE id IN (
  -- Only clear deals that were touched by the failed migration
  SELECT d.id
  FROM deals d
  WHERE d.company_id IS NOT NULL
    AND d.company_id IN (
      SELECT id FROM companies
      WHERE created_at >= (SELECT created_at FROM deal_migration_reviews ORDER BY created_at LIMIT 1)
    )
);

COMMIT;

-- Step 2: Drop and recreate functions with SECURITY DEFINER
DROP FUNCTION IF EXISTS migrate_deal_entities(RECORD);
DROP FUNCTION IF EXISTS resolve_deal_migration_review(UUID, UUID, UUID, UUID, TEXT);

-- Recreate migrate_deal_entities with SECURITY DEFINER
CREATE OR REPLACE FUNCTION migrate_deal_entities(deal_record RECORD)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER  -- Run with privileges of function owner to bypass RLS
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
      -- Create new company
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
      -- Fallback strategy: Fuzzy name matching within same company (>80% similarity)
      SELECT id INTO v_contact_id
      FROM contacts
      WHERE company_id = v_company_id
        AND similarity(full_name, deal_record.contact_name) > 0.8
      ORDER BY similarity(full_name, deal_record.contact_name) DESC
      LIMIT 1;

      IF v_contact_id IS NULL THEN
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
      ELSE
        -- Update fuzzy match with email
        UPDATE contacts
        SET email = LOWER(TRIM(deal_record.contact_email)),
            updated_at = NOW()
        WHERE id = v_contact_id;
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

-- Recreate resolve function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION resolve_deal_migration_review(
  p_review_id UUID,
  p_company_id UUID,
  p_contact_id UUID,
  p_resolved_by UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER  -- Run with privileges of function owner to bypass RLS
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deal_id UUID;
BEGIN
  -- Get deal_id from review
  SELECT deal_id INTO v_deal_id
  FROM deal_migration_reviews
  WHERE id = p_review_id
    AND status = 'pending';

  IF v_deal_id IS NULL THEN
    RAISE EXCEPTION 'Review not found or already resolved';
  END IF;

  -- Update deal with resolved entities
  UPDATE deals
  SET company_id = p_company_id,
      primary_contact_id = p_contact_id,
      updated_at = NOW()
  WHERE id = v_deal_id;

  -- Mark review as resolved
  UPDATE deal_migration_reviews
  SET status = 'resolved',
      suggested_company_id = p_company_id,
      suggested_contact_id = p_contact_id,
      resolution_notes = p_notes,
      resolved_at = NOW(),
      resolved_by = p_resolved_by
  WHERE id = p_review_id;

  RETURN TRUE;
END;
$$;

-- Step 3: Re-run migration with fixed functions
DO $$
DECLARE
  deal_record RECORD;
  migration_result JSONB;
  success_count INTEGER := 0;
  skip_count INTEGER := 0;
  error_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting entity resolution migration (retry with SECURITY DEFINER)...';

  FOR deal_record IN
    SELECT id, company, contact_name, contact_email, owner_id
    FROM deals
    WHERE (company_id IS NULL OR primary_contact_id IS NULL)
      AND contact_email IS NOT NULL
      AND contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
      AND contact_name IS NOT NULL
      AND TRIM(contact_name) != ''
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

        IF success_count % 100 = 0 THEN
          RAISE NOTICE 'Migrated % deals...', success_count;
        END IF;
      ELSE
        -- Flag for review if entities couldn't be created
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

  RAISE NOTICE 'Migration complete: % success, % skipped, % errors', success_count, skip_count, error_count;
END $$;

-- Step 4: Flag deals without valid email for manual review
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
    WHEN contact_name IS NULL OR TRIM(contact_name) = '' THEN 'fuzzy_match_uncertainty'  -- Changed from 'no_contact_name'
    ELSE 'fuzzy_match_uncertainty'
  END,
  company,
  contact_name,
  contact_email
FROM deals
WHERE (company_id IS NULL OR primary_contact_id IS NULL)
  AND (
    contact_email IS NULL
    OR NOT contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    OR contact_name IS NULL
    OR TRIM(contact_name) = ''
  )
ON CONFLICT DO NOTHING;

-- Step 5: Final report
DO $$
DECLARE
  total_deals INTEGER;
  migrated_deals INTEGER;
  pending_reviews INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_deals FROM deals;
  SELECT COUNT(*) INTO migrated_deals
  FROM deals
  WHERE company_id IS NOT NULL AND primary_contact_id IS NOT NULL;
  SELECT COUNT(*) INTO pending_reviews
  FROM deal_migration_reviews
  WHERE status = 'pending';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Entity Resolution Migration Summary (RETRY)';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total deals: %', total_deals;
  RAISE NOTICE 'Successfully migrated: % (%.1f%%)',
    migrated_deals,
    (migrated_deals::FLOAT / NULLIF(total_deals, 0) * 100);
  RAISE NOTICE 'Pending manual review: % (%.1f%%)',
    pending_reviews,
    (pending_reviews::FLOAT / NULLIF(total_deals, 0) * 100);
  RAISE NOTICE '========================================';
END $$;
