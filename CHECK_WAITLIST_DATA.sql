-- Check waitlist data and see what's being returned
-- Run this to diagnose why accounts aren't showing

-- 1. Check total entries and how many are seeded
SELECT 
  COUNT(*) as total_entries,
  COUNT(*) FILTER (WHERE is_seeded = true) as seeded_count,
  COUNT(*) FILTER (WHERE is_seeded = false OR is_seeded IS NULL) as non_seeded_count
FROM meetings_waitlist;

-- 2. Check if the view includes registration_url
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'waitlist_with_rank'
AND column_name = 'registration_url';

-- 3. Sample entries from the view (what admin panel sees)
SELECT 
  id,
  email,
  full_name,
  is_seeded,
  registration_url,
  status,
  created_at
FROM waitlist_with_rank
ORDER BY created_at DESC
LIMIT 10;

-- 4. Sample non-seeded entries (should show in admin if hideSeeded = true)
SELECT 
  id,
  email,
  full_name,
  is_seeded,
  registration_url,
  status,
  created_at
FROM waitlist_with_rank
WHERE is_seeded = false OR is_seeded IS NULL
ORDER BY created_at DESC
LIMIT 10;

-- 5. Sample seeded entries (should show if hideSeeded = false)
SELECT 
  id,
  email,
  full_name,
  is_seeded,
  registration_url,
  status,
  created_at
FROM waitlist_with_rank
WHERE is_seeded = true
ORDER BY created_at DESC
LIMIT 10;


