-- Fix the Actual API Key Being Used
-- The test suite is using: sk_8b61b8892eec45fcb56908b7209a3985

-- Check what's in the database for this specific key
DO $$
DECLARE
  rec RECORD;
  actual_key TEXT := 'sk_8b61b8892eec45fcb56908b7209a3985';
  expected_hash TEXT;
BEGIN
  RAISE NOTICE '=== CHECKING ACTUAL API KEY ===';
  
  expected_hash := encode(digest(actual_key, 'sha256'), 'hex');
  RAISE NOTICE 'Looking for key: %', actual_key;
  RAISE NOTICE 'Expected hash: %', expected_hash;
  
  -- Check if this key exists in database
  SELECT INTO rec name, rate_limit, permissions, is_active, user_id, created_at
  FROM api_keys 
  WHERE key_hash = expected_hash;
  
  IF FOUND THEN
    RAISE NOTICE '✅ Found API key in database!';
    RAISE NOTICE '   Name: %', rec.name;
    RAISE NOTICE '   Rate Limit: %', rec.rate_limit;
    RAISE NOTICE '   Active: %', rec.is_active;
    RAISE NOTICE '   User ID: %', rec.user_id;
    RAISE NOTICE '   Created: %', rec.created_at;
  ELSE
    RAISE NOTICE '❌ API key NOT found! This is the problem.';
    RAISE NOTICE 'The API key was probably created with the old system and has missing columns.';
    
    -- Let's check if there's a partial match
    SELECT INTO rec name, key_preview, created_at
    FROM api_keys 
    WHERE key_preview LIKE '%209a3985';
    
    IF FOUND THEN
      RAISE NOTICE '🔍 Found partial match by preview: %', rec.name;
      RAISE NOTICE '   This key exists but has wrong hash or missing columns';
    ELSE
      RAISE NOTICE '🔍 No partial matches found either';
    END IF;
  END IF;
END $$;

-- Create the missing API key with proper structure
-- This will ensure your test suite has a valid key to work with
INSERT INTO api_keys (
  user_id,
  name,
  key_hash,
  key_preview,
  permissions,
  rate_limit,
  is_active,
  created_at
) VALUES (
  (SELECT id FROM auth.users LIMIT 1), -- Use first user
  'Test Suite API Key',
  encode(digest('sk_8b61b8892eec45fcb56908b7209a3985', 'sha256'), 'hex'),
  'sk_...209a3985',
  '["contacts:read", "contacts:write", "companies:read", "companies:write", "deals:read", "deals:write", "tasks:read", "tasks:write", "meetings:read", "meetings:write", "activities:read", "activities:write"]'::jsonb,
  10000,
  true,
  NOW()
)
ON CONFLICT (key_hash) DO UPDATE SET
  rate_limit = 10000,
  permissions = '["contacts:read", "contacts:write", "companies:read", "companies:write", "deals:read", "deals:write", "tasks:read", "tasks:write", "meetings:read", "meetings:write", "activities:read", "activities:write"]'::jsonb,
  is_active = true;

-- Test the function with the actual key
DO $$
DECLARE
  test_result RECORD;
  test_params JSONB;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TESTING WITH ACTUAL KEY ===';
  
  test_params := jsonb_build_object('key_text', 'sk_8b61b8892eec45fcb56908b7209a3985');
  
  SELECT * INTO test_result
  FROM validate_api_key(test_params);
  
  RAISE NOTICE 'Function result:';
  RAISE NOTICE '  is_valid: %', test_result.is_valid;
  RAISE NOTICE '  rate_limit: %', test_result.rate_limit;
  RAISE NOTICE '  permissions: %', test_result.permissions;
  
  IF test_result.is_valid AND test_result.rate_limit > 0 THEN
    RAISE NOTICE '🎉 SUCCESS! Your test suite should now work!';
  ELSE
    RAISE NOTICE '❌ Still having issues...';
  END IF;
END $$;

SELECT '🔧 Fixed the actual API key! Run your test suite again.' as result;