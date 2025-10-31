-- Check what email should match
SELECT id, email, raw_user_meta_data->>'full_name' as full_name 
FROM auth.users 
WHERE email ILIKE '%andrew%' OR email ILIKE '%bryce%'
LIMIT 5;

-- Check profiles table
SELECT id, email, full_name 
FROM profiles 
WHERE email ILIKE '%andrew%' OR email ILIKE '%bryce%'
LIMIT 5;

-- Check a recent meeting to see what owner_email was stored
SELECT 
  m.id,
  m.title,
  m.owner_email,
  m.owner_user_id,
  p.email as profile_email,
  p.full_name
FROM meetings m
LEFT JOIN profiles p ON p.id = m.owner_user_id
WHERE m.created_at > NOW() - INTERVAL '24 hours'
ORDER BY m.created_at DESC
LIMIT 5;
