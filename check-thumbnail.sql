-- Check if thumbnail_url column exists and has data
SELECT
  id,
  title,
  fathom_recording_id,
  share_url,
  thumbnail_url,
  fathom_embed_url,
  last_synced_at
FROM meetings
WHERE id = '87af08fa-d27e-44c7-a8f6-f2b01f3eecb3';

-- Check all meetings to see if any have thumbnails
SELECT
  COUNT(*) as total_meetings,
  COUNT(thumbnail_url) as meetings_with_thumbnails,
  COUNT(fathom_embed_url) as meetings_with_embed_url
FROM meetings;
