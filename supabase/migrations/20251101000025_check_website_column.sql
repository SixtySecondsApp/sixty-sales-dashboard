-- Check if companies have website column instead of domain

-- Query 1: Check for website column
SELECT
  'Column Check' as analysis,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'companies'
  AND column_name IN ('domain', 'website', 'url', 'site')
ORDER BY column_name;

-- Query 2: All company columns
SELECT
  'All Company Columns' as analysis,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'companies'
ORDER BY ordinal_position;

-- Query 3: Sample company data to see structure
SELECT * FROM companies LIMIT 3;
