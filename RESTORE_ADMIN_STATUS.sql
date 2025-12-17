-- ============================================================================
-- Restore Admin Status
-- ============================================================================
-- Use this script to restore admin status if it was accidentally removed
-- Replace 'your-email@example.com' with your actual email address
-- ============================================================================

-- Check current admin status
SELECT 
  id,
  email,
  first_name,
  last_name,
  is_admin,
  created_at
FROM profiles
WHERE email = 'your-email@example.com';

-- Restore admin status
UPDATE profiles
SET is_admin = true
WHERE email = 'your-email@example.com';

-- Verify the update
SELECT 
  email,
  is_admin,
  'Admin status restored ✓' as status
FROM profiles
WHERE email = 'your-email@example.com';

-- Also ensure you're in the internal_users table (required for platform admin)
INSERT INTO internal_users (email, name, reason, is_active)
VALUES (
  'your-email@example.com',
  (SELECT COALESCE(first_name || ' ' || last_name, email) FROM profiles WHERE email = 'your-email@example.com'),
  'Platform admin',
  true
)
ON CONFLICT (email) DO UPDATE SET
  is_active = true,
  updated_at = NOW();

-- Final verification - check both admin and internal status
SELECT 
  p.email,
  p.is_admin as is_platform_admin,
  COALESCE(iu.is_active, false) as is_internal_user,
  CASE 
    WHEN p.is_admin = true AND COALESCE(iu.is_active, false) = true THEN 'Platform Admin ✓'
    WHEN p.is_admin = true THEN 'Admin but not internal'
    WHEN COALESCE(iu.is_active, false) = true THEN 'Internal but not admin'
    ELSE 'Regular user'
  END as access_level
FROM profiles p
LEFT JOIN internal_users iu ON LOWER(iu.email) = LOWER(p.email)
WHERE p.email = 'your-email@example.com';
