-- Create a test API key with known value for testing
DELETE FROM api_keys WHERE name = 'Test Suite Key - Known Value';

INSERT INTO api_keys (
  name,
  key_hash,
  key_preview,
  permissions,
  rate_limit,
  user_id,
  is_active
) VALUES (
  'Test Suite Key - Known Value',
  encode(digest('sk_test_api_key_for_suite_12345', 'sha256'), 'hex'),
  'sk_test_api...',
  '["contacts:read", "contacts:write", "contacts:delete", "companies:read", "companies:write", "companies:delete", "deals:read", "deals:write", "deals:delete", "tasks:read", "tasks:write", "tasks:delete", "meetings:read", "meetings:write", "meetings:delete", "activities:read", "activities:write", "activities:delete", "admin"]'::jsonb,
  50000,
  'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459',
  true
);

-- Verify it was created
SELECT 
  'Created test key: sk_test_api_key_for_suite_12345' as message,
  name,
  key_preview,
  is_active,
  array_length(array(SELECT jsonb_array_elements_text(permissions)), 1) as permission_count
FROM api_keys 
WHERE name = 'Test Suite Key - Known Value';