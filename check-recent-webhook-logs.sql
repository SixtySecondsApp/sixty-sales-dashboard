-- Check for webhook activity after deployment (20:03:55 UTC = 8:03:55 PM)

-- Check recent meetings synced
SELECT
  id,
  title,
  meeting_start,
  created_at,
  owner_email,
  fathom_recording_id,
  transcript_text IS NOT NULL as has_transcript
FROM meetings
WHERE created_at > '2025-12-02 20:03:55'::timestamptz
ORDER BY created_at DESC
LIMIT 10;

-- Also check slightly earlier to see if any came in right before/after deploy
SELECT
  id,
  title,
  meeting_start,
  created_at,
  owner_email,
  fathom_recording_id
FROM meetings
WHERE created_at > '2025-12-02 19:50:00'::timestamptz
ORDER BY created_at DESC
LIMIT 20;
