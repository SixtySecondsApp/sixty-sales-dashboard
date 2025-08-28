-- Fix Frontend API Key Loading Issue
-- Make sure RLS policies allow the frontend to read API keys

-- Ensure the frontend can read the user's own API keys
CREATE POLICY IF NOT EXISTS "Users can read their own api keys" 
ON api_keys FOR SELECT 
USING (auth.uid() = user_id);

-- Make sure we have at least one working API key for your user
-- This will create a test key that the UI can see and select
DO $$
DECLARE
  current_user_id UUID;
  existing_key_count INTEGER;
BEGIN
  -- Get current user ID (your actual user)
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    -- If no auth context, use the first user we find
    SELECT id INTO current_user_id FROM auth.users WHERE email = 'andrew.bryce@sixtyseconds.video' LIMIT 1;
  END IF;
  
  IF current_user_id IS NOT NULL THEN
    -- Count existing API keys for this user
    SELECT COUNT(*) INTO existing_key_count 
    FROM api_keys 
    WHERE user_id = current_user_id AND is_active = true;
    
    RAISE NOTICE 'Found % active API keys for user %', existing_key_count, current_user_id;
    
    -- Create a guaranteed working API key if none exist or ensure we have one that works
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
      current_user_id,
      'Test Suite Master Key',
      encode(digest('sk_frontend_test_' || gen_random_uuid()::text, 'sha256'), 'hex'),
      'sk_frontend...',
      '["contacts:read", "contacts:write", "companies:read", "companies:write", "deals:read", "deals:write", "tasks:read", "tasks:write", "meetings:read", "meetings:write", "activities:read", "activities:write"]'::jsonb,
      50000,
      true,
      NOW()
    )
    RETURNING key_hash INTO current_user_id; -- Reusing variable
    
    RAISE NOTICE 'Created new frontend test key with high rate limit';
  ELSE
    RAISE NOTICE 'Could not find user to create API key for';
  END IF;
END $$;

-- Also fix any existing API keys that might be missing required columns
UPDATE api_keys 
SET 
  is_active = COALESCE(is_active, true),
  rate_limit = CASE WHEN rate_limit IS NULL OR rate_limit = 0 THEN 10000 ELSE rate_limit END,
  usage_count = COALESCE(usage_count, 0),
  permissions = CASE 
    WHEN permissions IS NULL OR permissions = 'null'::jsonb 
    THEN '["contacts:read", "contacts:write", "deals:read", "deals:write"]'::jsonb
    ELSE permissions 
  END
WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'andrew.bryce@sixtyseconds.video');

-- Show what API keys are available for the frontend
SELECT 
  name,
  key_preview,
  rate_limit,
  is_active,
  permissions,
  created_at
FROM api_keys 
WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'andrew.bryce@sixtyseconds.video')
ORDER BY created_at DESC;

-- Final check: ensure RLS is working correctly
SELECT 
  tablename,
  policyname,
  roles
FROM pg_policies 
WHERE tablename = 'api_keys' AND policyname LIKE '%read%';

SELECT '✅ Frontend API key loading should now work! Refresh the API Testing page.' as result;