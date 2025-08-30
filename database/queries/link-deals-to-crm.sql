-- Link Deals to CRM Data
-- Run this SQL in your Supabase SQL Editor to connect existing deals to contacts and companies

-- Step 1: Link deals to existing contacts by email
UPDATE deals 
SET primary_contact_id = contacts.id
FROM contacts
WHERE deals.contact_email = contacts.email
  AND deals.primary_contact_id IS NULL
  AND deals.contact_email IS NOT NULL
  AND deals.contact_email != '';

-- Step 2: Link deals to existing companies by name (exact match first)
UPDATE deals 
SET company_id = companies.id
FROM companies
WHERE LOWER(TRIM(deals.company)) = LOWER(TRIM(companies.name))
  AND deals.company_id IS NULL
  AND deals.company IS NOT NULL
  AND deals.company != '';

-- Step 3: Link deals to companies by domain (if contact email domain matches company domain)
UPDATE deals 
SET company_id = companies.id
FROM companies
WHERE deals.contact_email LIKE '%@' || companies.domain
  AND companies.domain IS NOT NULL
  AND companies.domain != ''
  AND deals.company_id IS NULL
  AND deals.contact_email IS NOT NULL
  AND deals.contact_email != '';

-- Step 4: Update contacts with company relationships if they don't have one
UPDATE contacts 
SET company_id = companies.id
FROM companies
WHERE contacts.email LIKE '%@' || companies.domain
  AND companies.domain IS NOT NULL
  AND companies.domain != ''
  AND contacts.company_id IS NULL
  AND contacts.email IS NOT NULL
  AND contacts.email != '';

-- Step 5: Create missing contacts from deals that don't have matching contacts
INSERT INTO contacts (
  email, 
  full_name, 
  first_name, 
  last_name, 
  company_id, 
  owner_id, 
  created_at, 
  updated_at,
  is_primary
)
SELECT DISTINCT
  deals.contact_email,
  deals.contact_name,
  CASE 
    WHEN deals.contact_name IS NOT NULL AND position(' ' in deals.contact_name) > 0 
    THEN split_part(deals.contact_name, ' ', 1)
    ELSE deals.contact_name
  END as first_name,
  CASE 
    WHEN deals.contact_name IS NOT NULL AND position(' ' in deals.contact_name) > 0 
    THEN substring(deals.contact_name from position(' ' in deals.contact_name) + 1)
    ELSE NULL
  END as last_name,
  companies.id as company_id,
  deals.owner_id,
  NOW(),
  NOW(),
  true
FROM deals
LEFT JOIN companies ON (
  LOWER(TRIM(deals.company)) = LOWER(TRIM(companies.name))
  OR (deals.contact_email LIKE '%@' || companies.domain AND companies.domain IS NOT NULL)
)
WHERE deals.contact_email IS NOT NULL
  AND deals.contact_email != ''
  AND NOT EXISTS (
    SELECT 1 FROM contacts 
    WHERE contacts.email = deals.contact_email
  );

-- Step 6: Now link the deals to the newly created contacts
UPDATE deals 
SET primary_contact_id = contacts.id
FROM contacts
WHERE deals.contact_email = contacts.email
  AND deals.primary_contact_id IS NULL
  AND deals.contact_email IS NOT NULL
  AND deals.contact_email != '';

-- Step 7: Create missing companies from deals that don't have matching companies
INSERT INTO companies (
  name, 
  domain, 
  owner_id, 
  created_at, 
  updated_at
)
SELECT DISTINCT
  deals.company,
  CASE 
    WHEN deals.contact_email LIKE '%@%' 
    THEN split_part(deals.contact_email, '@', 2)
    ELSE NULL
  END as domain,
  deals.owner_id,
  NOW(),
  NOW()
FROM deals
WHERE deals.company IS NOT NULL
  AND deals.company != ''
  AND NOT EXISTS (
    SELECT 1 FROM companies 
    WHERE LOWER(TRIM(companies.name)) = LOWER(TRIM(deals.company))
  );

-- Step 8: Final linking of deals to newly created companies
UPDATE deals 
SET company_id = companies.id
FROM companies
WHERE LOWER(TRIM(deals.company)) = LOWER(TRIM(companies.name))
  AND deals.company_id IS NULL
  AND deals.company IS NOT NULL
  AND deals.company != '';

-- Step 9: Update contacts with company relationships for newly created companies
UPDATE contacts 
SET company_id = companies.id
FROM companies
WHERE (
  contacts.email LIKE '%@' || companies.domain
  AND companies.domain IS NOT NULL
  AND companies.domain != ''
) OR (
  EXISTS (
    SELECT 1 FROM deals 
    WHERE deals.primary_contact_id = contacts.id 
    AND deals.company_id = companies.id
  )
)
AND contacts.company_id IS NULL;

-- Step 10: Create deal_contacts relationships for primary contacts
INSERT INTO deal_contacts (deal_id, contact_id, role, created_at)
SELECT 
  deals.id,
  deals.primary_contact_id,
  'decision_maker',
  NOW()
FROM deals
WHERE deals.primary_contact_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM deal_contacts 
    WHERE deal_contacts.deal_id = deals.id 
    AND deal_contacts.contact_id = deals.primary_contact_id
  );

-- Summary: Check the results
SELECT 
  'Total Deals' as metric,
  COUNT(*) as count,
  COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as with_company,
  COUNT(CASE WHEN primary_contact_id IS NOT NULL THEN 1 END) as with_contact
FROM deals
UNION ALL
SELECT 
  'Total Contacts' as metric,
  COUNT(*) as count,
  COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as with_company,
  0 as with_contact
FROM contacts
UNION ALL
SELECT 
  'Total Companies' as metric,
  COUNT(*) as count,
  COUNT(CASE WHEN domain IS NOT NULL THEN 1 END) as with_domain,
  0 as with_contact
FROM companies
UNION ALL
SELECT 
  'Deal-Contact Links' as metric,
  COUNT(*) as count,
  0 as with_company,
  0 as with_contact
FROM deal_contacts; 