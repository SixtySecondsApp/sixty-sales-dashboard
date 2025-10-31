-- Check recent meetings and their transcript/action item status
SELECT
  m.id,
  m.title,
  m.fathom_recording_id,
  m.meeting_start,
  m.transcript_text IS NOT NULL as has_transcript,
  LENGTH(m.transcript_text) as transcript_length,
  m.transcript_fetch_attempts,
  m.last_transcript_fetch_at,
  COUNT(ai.id) as action_item_count,
  m.created_at,
  m.last_synced_at
FROM meetings m
LEFT JOIN meeting_action_items ai ON ai.meeting_id = m.id
WHERE m.created_at > NOW() - INTERVAL '48 hours'
GROUP BY m.id, m.title, m.fathom_recording_id, m.meeting_start, m.transcript_text,
         m.transcript_fetch_attempts, m.last_transcript_fetch_at, m.created_at, m.last_synced_at
ORDER BY m.meeting_start DESC
LIMIT 10;

-- Check if any meetings are stuck waiting for retry
SELECT
  m.id,
  m.title,
  m.transcript_fetch_attempts,
  m.last_transcript_fetch_at,
  EXTRACT(EPOCH FROM (NOW() - m.last_transcript_fetch_at)) / 60 as minutes_since_last_attempt
FROM meetings m
WHERE m.transcript_text IS NULL
  AND m.transcript_fetch_attempts > 0
  AND m.created_at > NOW() - INTERVAL '48 hours'
ORDER BY m.last_transcript_fetch_at DESC;
