-- Link Orphaned Contacts to Companies by Name Matching
-- This handles personal email accounts (gmail, outlook) that couldn't be matched by domain

-- Step 1: Link contacts to companies by exact name match
UPDATE contacts c
SET company_id = co.id,
    updated_at = NOW()
FROM companies co
WHERE c.company_id IS NULL
  AND co.domain IS NULL  -- Only match name-only companies
  AND (
    -- Match by concatenated first_name + last_name
    LOWER(TRIM(c.first_name || ' ' || COALESCE(c.last_name, ''))) = LOWER(TRIM(co.name))
    OR
    -- Match by first_name only if no last_name
    (c.last_name IS NULL AND LOWER(TRIM(c.first_name)) = LOWER(TRIM(co.name)))
  );

-- Step 2: Link specific known matches (based on analysis)
-- Tom Vodden
UPDATE contacts c
SET company_id = co.id,
    updated_at = NOW()
FROM companies co
WHERE c.company_id IS NULL
  AND c.email = 'tomvodden@gmail.com'
  AND co.name = 'Tom Vodden';

-- River Axe Media (multiple contacts)
UPDATE contacts c
SET company_id = co.id,
    updated_at = NOW()
FROM companies co
WHERE c.company_id IS NULL
  AND c.email IN ('riveraxemedia@gmail.com', 'xander.riveraxe@gmail.com')
  AND co.name ILIKE '%River Axe%Media%';

-- JP Consulting
UPDATE contacts c
SET company_id = co.id,
    updated_at = NOW()
FROM companies co
WHERE c.company_id IS NULL
  AND c.email = 'jpconsulting.global@gmail.com'
  AND co.name = 'JP Consulting';

-- Applegate Adventures
UPDATE contacts c
SET company_id = co.id,
    updated_at = NOW()
FROM companies co
WHERE c.company_id IS NULL
  AND c.email = 'dj.applegate@outlook.com'
  AND co.name ILIKE '%Applegate%';

-- John Ntow (yawntow)
UPDATE contacts c
SET company_id = co.id,
    updated_at = NOW()
FROM companies co
WHERE c.company_id IS NULL
  AND c.email = 'yawntow@yahoo.com'
  AND co.name = 'John Ntow';

-- Tax Relief Experts / The STA Group (mohammedfiazrashid)
UPDATE contacts c
SET company_id = (
    SELECT id FROM companies
    WHERE name IN ('Tax Relief Experts', 'The STA Group')
    LIMIT 1
  ),
  updated_at = NOW()
WHERE c.company_id IS NULL
  AND c.email = 'mohammedfiazrashid@gmail.com';

-- jvinternational (vikassharoff1976)
UPDATE contacts c
SET company_id = co.id,
    updated_at = NOW()
FROM companies co
WHERE c.company_id IS NULL
  AND c.email = 'vikassharoff1976@gmail.com'
  AND co.name = 'jvinternational.co.uk';

-- Step 3: Link any remaining contacts to deals with matching company names
-- (for contacts that have deals but no company match)
UPDATE contacts c
SET company_id = co.id,
    updated_at = NOW()
FROM deals d
JOIN companies co ON LOWER(TRIM(co.name)) = LOWER(TRIM(d.company))
WHERE c.company_id IS NULL
  AND c.email = d.contact_email
  AND co.domain IS NULL;

-- Step 4: Final report
SELECT
  'Final Entity Resolution Report' as status,
  (SELECT COUNT(*) FROM contacts) as total_contacts,
  (SELECT COUNT(*) FROM contacts WHERE company_id IS NOT NULL) as linked_contacts,
  (SELECT COUNT(*) FROM contacts WHERE company_id IS NULL) as unlinked_contacts,
  ROUND(100.0 * (SELECT COUNT(*) FROM contacts WHERE company_id IS NOT NULL) / (SELECT COUNT(*) FROM contacts), 1) as contact_coverage_pct,
  (SELECT COUNT(*) FROM companies) as total_companies,
  (SELECT COUNT(*) FROM companies WHERE EXISTS (SELECT 1 FROM contacts WHERE company_id = companies.id)) as companies_with_contacts,
  (SELECT COUNT(*) FROM companies WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE company_id = companies.id)) as companies_without_contacts,
  ROUND(100.0 * (SELECT COUNT(*) FROM companies WHERE EXISTS (SELECT 1 FROM contacts WHERE company_id = companies.id)) / (SELECT COUNT(*) FROM companies), 1) as company_coverage_pct;

-- Step 5: Show any remaining orphaned entities
SELECT
  'Remaining Orphaned Contacts' as type,
  COUNT(*) as count
FROM contacts
WHERE company_id IS NULL
UNION ALL
SELECT
  'Remaining Orphaned Companies' as type,
  COUNT(*) as count
FROM companies
WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE company_id = companies.id);
