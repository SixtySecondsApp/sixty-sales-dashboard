-- Fix Frontend API Key Loading Issue V2
-- Make sure RLS policies allow the frontend to read API keys

-- Drop and recreate the policy to avoid conflicts
DROP POLICY IF EXISTS "Users can read their own api keys" ON api_keys;
DROP POLICY IF EXISTS "Users can view their own API keys" ON api_keys;

-- Create the read policy
CREATE POLICY "Users can read their own api keys" 
ON api_keys FOR SELECT 
USING (auth.uid() = user_id);

-- Make sure we have at least one working API key for your user
DO $$
DECLARE
  current_user_id UUID;
  existing_key_count INTEGER;
  new_api_key TEXT;
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
    
    -- Generate a new API key
    new_api_key := 'sk_frontend_' || replace(gen_random_uuid()::text, '-', '');
    
    -- Create a guaranteed working API key
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
      encode(digest(new_api_key, 'sha256'), 'hex'),
      'sk_frontend...',
      '["contacts:read", "contacts:write", "companies:read", "companies:write", "deals:read", "deals:write", "tasks:read", "tasks:write", "meetings:read", "meetings:write", "activities:read", "activities:write"]'::jsonb,
      50000,
      true,
      NOW()
    );
    
    RAISE NOTICE 'Created new frontend test key: %', new_api_key;
    RAISE NOTICE 'This key has 50,000 rate limit and full permissions';
  ELSE
    RAISE NOTICE 'Could not find user to create API key for';
  END IF;
END $$;

-- Fix any existing API keys that might be missing required columns
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
  'Available API Keys:' as info,
  name,
  key_preview,
  rate_limit,
  is_active,
  array_length(array(select jsonb_array_elements_text(permissions)), 1) as permission_count,
  created_at
FROM api_keys 
WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'andrew.bryce@sixtyseconds.video')
ORDER BY created_at DESC;

SELECT '✅ Frontend API key loading fixed! Refresh the API Testing page and check the API Keys tab.' as result;