-- Check contact data structure
SELECT 
  id,
  first_name,
  last_name,
  full_name,
  email,
  company_id,
  is_primary,
  created_at
FROM contacts
LIMIT 10;

-- Check how many contacts have names vs don't
SELECT 
  COUNT(*) as total_contacts,
  COUNT(CASE WHEN first_name IS NOT NULL OR last_name IS NOT NULL THEN 1 END) as contacts_with_names,
  COUNT(CASE WHEN first_name IS NULL AND last_name IS NULL THEN 1 END) as contacts_without_names,
  COUNT(CASE WHEN is_primary = true THEN 1 END) as primary_contacts
FROM contacts;

-- Check company relationships
SELECT 
  c.id,
  c.first_name,
  c.last_name,
  c.email,
  c.company_id,
  co.name as company_name
FROM contacts c
LEFT JOIN companies co ON c.company_id = co.id
WHERE c.company_id IS NOT NULL
LIMIT 10;