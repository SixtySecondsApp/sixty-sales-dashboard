-- Check synced meetings and their owner IDs
SELECT
  id,
  title,
  owner_user_id,
  fathom_recording_id,
  meeting_start,
  created_at
FROM meetings
ORDER BY created_at DESC
LIMIT 10;

-- Check all users to see which one should match
SELECT
  id,
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC;
