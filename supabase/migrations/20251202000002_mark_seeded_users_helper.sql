-- Helper Script: Mark Seeded/Fake Users
-- This is a template for marking existing fake users as seeded
-- Uncomment and modify the WHERE clause to match your fake users

-- Option 1: Mark specific users by email pattern
-- UPDATE public.meetings_waitlist
-- SET is_seeded = true
-- WHERE email LIKE '%@example.com'
--    OR email LIKE '%test%'
--    OR email LIKE '%fake%'
--    OR email LIKE '%demo%';

-- Option 2: Mark specific users by ID
-- UPDATE public.meetings_waitlist
-- SET is_seeded = true
-- WHERE id IN (
--   'user-id-1',
--   'user-id-2',
--   'user-id-3'
-- );

-- Option 3: Mark all current users as seeded (use carefully!)
-- UPDATE public.meetings_waitlist
-- SET is_seeded = true;

-- Verify the update
-- SELECT
--   full_name,
--   email,
--   is_seeded,
--   created_at
-- FROM public.meetings_waitlist
-- ORDER BY created_at DESC;
