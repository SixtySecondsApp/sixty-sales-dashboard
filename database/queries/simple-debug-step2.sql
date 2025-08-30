-- Step 2: Test the validate_api_key function
SELECT 
  is_valid,
  user_id,
  permissions,
  rate_limit,
  is_expired,
  is_active
FROM validate_api_key('sk_8b61b8892eec45fcb56908b7209a3985');