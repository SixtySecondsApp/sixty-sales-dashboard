-- Diagnostic SQL: Check Transcript Status and Next-Actions

-- ============================================
-- CHECK 1: Meeting Transcript Status
-- ============================================
SELECT
  id,
  title,
  fathom_recording_id,
  -- Transcript status
  CASE
    WHEN transcript_text IS NOT NULL THEN '✅ Has Transcript'
    ELSE '❌ No Transcript'
  END as transcript_status,
  LENGTH(transcript_text) as transcript_chars,
  -- Summary status
  CASE
    WHEN summary IS NOT NULL THEN '✅ Has Summary'
    ELSE '❌ No Summary'
  END as summary_status,
  -- Fetch attempt status
  COALESCE(transcript_fetch_attempts, 0) as fetch_attempts,
  CASE
    WHEN transcript_fetch_attempts >= 3 THEN '🚫 Max Attempts'
    WHEN last_transcript_fetch_at IS NULL THEN '⏸️  Not Tried'
    WHEN EXTRACT(EPOCH FROM (NOW() - last_transcript_fetch_at))/60 < 5 THEN '⏳ Cooldown Active'
    ELSE '✅ Ready to Retry'
  END as fetch_status,
  -- Time info
  ROUND(EXTRACT(EPOCH FROM (NOW() - last_transcript_fetch_at))/60::numeric, 1) as mins_since_fetch,
  created_at,
  last_synced_at
FROM meetings
ORDER BY created_at DESC
LIMIT 10;

-- ============================================
-- CHECK 2: Meetings With Transcripts But No Suggestions
-- ============================================
SELECT
  m.id as meeting_id,
  m.title,
  m.fathom_recording_id,
  LENGTH(m.transcript_text) as transcript_chars,
  COUNT(nas.id) as suggestion_count,
  CASE
    WHEN COUNT(nas.id) = 0 THEN '❌ No Suggestions (SHOULD HAVE)'
    ELSE '✅ Has Suggestions'
  END as status
FROM meetings m
LEFT JOIN next_action_suggestions nas ON nas.activity_id = m.id AND nas.activity_type = 'meeting'
WHERE m.transcript_text IS NOT NULL
GROUP BY m.id, m.title, m.fathom_recording_id, m.transcript_text
ORDER BY m.created_at DESC
LIMIT 10;

-- ============================================
-- CHECK 3: Trigger Existence
-- ============================================
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%next_actions%'
  AND event_object_table = 'meetings';

-- ============================================
-- CHECK 4: Edge Function Configuration Status
-- ============================================
-- Check database config for Edge Function
SELECT
  current_setting('app.settings.supabase_url', true) as supabase_url,
  CASE
    WHEN current_setting('app.settings.service_role_key', true) IS NOT NULL
    THEN '✅ SET'
    ELSE '❌ NOT SET'
  END as service_role_key_status;

-- ============================================
-- CHECK 5: Recent Suggestion Generation Activity
-- ============================================
SELECT
  nas.id,
  nas.title,
  nas.activity_type,
  nas.urgency,
  nas.status,
  nas.created_at,
  m.title as meeting_title,
  m.fathom_recording_id
FROM next_action_suggestions nas
LEFT JOIN meetings m ON m.id = nas.activity_id
WHERE nas.activity_type = 'meeting'
ORDER BY nas.created_at DESC
LIMIT 10;

-- ============================================
-- SUMMARY STATISTICS
-- ============================================
SELECT
  'Total Meetings' as metric,
  COUNT(*) as value
FROM meetings

UNION ALL

SELECT
  'Meetings With Transcripts',
  COUNT(*)
FROM meetings
WHERE transcript_text IS NOT NULL

UNION ALL

SELECT
  'Meetings With Suggestions',
  COUNT(DISTINCT m.id)
FROM meetings m
INNER JOIN next_action_suggestions nas ON nas.activity_id = m.id AND nas.activity_type = 'meeting'

UNION ALL

SELECT
  'Meetings Needing Suggestions',
  COUNT(*)
FROM meetings m
LEFT JOIN next_action_suggestions nas ON nas.activity_id = m.id AND nas.activity_type = 'meeting'
WHERE m.transcript_text IS NOT NULL
  AND nas.id IS NULL

UNION ALL

SELECT
  'Pending Suggestions',
  COUNT(*)
FROM next_action_suggestions
WHERE status = 'pending';

-- ============================================
-- ACTIONABLE RECOMMENDATIONS
-- ============================================
-- If you see meetings with transcripts but no suggestions,
-- run this to manually trigger generation:
--
-- SELECT regenerate_next_actions_for_activity(
--   'MEETING-ID-FROM-CHECK-2'::UUID,
--   'meeting'
-- );
