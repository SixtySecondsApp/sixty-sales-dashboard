-- Script to undo the company renaming (remove the " (2)" suffixes) before merging
-- Run this if you already renamed companies and want to merge them instead

-- 1. Show companies that were renamed with (2), (3), etc.
SELECT id, name, created_at
FROM companies
WHERE name LIKE '% (%)'
ORDER BY name;

-- 2. Undo the renaming by removing the suffix
UPDATE companies
SET name = REGEXP_REPLACE(name, ' \(\d+\)$', '')
WHERE name LIKE '% (%)';

-- 3. Show the results - these will now be duplicates again
SELECT name, COUNT(*) as count
FROM companies
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY name;

-- 4. Now you can run merge-duplicate-companies.sql to properly merge them