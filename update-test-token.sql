-- Update the existing Google integration to use a test token
-- This will allow the mock system to work properly

UPDATE google_integrations 
SET 
  access_token = 'test_access_token_' || extract(epoch from now())::bigint,
  refresh_token = 'test_refresh_token_' || extract(epoch from now())::bigint,
  token_expires_at = now() + interval '1 hour',
  is_active = true,
  updated_at = now()
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'andrew.bryce@sixtyseconds.video'
);

-- Show the updated integration
SELECT 
  user_id,
  access_token,
  refresh_token,
  is_active,
  token_expires_at,
  updated_at
FROM google_integrations 
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'andrew.bryce@sixtyseconds.video'
);