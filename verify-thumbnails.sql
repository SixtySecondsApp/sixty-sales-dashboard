-- Verify thumbnail status for all meetings

SELECT
  COUNT(*) as total_meetings,
  COUNT(thumbnail_url) as with_thumbnails,
  COUNT(*) - COUNT(thumbnail_url) as without_thumbnails,
  ROUND(COUNT(thumbnail_url)::numeric / COUNT(*)::numeric * 100, 2) as percentage_complete
FROM meetings;

-- Show sample of meetings with thumbnails
SELECT
  id,
  title,
  fathom_recording_id,
  CASE
    WHEN thumbnail_url LIKE '%user-upload.s3.eu-west-2.amazonaws.com%' THEN '✅ S3 thumbnail'
    WHEN thumbnail_url LIKE '%placeholder%' THEN '⚠️ Placeholder'
    WHEN thumbnail_url IS NULL THEN '❌ No thumbnail'
    ELSE '🤔 Other source'
  END as thumbnail_status,
  thumbnail_url
FROM meetings
ORDER BY created_at DESC
LIMIT 10;
