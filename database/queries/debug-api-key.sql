-- Debug API Key Issue
-- Check what's actually stored in the database and what the function returns

-- First, let's see what's actually in the api_keys table
SELECT 
  name,
  key_preview,
  permissions,
  rate_limit,
  is_active,
  created_at,
  user_id
FROM api_keys 
WHERE key_preview LIKE 'sk_%' 
ORDER BY created_at DESC 
LIMIT 5;

-- Now let's test the validate_api_key function directly
SELECT 'Testing validate_api_key function...' as test;

-- Test with the new key using RPC format
SELECT * FROM validate_api_key('{"key_text": "sk_7c452587fbad4ad0adfbb8798e3c92b5"}'::jsonb);

-- Let's also check what the hash of our key should be
SELECT 
  'sk_7c452587fbad4ad0adfbb8798e3c92b5' as original_key,
  encode(digest('sk_7c452587fbad4ad0adfbb8798e3c92b5', 'sha256'), 'hex') as expected_hash;

-- Check if we have a matching hash in the database
SELECT 
  name,
  key_preview,
  rate_limit,
  permissions,
  CASE WHEN key_hash = encode(digest('sk_7c452587fbad4ad0adfbb8798e3c92b5', 'sha256'), 'hex')
    THEN 'HASH MATCHES'
    ELSE 'HASH MISMATCH'
  END as hash_status
FROM api_keys 
WHERE key_preview LIKE '%e3c92b5' OR name LIKE '%High Rate%';

-- Check all functions named validate_api_key
SELECT 
  proname,
  prosrc,
  proargnames,
  proargtypes::regtype[] as arg_types
FROM pg_proc 
WHERE proname = 'validate_api_key';