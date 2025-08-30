-- Step 3: Check if function exists
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_name = 'validate_api_key'
  AND routine_schema = 'public';