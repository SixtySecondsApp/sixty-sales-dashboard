-- Show Orphaned Entities

-- Show the 12 contacts without companies
SELECT
  'Orphaned Contacts (no company)' as type,
  id,
  email,
  first_name,
  last_name,
  LOWER(TRIM(SUBSTRING(email FROM '@(.*)$'))) as email_domain
FROM contacts
WHERE company_id IS NULL
ORDER BY email;

-- Show the 12 companies without contacts
SELECT
  'Orphaned Companies (no contacts)' as type,
  id,
  name,
  domain,
  (SELECT COUNT(*) FROM deals WHERE company_id = companies.id) as deal_count
FROM companies
WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE company_id = companies.id)
ORDER BY (SELECT COUNT(*) FROM deals WHERE company_id = companies.id) DESC;
