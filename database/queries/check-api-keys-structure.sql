-- Check the actual structure of the api_keys table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'api_keys'
ORDER BY ordinal_position;

-- Check what data we have in the table
SELECT * FROM api_keys LIMIT 5;