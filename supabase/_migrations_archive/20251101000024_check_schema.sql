-- Check actual table schemas

-- Query 1: Companies table columns
SELECT
  'Companies Schema' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'companies'
ORDER BY ordinal_position;

-- Query 2: Contacts table columns
SELECT
  'Contacts Schema' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'contacts'
ORDER BY ordinal_position;

-- Query 3: Deals table columns
SELECT
  'Deals Schema' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'deals'
ORDER BY ordinal_position;

-- Query 4: Sample of companies to see actual structure
SELECT * FROM companies LIMIT 5;

-- Query 5: Sample of contacts to see actual structure
SELECT * FROM contacts LIMIT 5;
