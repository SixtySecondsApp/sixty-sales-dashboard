-- Check what companies exist and their domains

-- Query 1: Count companies with domains
SELECT
  'Company Statistics' as analysis,
  COUNT(*) as total_companies,
  COUNT(domain) as with_domain,
  COUNT(CASE WHEN domain IS NULL THEN 1 END) as without_domain;

-- Query 2: Sample of companies
SELECT
  'Company Sample' as analysis,
  id,
  name,
  domain,
  created_at
FROM companies
ORDER BY created_at DESC
LIMIT 20;

-- Query 3: Check if domains match contact emails
SELECT
  'Domain Match Check' as analysis,
  COUNT(DISTINCT c.id) as contacts_with_matching_domain_company
FROM contacts c
WHERE EXISTS (
  SELECT 1 FROM companies co
  WHERE LOWER(co.domain) = LOWER(TRIM(SUBSTRING(c.email FROM '@(.*)$')))
);

-- Query 4: Sample contact emails vs company domains
SELECT
  'Email to Domain Mapping' as analysis,
  c.email as contact_email,
  LOWER(TRIM(SUBSTRING(c.email FROM '@(.*)$'))) as extracted_domain,
  co.id as matching_company_id,
  co.name as matching_company_name,
  co.domain as company_domain
FROM contacts c
LEFT JOIN companies co ON LOWER(co.domain) = LOWER(TRIM(SUBSTRING(c.email FROM '@(.*)$')))
WHERE c.company_id IS NULL
LIMIT 20;
