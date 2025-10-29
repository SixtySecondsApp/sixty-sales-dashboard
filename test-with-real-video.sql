-- Find a real Fathom video to test thumbnail generation
-- Run this in Supabase SQL Editor to get actual working video URLs

SELECT
  id as meeting_id,
  title,
  share_url,
  fathom_embed_url,
  fathom_recording_id,
  created_at
FROM meetings
WHERE (share_url IS NOT NULL OR fathom_embed_url IS NOT NULL)
  AND (share_url != '' OR fathom_embed_url != '')
ORDER BY created_at DESC
LIMIT 5;

-- After getting results, use one of these videos to test:
-- Example test command:
--
-- curl -X POST "https://ewtuefzeogytgmsnkpmb.functions.supabase.co/generate-video-thumbnail" \
--   -H "Authorization: Bearer YOUR_ANON_KEY" \
--   -H "apikey: YOUR_ANON_KEY" \
--   -H "Content-Type: application/json" \
--   -d '{
--     "recording_id": "<recording_id_from_query>",
--     "share_url": "<share_url_from_query>",
--     "fathom_embed_url": "<fathom_embed_url_from_query>",
--     "timestamp_seconds": 30,
--     "meeting_id": "<meeting_id_from_query>"
--   }'
