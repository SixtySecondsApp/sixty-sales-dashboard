-- Test API key validation step by step

-- 1. Check if our test key exists in the database
SELECT 
  '=== TEST KEY IN DATABASE ===' as section,
  name,
  key_hash,
  key_preview,
  permissions,
  is_active
FROM api_keys 
WHERE name = 'Test Suite Key - Known Value';

-- 2. Test the hash computation manually
SELECT 
  '=== HASH COMPUTATION TEST ===' as section,
  encode(digest('sk_test_api_key_for_suite_12345', 'sha256'), 'hex') as computed_hash;

-- 3. Test the TEXT version of validate_api_key
SELECT 
  '=== TEXT VALIDATION TEST ===' as section,
  is_valid,
  permissions,
  user_id
FROM validate_api_key('sk_test_api_key_for_suite_12345');

-- 4. Test the JSONB version (what the Edge Function calls)
SELECT 
  '=== JSONB VALIDATION TEST ===' as section,
  is_valid,
  permissions,
  array_length(permissions, 1) as perm_count,
  'contacts:write' = ANY(permissions) as has_contacts_write,
  'companies:write' = ANY(permissions) as has_companies_write
FROM validate_api_key('{"key_text": "sk_test_api_key_for_suite_12345"}'::jsonb);

-- 5. Check if there are any function errors
SELECT 
  '=== FUNCTION SIGNATURES ===' as section,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'validate_api_key' 
  AND n.nspname = 'public';

SELECT '✅ API key validation test complete' as result;