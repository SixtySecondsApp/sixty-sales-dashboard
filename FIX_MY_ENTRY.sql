-- Fix your entry to ensure it shows in the admin panel
-- This will:
-- 1. Check your entry's current status
-- 2. Ensure it's NOT marked as seeded
-- 3. Ensure it has a valid status

-- First, check your entry
SELECT 
  id,
  email,
  full_name,
  is_seeded,
  status,
  registration_url,
  created_at,
  CASE 
    WHEN is_seeded = true THEN '⚠️ MARKED AS SEEDED - This is why it''s hidden!'
    WHEN is_seeded = false THEN '✓ NOT SEEDED - Should show'
    WHEN is_seeded IS NULL THEN '✓ NULL - Should show'
  END as seeded_status
FROM meetings_waitlist
WHERE email = 'max.parish@sixtyseconds.video';

-- Fix: Unmark as seeded (this is likely the issue)
UPDATE meetings_waitlist
SET is_seeded = false
WHERE email = 'max.parish@sixtyseconds.video'
  AND (is_seeded = true OR is_seeded IS NULL);

-- Fix: Ensure status is not 'declined' (declined entries are excluded from view)
UPDATE meetings_waitlist
SET status = 'pending'
WHERE email = 'max.parish@sixtyseconds.video'
  AND status = 'declined';

-- Verify it now appears in the view
SELECT 
  id,
  email,
  full_name,
  is_seeded,
  status,
  registration_url,
  display_rank,
  CASE 
    WHEN is_seeded = false OR is_seeded IS NULL THEN '✓ Should now be visible in admin panel'
    ELSE '⚠️ Still marked as seeded'
  END as visibility_status
FROM waitlist_with_rank
WHERE email = 'max.parish@sixtyseconds.video';


