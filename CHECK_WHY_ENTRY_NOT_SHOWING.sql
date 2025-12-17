-- Check why your entry (max.parish@sixtyseconds.video) is not showing
-- Run this to diagnose the issue

-- 1. Check if your entry exists and its properties
SELECT 
  id,
  email,
  full_name,
  is_seeded,
  status,
  registration_url,
  created_at,
  CASE 
    WHEN is_seeded = true THEN 'MARKED AS SEEDED - Will be hidden if "Hide seeded users" is checked'
    WHEN is_seeded = false THEN 'NOT SEEDED - Should show when checkbox is checked'
    WHEN is_seeded IS NULL THEN 'NULL - Should show when checkbox is checked'
  END as seeded_status,
  CASE
    WHEN status = 'declined' THEN 'DECLINED - Excluded from waitlist_with_rank view'
    ELSE 'OK - Included in view'
  END as view_status
FROM meetings_waitlist
WHERE email = 'max.parish@sixtyseconds.video'
ORDER BY created_at DESC;

-- 2. Check if it appears in the view (what admin panel uses)
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
ORDER BY created_at DESC;

-- 3. Check if there are multiple entries with similar emails (search might match)
SELECT 
  id,
  email,
  full_name,
  is_seeded,
  status,
  registration_url
FROM meetings_waitlist
WHERE email ILIKE '%max%'
   OR full_name ILIKE '%max%'
ORDER BY created_at DESC
LIMIT 20;

-- 4. Check all entries matching "max" search (what you're seeing in the UI)
SELECT 
  id,
  email,
  full_name,
  is_seeded,
  status,
  registration_url
FROM waitlist_with_rank
WHERE email ILIKE '%max%'
   OR full_name ILIKE '%max%'
   OR company_name ILIKE '%max%'
ORDER BY created_at DESC
LIMIT 20;


