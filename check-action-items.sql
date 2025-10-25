-- Check action items for the specific meeting
SELECT
  id,
  title,
  timestamp_seconds,
  completed,
  ai_generated,
  priority,
  category,
  created_at
FROM meeting_action_items
WHERE meeting_id = '87af08fa-d27e-44c7-a8f6-f2b01f3eecb3'
ORDER BY timestamp_seconds NULLS LAST, created_at;

-- Also check the meeting details
SELECT
  id,
  title,
  fathom_recording_id,
  share_url,
  last_synced_at,
  sync_status
FROM meetings
WHERE id = '87af08fa-d27e-44c7-a8f6-f2b01f3eecb3';
