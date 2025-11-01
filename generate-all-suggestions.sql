-- Generate suggestions for all meetings with transcripts

-- Check which meetings need suggestions
SELECT
  COUNT(*) as meetings_with_transcripts,
  COUNT(*) FILTER (WHERE next_actions_generated_at IS NULL) as needs_suggestions
FROM meetings
WHERE transcript_text IS NOT NULL;

-- Generate suggestions for all meetings (run in batches if you have many)
SELECT
  m.id,
  m.title,
  m.meeting_start,
  regenerate_next_actions_for_activity(m.id, 'meeting') as result
FROM meetings m
WHERE m.transcript_text IS NOT NULL
  AND (
    m.next_actions_generated_at IS NULL
    OR m.next_actions_count = 0
  )
ORDER BY m.meeting_start DESC
LIMIT 10; -- Process 10 at a time

-- After running above, wait 30-60 seconds, then check results:
SELECT
  m.title,
  m.meeting_start,
  m.next_actions_count,
  m.next_actions_generated_at
FROM meetings m
WHERE m.transcript_text IS NOT NULL
ORDER BY m.next_actions_generated_at DESC NULLS LAST
LIMIT 10;

-- View all suggestions created
SELECT
  COUNT(*) as total_suggestions,
  COUNT(DISTINCT activity_id) as meetings_with_suggestions,
  AVG(confidence_score::numeric) as avg_confidence,
  COUNT(*) FILTER (WHERE urgency = 'high') as high_urgency_count,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count
FROM next_action_suggestions;
