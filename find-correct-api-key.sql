-- Find the correct API key for testing
-- Check all the partial keys we can see

-- Get the full API key for the newest one with preview "sk_...b082fcdd"
SELECT 
  'Most Recent Key' as key_type,
  name,
  key_preview,
  -- Show the actual key value if we can reconstruct it
  'Check your frontend for: sk_dbd6aed...' as note
FROM api_keys 
WHERE key_preview = 'sk_...b082fcdd'
ORDER BY created_at DESC
LIMIT 1;

-- Test validation with the pattern that matches your test results
-- Since your test shows sk_dbd6aed..., let's see if we can find this key
SELECT 
  'Looking for sk_dbd6aed pattern' as search_info,
  name,
  key_preview,
  substring(encode(digest('sk_dbd6aed', 'sha256'), 'hex'), 1, 10) as partial_hash_test
FROM api_keys 
WHERE key_preview LIKE 'sk_%'
ORDER BY created_at DESC;