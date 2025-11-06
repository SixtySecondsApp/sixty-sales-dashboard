-- Check if contact email domains match existing company domains

-- Query 1: How many contacts have matching companies by domain?
SELECT
  'Match Statistics' as analysis,
  COUNT(*) as total_contacts,
  COUNT(CASE WHEN co.id IS NOT NULL THEN 1 END) as contacts_with_matching_company,
  ROUND(100.0 * COUNT(CASE WHEN co.id IS NOT NULL THEN 1 END) / COUNT(*), 1) as match_rate_pct
FROM contacts c
LEFT JOIN companies co ON LOWER(co.domain) = LOWER(TRIM(SUBSTRING(c.email FROM '@(.*)$')))
WHERE c.company_id IS NULL;

-- Query 2: Sample of contacts with matching companies
SELECT
  'Contacts With Matches' as analysis,
  c.id as contact_id,
  c.email as contact_email,
  LOWER(TRIM(SUBSTRING(c.email FROM '@(.*)$'))) as extracted_domain,
  co.id as company_id,
  co.name as company_name,
  co.domain as company_domain
FROM contacts c
INNER JOIN companies co ON LOWER(co.domain) = LOWER(TRIM(SUBSTRING(c.email FROM '@(.*)$')))
WHERE c.company_id IS NULL
LIMIT 20;

-- Query 3: Sample of contacts WITHOUT matching companies
SELECT
  'Contacts Without Matches' as analysis,
  c.id as contact_id,
  c.email as contact_email,
  LOWER(TRIM(SUBSTRING(c.email FROM '@(.*)$'))) as extracted_domain
FROM contacts c
WHERE c.company_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM companies co
    WHERE LOWER(co.domain) = LOWER(TRIM(SUBSTRING(c.email FROM '@(.*)$')))
  )
LIMIT 20;

-- Query 4: Count companies by domain
SELECT
  'Company Domain Stats' as analysis,
  COUNT(*) as total_companies,
  COUNT(domain) as companies_with_domain,
  COUNT(DISTINCT LOWER(domain)) as unique_domains
FROM companies
WHERE domain IS NOT NULL;
