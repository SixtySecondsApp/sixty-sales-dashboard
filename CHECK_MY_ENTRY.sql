-- Check your specific entry and why it might not be showing
-- Replace 'your-email@example.com' with your actual email

-- 1. Check if your entry exists in the base table
SELECT 
  id,
  email,
  full_name,
  is_seeded,
  status,
  registration_url,
  created_at,
  updated_at
FROM meetings_waitlist
WHERE email = 'max.parish@sixtyseconds.video'
ORDER BY created_at DESC;

-- 2. Check if your entry appears in the view (what admin panel uses)
SELECT 
  id,
  email,
  full_name,
  is_seeded,
  status,
  registration_url,
  display_rank,
  effective_position,
  created_at
FROM waitlist_with_rank
WHERE email = 'max.parish@sixtyseconds.video'
ORDER BY created_at DESC;

-- 3. Check if is_seeded is incorrectly set to true
SELECT 
  email,
  is_seeded,
  CASE 
    WHEN is_seeded = true THEN 'MARKED AS SEEDED (will be hidden if checkbox is checked)'
    WHEN is_seeded = false THEN 'NOT SEEDED (should show)'
    WHEN is_seeded IS NULL THEN 'NULL (should show)'
  END as seeded_status
FROM meetings_waitlist
WHERE email = 'max.parish@sixtyseconds.video';

-- 4. Check all recent entries to see the pattern
SELECT 
  email,
  full_name,
  is_seeded,
  registration_url,
  created_at
FROM meetings_waitlist
ORDER BY created_at DESC
LIMIT 20;


