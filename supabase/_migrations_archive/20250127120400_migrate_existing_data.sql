/*
  # Migrate Existing Data to New CRM Structure
  
  1. Data Migration Steps
    - Extract companies from existing deals.company field  
    - Update existing 348 contacts with company relationships
    - Update deals with proper foreign key relationships
    - Link activities to contacts and deals where possible
    - Preserve all existing data integrity
    
  2. Smart Domain Extraction
    - Extract domain from contact_email in deals and existing contacts
    - Create companies with domain-based matching
    - Handle edge cases and preserve data quality
*/

-- Step 1: Extract and create companies from existing deals.company field
INSERT INTO companies (name, domain, owner_id, created_at, updated_at)
WITH company_extraction AS (
  SELECT DISTINCT ON (company_name, domain, owner_id)
    deals.company as company_name,
    CASE 
      WHEN deals.contact_email LIKE '%@%' 
      THEN LOWER(SPLIT_PART(deals.contact_email, '@', 2))
      ELSE NULL 
    END as domain,
    deals.owner_id,
    MIN(deals.created_at) OVER (PARTITION BY deals.company, deals.owner_id) as first_seen
  FROM deals 
  WHERE deals.company IS NOT NULL 
    AND TRIM(deals.company) != ''
    AND deals.owner_id IS NOT NULL
)
SELECT 
  company_name,
  domain,
  owner_id,
  first_seen,
  first_seen
FROM company_extraction
WHERE company_name IS NOT NULL
ON CONFLICT (domain) DO NOTHING; -- Simply skip duplicates

-- Step 2: Extract companies from existing contacts.company field (only new ones)
INSERT INTO companies (name, domain, owner_id, created_at, updated_at)
WITH contact_company_extraction AS (
  SELECT DISTINCT ON (company_name, domain)
    c.company as company_name,
    CASE 
      WHEN c.email LIKE '%@%' 
      THEN LOWER(SPLIT_PART(c.email, '@', 2))
      ELSE NULL 
    END as domain,
    -- For now, we'll use a default owner_id from the first profile
    (SELECT id FROM profiles LIMIT 1) as owner_id,
    MIN(c.created_at) OVER (PARTITION BY c.company) as first_seen
  FROM contacts c
  WHERE c.company IS NOT NULL 
    AND TRIM(c.company) != ''
    -- Only include if domain doesn't already exist
    AND NOT EXISTS (
      SELECT 1 FROM companies 
      WHERE companies.domain = LOWER(SPLIT_PART(c.email, '@', 2))
    )
)
SELECT 
  company_name,
  domain,
  owner_id,
  first_seen,
  first_seen
FROM contact_company_extraction
WHERE company_name IS NOT NULL
ON CONFLICT (domain) DO NOTHING;

-- Step 3: Update existing contacts with company relationships
UPDATE contacts 
SET 
  company_id = companies.id,
  owner_id = COALESCE(contacts.owner_id, (SELECT id FROM profiles LIMIT 1))
FROM companies
WHERE contacts.company = companies.name
  OR (
    contacts.email LIKE '%@' || companies.domain
    AND companies.domain IS NOT NULL
    AND LENGTH(companies.domain) > 3 -- Avoid matching very short domains
  );

-- Step 4: Update deals table with proper foreign key relationships
UPDATE deals 
SET 
  company_id = companies.id,
  primary_contact_id = contacts.id
FROM companies, contacts
WHERE (
  deals.company = companies.name 
  AND deals.owner_id = companies.owner_id
) AND (
  deals.contact_email = contacts.email
);

-- Step 5: Create deal_contacts relationships for existing deals with contacts
INSERT INTO deal_contacts (deal_id, contact_id, role)
SELECT DISTINCT 
  deals.id as deal_id,
  contacts.id as contact_id,
  'decision_maker' as role -- Assume primary contact is decision maker
FROM deals
INNER JOIN contacts ON deals.contact_email = contacts.email
WHERE deals.primary_contact_id IS NOT NULL
ON CONFLICT (deal_id, contact_id) DO NOTHING;

-- Step 6: Update activities with proper relationships where possible
-- First, match activities to contacts by email
UPDATE activities 
SET 
  contact_id = contacts.id,
  company_id = contacts.company_id,
  auto_matched = true
FROM contacts
WHERE activities.contact_identifier = contacts.email
  AND contacts.email IS NOT NULL;

-- Step 7: Link activities to deals where contact and deal relationships exist
UPDATE activities 
SET deal_id = deals.id
FROM deals
WHERE activities.contact_id = deals.primary_contact_id
  AND activities.deal_id IS NULL; -- Only update if not already linked

-- Step 8: Set first contact as primary for each company
UPDATE contacts 
SET is_primary = true
WHERE id IN (
  SELECT DISTINCT ON (company_id) id
  FROM contacts 
  WHERE company_id IS NOT NULL
  ORDER BY company_id, created_at ASC
);

-- Step 9: Create a summary view for data quality validation
DROP VIEW IF EXISTS crm_migration_summary;
CREATE VIEW crm_migration_summary AS
SELECT 
  'Companies Created' as entity,
  COUNT(*) as total,
  COUNT(CASE WHEN domain IS NOT NULL THEN 1 END) as with_domain,
  COUNT(CASE WHEN domain IS NULL THEN 1 END) as without_domain
FROM companies
UNION ALL
SELECT 
  'Contacts Updated' as entity,
  COUNT(*) as total,
  COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as with_company,
  COUNT(CASE WHEN owner_id IS NOT NULL THEN 1 END) as with_owner
FROM contacts
UNION ALL
SELECT 
  'Deals with Relationships' as entity,
  COUNT(*) as total,
  COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as with_company,
  COUNT(CASE WHEN primary_contact_id IS NOT NULL THEN 1 END) as with_contact
FROM deals
UNION ALL
SELECT 
  'Activities Matched' as entity,
  COUNT(*) as total,
  COUNT(CASE WHEN contact_id IS NOT NULL THEN 1 END) as with_contact,
  COUNT(CASE WHEN deal_id IS NOT NULL THEN 1 END) as with_deal
FROM activities;

-- Display migration summary
SELECT * FROM crm_migration_summary; 