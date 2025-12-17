-- Test if the frontend can actually fetch your entry
-- This simulates what the admin panel does

-- 1. Test the exact query the frontend uses (from waitlist_with_rank view)
SELECT 
  id,
  email,
  full_name,
  is_seeded,
  status,
  registration_url,
  display_rank
FROM waitlist_with_rank
WHERE email = 'max.parish@sixtyseconds.video'
ORDER BY display_rank ASC;

-- 2. Test with search filter (if "max" is in search box)
SELECT 
  id,
  email,
  full_name,
  is_seeded,
  status,
  registration_url,
  display_rank
FROM waitlist_with_rank
WHERE (email ILIKE '%max%' OR full_name ILIKE '%max%' OR company_name ILIKE '%max%')
  AND (is_seeded = false OR is_seeded IS NULL)
ORDER BY display_rank ASC;

-- 3. Check if there are any RLS issues preventing access
SELECT 
  id,
  email,
  full_name,
  is_seeded,
  status
FROM waitlist_with_rank
WHERE is_seeded = false
ORDER BY display_rank ASC
LIMIT 5;

-- 4. Check your entry's exact position in the full list
SELECT 
  display_rank,
  email,
  full_name,
  is_seeded,
  status
FROM waitlist_with_rank
WHERE email = 'max.parish@sixtyseconds.video'
   OR email ILIKE '%max%'
ORDER BY display_rank ASC;


