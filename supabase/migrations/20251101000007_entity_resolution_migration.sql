-- Entity Resolution Migration
-- Migrates legacy deals to use proper company_id and primary_contact_id foreign keys
-- Flags deals without valid emails for manual review
-- Uses PostgreSQL pg_trgm for fuzzy name matching

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- For fuzzy string matching

-- Step 1: Create review flag table for deals that need manual attention
CREATE TABLE IF NOT EXISTS deal_migration_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('no_email', 'invalid_email', 'fuzzy_match_uncertainty', 'entity_creation_failed')),
  original_company TEXT,
  original_contact_name TEXT,
  original_contact_email TEXT,
  suggested_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  suggested_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_deal_migration_reviews_deal_id ON deal_migration_reviews(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_migration_reviews_status ON deal_migration_reviews(status);

-- Step 2: Migration function for individual deals
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
        DECLARE
          v_first_name TEXT;
          v_last_name TEXT;
          v_name_parts TEXT[];
          v_is_primary BOOLEAN;
        BEGIN
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
        END;
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

-- Step 3: Migrate deals with valid emails
DO $$
DECLARE
  deal_record RECORD;
  migration_result JSONB;
  success_count INTEGER := 0;
  skip_count INTEGER := 0;
  error_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting entity resolution migration...';

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

-- Step 5: Create view for admin review interface
CREATE OR REPLACE VIEW deal_migration_review_details AS
SELECT
  dmr.id AS review_id,
  dmr.deal_id,
  dmr.reason,
  dmr.status,
  dmr.original_company,
  dmr.original_contact_name,
  dmr.original_contact_email,
  dmr.suggested_company_id,
  dmr.suggested_contact_id,
  dmr.resolution_notes,
  dmr.created_at AS flagged_at,
  dmr.resolved_at,
  d.name AS deal_name,
  d.value AS deal_value,
  d.owner_id,
  u.email AS owner_email,
  sc.name AS suggested_company_name,
  sct.full_name AS suggested_contact_name
FROM deal_migration_reviews dmr
JOIN deals d ON dmr.deal_id = d.id
LEFT JOIN auth.users u ON d.owner_id = u.id
LEFT JOIN companies sc ON dmr.suggested_company_id = sc.id
LEFT JOIN contacts sct ON dmr.suggested_contact_id = sct.id
WHERE dmr.status = 'pending'
ORDER BY dmr.created_at DESC;

-- Step 6: Add helpful function to resolve review
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

-- Step 7: Report migration status
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
END $$;
