-- Simple Entity Linking - Just UPDATE existing records
-- No deletions, no complex logic, just link what exists

-- Step 1: Link contacts to companies by email domain
UPDATE contacts c
SET company_id = co.id,
    updated_at = NOW()
FROM companies co
WHERE c.company_id IS NULL
  AND LOWER(co.domain) = LOWER(TRIM(SUBSTRING(c.email FROM '@(.*)$')));

-- Step 2: Link deals to contacts and companies
UPDATE deals d
SET company_id = c.company_id,
    primary_contact_id = c.id,
    updated_at = NOW()
FROM contacts c
WHERE d.company_id IS NULL
  AND d.contact_email IS NOT NULL
  AND LOWER(TRIM(c.email)) = LOWER(TRIM(d.contact_email))
  AND c.company_id IS NOT NULL;

-- Step 3: Final report
SELECT
  'Final Coverage Report' as status,
  COUNT(*) as total_deals,
  COUNT(company_id) as with_company,
  COUNT(primary_contact_id) as with_contact,
  ROUND(100.0 * COUNT(company_id) / COUNT(*), 1) as company_coverage_pct,
  ROUND(100.0 * COUNT(primary_contact_id) / COUNT(*), 1) as contact_coverage_pct,
  COUNT(CASE WHEN company_id IS NOT NULL AND primary_contact_id IS NOT NULL THEN 1 END) as fully_linked,
  ROUND(100.0 * COUNT(CASE WHEN company_id IS NOT NULL AND primary_contact_id IS NOT NULL THEN 1 END) / COUNT(*), 1) as fully_linked_pct
FROM deals;
