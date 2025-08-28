-- Simple API key validation test with visible results

-- Test 1: Check if our test key exists
SELECT name, key_hash, is_active FROM api_keys WHERE name = 'Test Suite Key - Known Value';

-- Test 2: Test hash computation
SELECT encode(digest('sk_test_api_key_for_suite_12345', 'sha256'), 'hex') as computed_hash;

-- Test 3: Test JSONB validation (what Edge Function uses)
SELECT is_valid, permissions FROM validate_api_key('{"key_text": "sk_test_api_key_for_suite_12345"}'::jsonb);