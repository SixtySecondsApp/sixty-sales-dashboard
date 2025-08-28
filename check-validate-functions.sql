-- Check existing validate_api_key functions
SELECT 
  routine_name,
  routine_type,
  data_type as return_type,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'validate_api_key'
  AND routine_schema = 'public';

-- Also check function signatures
SELECT 
  p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'validate_api_key' 
  AND n.nspname = 'public';