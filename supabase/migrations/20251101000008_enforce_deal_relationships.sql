-- Schema Enforcement Migration
-- IMPORTANT: Run ONLY AFTER migration (20250201000001) and manual review completion
-- Makes company_id and primary_contact_id NOT NULL to enforce business rule:
-- "Every deal must have both a company and a contact"

-- Step 1: Verify migration completeness
DO $$
DECLARE
  orphan_count INTEGER;
  pending_reviews INTEGER;
BEGIN
  -- Check for deals without entities
  SELECT COUNT(*) INTO orphan_count
  FROM deals
  WHERE company_id IS NULL OR primary_contact_id IS NULL;

  -- Check for pending reviews
  SELECT COUNT(*) INTO pending_reviews
  FROM deal_migration_reviews
  WHERE status = 'pending';

  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Cannot enforce NOT NULL constraints: % deals still lack company_id or primary_contact_id. Please resolve pending reviews first.', orphan_count;
  END IF;

  IF pending_reviews > 0 THEN
    RAISE WARNING 'There are % pending migration reviews. Consider resolving them before enforcing constraints.', pending_reviews;
  END IF;

  RAISE NOTICE 'Pre-enforcement check passed: All deals have entity relationships';
END $$;

-- Step 2: Add NOT NULL constraints
-- This enforces the business rule going forward
ALTER TABLE deals
  ALTER COLUMN company_id SET NOT NULL,
  ALTER COLUMN primary_contact_id SET NOT NULL;

-- Step 3: Use trigger to ensure contact belongs to deal's company
-- Note: PostgreSQL doesn't support cross-table composite FK constraints
-- We use a trigger instead to validate that contact belongs to the deal's company
CREATE OR REPLACE FUNCTION validate_deal_contact_company()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_contact_company_id UUID;
BEGIN
  -- Get the company_id of the contact
  SELECT company_id INTO v_contact_company_id
  FROM contacts
  WHERE id = NEW.primary_contact_id;

  -- Verify it matches the deal's company
  IF v_contact_company_id IS NULL THEN
    RAISE EXCEPTION 'Contact % does not have a company assigned', NEW.primary_contact_id;
  END IF;

  IF v_contact_company_id != NEW.company_id THEN
    RAISE EXCEPTION 'Contact % belongs to company %, but deal is for company %',
      NEW.primary_contact_id, v_contact_company_id, NEW.company_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for INSERT and UPDATE
DROP TRIGGER IF EXISTS trg_validate_deal_contact_company ON deals;

CREATE TRIGGER trg_validate_deal_contact_company
  BEFORE INSERT OR UPDATE OF company_id, primary_contact_id
  ON deals
  FOR EACH ROW
  EXECUTE FUNCTION validate_deal_contact_company();

-- Step 4: Add performance indexes
CREATE INDEX IF NOT EXISTS idx_deals_company_id ON deals(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_primary_contact_id ON deals(primary_contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_company_contact ON deals(company_id, primary_contact_id);

-- Add index for company domain lookups (entity resolution performance)
CREATE INDEX IF NOT EXISTS idx_companies_domain_lower ON companies(LOWER(domain));

-- Add index for contact email lookups (entity resolution performance)
CREATE INDEX IF NOT EXISTS idx_contacts_email_lower ON contacts(LOWER(email));

-- Add index for fuzzy matching performance
CREATE INDEX IF NOT EXISTS idx_contacts_full_name_trgm ON contacts USING gin(full_name gin_trgm_ops);

-- Step 5: Update RLS policies to include new constraints
-- Ensure users can only see/modify deals with proper entity relationships

-- Refresh RLS policy for deals (if exists)
DROP POLICY IF EXISTS "Users can view their own deals" ON deals;

CREATE POLICY "Users can view their own deals"
  ON deals FOR SELECT
  USING (
    auth.uid() = owner_id
    AND company_id IS NOT NULL
    AND primary_contact_id IS NOT NULL
  );

DROP POLICY IF EXISTS "Users can insert their own deals" ON deals;

CREATE POLICY "Users can insert their own deals"
  ON deals FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id
    AND company_id IS NOT NULL
    AND primary_contact_id IS NOT NULL
  );

DROP POLICY IF EXISTS "Users can update their own deals" ON deals;

CREATE POLICY "Users can update their own deals"
  ON deals FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (
    auth.uid() = owner_id
    AND company_id IS NOT NULL
    AND primary_contact_id IS NOT NULL
  );

-- Step 6: Add helpful view for deal relationships
CREATE OR REPLACE VIEW deal_entity_details AS
SELECT
  d.id AS deal_id,
  d.name AS deal_name,
  d.value AS deal_value,
  d.stage_id,
  ds.name AS stage_name,
  d.company_id,
  c.name AS company_name,
  c.domain AS company_domain,
  d.primary_contact_id,
  ct.full_name AS contact_name,
  ct.email AS contact_email,
  ct.phone AS contact_phone,
  ct.title AS contact_title,
  ct.is_primary AS is_primary_contact,
  d.owner_id,
  u.email AS owner_email,
  d.created_at,
  d.updated_at
FROM deals d
JOIN companies c ON d.company_id = c.id
JOIN contacts ct ON d.primary_contact_id = ct.id
JOIN deal_stages ds ON d.stage_id = ds.id
LEFT JOIN auth.users u ON d.owner_id = u.id;

-- Step 7: Create validation function for manual checks
CREATE OR REPLACE FUNCTION validate_all_deal_entities()
RETURNS TABLE (
  deal_id UUID,
  issue TEXT,
  company_id UUID,
  contact_id UUID,
  contact_company_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id AS deal_id,
    CASE
      WHEN d.company_id IS NULL THEN 'Missing company_id'
      WHEN d.primary_contact_id IS NULL THEN 'Missing primary_contact_id'
      WHEN ct.company_id IS NULL THEN 'Contact has no company'
      WHEN ct.company_id != d.company_id THEN 'Contact company mismatch'
      ELSE 'Unknown issue'
    END AS issue,
    d.company_id,
    d.primary_contact_id AS contact_id,
    ct.company_id AS contact_company_id
  FROM deals d
  LEFT JOIN contacts ct ON d.primary_contact_id = ct.id
  WHERE
    d.company_id IS NULL
    OR d.primary_contact_id IS NULL
    OR ct.company_id IS NULL
    OR ct.company_id != d.company_id;
END;
$$;

-- Step 8: Final validation and report
DO $$
DECLARE
  total_deals INTEGER;
  valid_deals INTEGER;
  invalid_deals INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_deals FROM deals;
  SELECT COUNT(*) INTO valid_deals
  FROM deals d
  JOIN contacts ct ON d.primary_contact_id = ct.id
  WHERE d.company_id IS NOT NULL
    AND d.primary_contact_id IS NOT NULL
    AND ct.company_id = d.company_id;

  invalid_deals := total_deals - valid_deals;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Schema Enforcement Summary';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total deals: %', total_deals;
  RAISE NOTICE 'Valid (with proper entities): % (%.1f%%)',
    valid_deals,
    (valid_deals::FLOAT / NULLIF(total_deals, 0) * 100);
  RAISE NOTICE 'Invalid: %', invalid_deals;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'NOT NULL constraints enforced on:';
  RAISE NOTICE '  - company_id';
  RAISE NOTICE '  - primary_contact_id';
  RAISE NOTICE 'Trigger created to validate contact belongs to company';
  RAISE NOTICE '========================================';

  IF invalid_deals > 0 THEN
    RAISE WARNING 'Found % invalid deals. Run SELECT * FROM validate_all_deal_entities() to investigate', invalid_deals;
  END IF;
END $$;

-- Step 9: Add comment documentation
COMMENT ON COLUMN deals.company_id IS 'Foreign key to companies table. Required - every deal must have a company.';
COMMENT ON COLUMN deals.primary_contact_id IS 'Foreign key to contacts table. Required - every deal must have a primary contact. Contact must belong to the deal company.';
COMMENT ON TRIGGER trg_validate_deal_contact_company ON deals IS 'Ensures the primary contact belongs to the same company as the deal.';
COMMENT ON FUNCTION validate_deal_contact_company() IS 'Trigger function to validate that deal primary_contact belongs to deal company.';
COMMENT ON VIEW deal_entity_details IS 'Comprehensive view of deals with full company and contact details for reporting and analytics.';
