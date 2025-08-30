-- Script to clean up all test data from the database
-- This should be run to remove any leftover test data from function tests

-- Clean up test contacts (containing 'test' or 'func' in various fields)
DELETE FROM contacts 
WHERE 
  LOWER(first_name) LIKE '%test%' 
  OR LOWER(last_name) LIKE '%test%'
  OR LOWER(last_name) LIKE '%func%'
  OR email LIKE '%test%@%'
  OR email LIKE '%func%@%'
  OR LOWER(title) LIKE '%test%'
  OR LOWER(company) LIKE '%test%'
  OR company_website LIKE '%test%';

-- Clean up test companies
DELETE FROM companies 
WHERE 
  LOWER(name) LIKE '%test%'
  OR LOWER(website) LIKE '%test%'
  OR LOWER(description) LIKE '%test%'
  OR LOWER(industry) LIKE '%test%';

-- Clean up test deals
DELETE FROM deals 
WHERE 
  LOWER(client_name) LIKE '%test%'
  OR LOWER(description) LIKE '%test%'
  OR LOWER(notes) LIKE '%test%';

-- Clean up test tasks
DELETE FROM tasks 
WHERE 
  LOWER(title) LIKE '%test%'
  OR LOWER(description) LIKE '%test%'
  OR LOWER(client_name) LIKE '%test%';

-- Clean up test activities
DELETE FROM activities 
WHERE 
  LOWER(type) LIKE '%test%'
  OR LOWER(client_name) LIKE '%test%'
  OR LOWER(notes) LIKE '%test%'
  OR LOWER(outcome) LIKE '%test%';

-- Show remaining counts
SELECT 'contacts' as table_name, COUNT(*) as count FROM contacts
UNION ALL
SELECT 'companies', COUNT(*) FROM companies  
UNION ALL
SELECT 'deals', COUNT(*) FROM deals
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'activities', COUNT(*) FROM activities;