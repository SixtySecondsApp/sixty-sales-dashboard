-- Check Contact-Company Relationship Status

-- Query 1: Contact Coverage
SELECT
  'Contact Coverage' as analysis,
  COUNT(*) as total_contacts,
  COUNT(company_id) as contacts_with_company,
  COUNT(CASE WHEN company_id IS NULL THEN 1 END) as contacts_without_company,
  ROUND(100.0 * COUNT(company_id) / COUNT(*), 1) as coverage_pct
FROM contacts;

-- Query 2: Contacts without companies (orphaned contacts)
SELECT
  'Orphaned Contacts' as analysis,
  id as contact_id,
  email,
  first_name,
  last_name,
  LOWER(TRIM(SUBSTRING(email FROM '@(.*)$'))) as email_domain
FROM contacts
WHERE company_id IS NULL
LIMIT 20;

-- Query 3: Company Coverage
SELECT
  'Company Coverage' as analysis,
  COUNT(*) as total_companies,
  COUNT(CASE WHEN EXISTS (SELECT 1 FROM contacts WHERE company_id = companies.id) THEN 1 END) as companies_with_contacts,
  COUNT(CASE WHEN NOT EXISTS (SELECT 1 FROM contacts WHERE company_id = companies.id) THEN 1 END) as companies_without_contacts,
  ROUND(100.0 * COUNT(CASE WHEN EXISTS (SELECT 1 FROM contacts WHERE company_id = companies.id) THEN 1 END) / COUNT(*), 1) as coverage_pct
FROM companies;

-- Query 4: Companies without contacts (orphaned companies)
SELECT
  'Orphaned Companies' as analysis,
  c.id as company_id,
  c.name as company_name,
  c.domain,
  (SELECT COUNT(*) FROM deals WHERE company_id = c.id) as deal_count
FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE company_id = c.id)
ORDER BY (SELECT COUNT(*) FROM deals WHERE company_id = c.id) DESC
LIMIT 20;

-- Query 5: Summary stats
SELECT
  'Summary' as analysis,
  (SELECT COUNT(*) FROM contacts WHERE company_id IS NOT NULL) as linked_contacts,
  (SELECT COUNT(*) FROM contacts WHERE company_id IS NULL) as unlinked_contacts,
  (SELECT COUNT(*) FROM companies WHERE EXISTS (SELECT 1 FROM contacts WHERE company_id = companies.id)) as companies_with_contacts,
  (SELECT COUNT(*) FROM companies WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE company_id = companies.id)) as companies_without_contacts;
