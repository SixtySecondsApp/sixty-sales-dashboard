-- Check what the actual share_url format is in your database
SELECT
  id,
  title,
  share_url,
  recording_id,
  created_at
FROM meetings
WHERE share_url IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
