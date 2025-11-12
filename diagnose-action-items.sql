-- DIAGNOSTIC SCRIPT: Action Item Extraction Analysis
-- Run this in Supabase SQL Editor to identify why action items aren't being extracted

-- ============================================================================
-- STEP 1: Check meetings with transcripts but no action items
-- ============================================================================
SELECT
  '🔍 MEETINGS WITH TRANSCRIPTS BUT NO ACTION ITEMS' as check_name,
  COUNT(*) as count
FROM meetings m
LEFT JOIN meeting_action_items ai ON ai.meeting_id = m.id
WHERE m.transcript_text IS NOT NULL
  AND m.created_at > NOW() - INTERVAL '48 hours'
GROUP BY m.id
HAVING COUNT(ai.id) = 0;

-- ============================================================================
-- STEP 2: Detailed analysis of recent meetings
-- ============================================================================
SELECT
  m.id,
  m.fathom_recording_id,
  m.title,
  m.meeting_start,

  -- Transcript status
  CASE
    WHEN m.transcript_text IS NULL THEN '❌ No transcript'
    WHEN LENGTH(m.transcript_text) < 100 THEN '⚠️  Very short transcript'
    WHEN LENGTH(m.transcript_text) < 1000 THEN '📄 Short transcript'
    ELSE '📚 Full transcript'
  END as transcript_status,
  LENGTH(m.transcript_text) as transcript_chars,
  m.transcript_fetch_attempts,
  m.last_transcript_fetch_at,

  -- AI Analysis status
  CASE
    WHEN m.sentiment_score IS NULL AND m.talk_time_rep_pct IS NULL THEN '❌ AI analysis NOT run'
    WHEN m.sentiment_score IS NOT NULL AND m.talk_time_rep_pct IS NOT NULL THEN '✅ AI analysis complete'
    ELSE '⚠️  Partial AI analysis'
  END as ai_analysis_status,
  m.sentiment_score,
  m.talk_time_rep_pct,

  -- Action items status
  COUNT(ai.id) as action_item_count,
  STRING_AGG(
    ai.title || ' (' ||
    CASE WHEN ai.ai_generated THEN 'AI' ELSE 'Fathom' END ||
    ', ' || ai.priority || ')',
    ' | '
  ) as action_items_summary,

  -- Sync status
  m.sync_status,
  m.last_synced_at

FROM meetings m
LEFT JOIN meeting_action_items ai ON ai.meeting_id = m.id
WHERE m.created_at > NOW() - INTERVAL '48 hours'
GROUP BY m.id
ORDER BY m.meeting_start DESC;

-- ============================================================================
-- STEP 3: Check if ANY meetings have AI-generated action items
-- ============================================================================
SELECT
  '🤖 TOTAL AI-GENERATED ACTION ITEMS (last 48h)' as check_name,
  COUNT(*) as total_ai_items
FROM meeting_action_items ai
JOIN meetings m ON m.id = ai.meeting_id
WHERE ai.ai_generated = true
  AND m.created_at > NOW() - INTERVAL '48 hours';

SELECT
  '📋 TOTAL FATHOM ACTION ITEMS (last 48h)' as check_name,
  COUNT(*) as total_fathom_items
FROM meeting_action_items ai
JOIN meetings m ON m.id = ai.meeting_id
WHERE ai.ai_generated = false
  AND m.created_at > NOW() - INTERVAL '48 hours';

-- ============================================================================
-- STEP 4: Check meetings that should trigger AI extraction retry
-- ============================================================================
SELECT
  '🔄 MEETINGS THAT SHOULD RETRY AI EXTRACTION' as check_name,
  m.id,
  m.title,
  m.transcript_fetch_attempts,
  EXTRACT(EPOCH FROM (NOW() - m.last_transcript_fetch_at)) / 60 as minutes_since_last_fetch,
  CASE
    WHEN COALESCE(m.transcript_fetch_attempts, 0) >= 24 THEN '🚨 Extended cooldown (12h cadence)'
    WHEN COALESCE(m.transcript_fetch_attempts, 0) >= 12 THEN '⚠️ Heavy retry cadence'
    WHEN EXTRACT(EPOCH FROM (NOW() - m.last_transcript_fetch_at)) / 60 <
         CASE
           WHEN COALESCE(m.transcript_fetch_attempts, 0) >= 24 THEN 720
           WHEN COALESCE(m.transcript_fetch_attempts, 0) >= 12 THEN 180
           WHEN COALESCE(m.transcript_fetch_attempts, 0) >= 6 THEN 60
           WHEN COALESCE(m.transcript_fetch_attempts, 0) >= 3 THEN 15
           ELSE 5
         END THEN '⏳ In cooldown period'
    ELSE '✅ Ready for retry'
  END as retry_status
FROM meetings m
LEFT JOIN meeting_action_items ai ON ai.meeting_id = m.id
WHERE m.transcript_text IS NOT NULL
  AND m.created_at > NOW() - INTERVAL '48 hours'
GROUP BY m.id
HAVING COUNT(ai.id) = 0;

-- ============================================================================
-- STEP 5: Check for meetings stuck in processing
-- ============================================================================
SELECT
  '⏸️  MEETINGS STUCK IN PROCESSING' as check_name,
  COUNT(*) as count
FROM meetings m
WHERE m.sync_status = 'syncing'
  AND m.created_at > NOW() - INTERVAL '48 hours'
  AND m.last_synced_at < NOW() - INTERVAL '10 minutes';

-- ============================================================================
-- STEP 6: Sample meeting for detailed inspection
-- ============================================================================
-- Pick the most recent meeting with a transcript but no action items
WITH problem_meeting AS (
  SELECT m.id
  FROM meetings m
  LEFT JOIN meeting_action_items ai ON ai.meeting_id = m.id
  WHERE m.transcript_text IS NOT NULL
    AND m.created_at > NOW() - INTERVAL '48 hours'
  GROUP BY m.id
  HAVING COUNT(ai.id) = 0
  ORDER BY m.meeting_start DESC
  LIMIT 1
)
SELECT
  '📋 DETAILED INSPECTION OF PROBLEM MEETING' as section,
  m.id,
  m.fathom_recording_id,
  m.title,
  m.meeting_start,
  m.meeting_end,
  m.duration_minutes,
  LENGTH(m.transcript_text) as transcript_length,
  SUBSTRING(m.transcript_text, 1, 200) || '...' as transcript_preview,
  m.summary IS NOT NULL as has_summary,
  m.sentiment_score,
  m.sentiment_reasoning,
  m.talk_time_rep_pct,
  m.talk_time_customer_pct,
  m.talk_time_judgement,
  m.transcript_fetch_attempts,
  m.last_transcript_fetch_at,
  m.sync_status,
  m.last_synced_at,
  m.created_at,
  m.owner_email
FROM meetings m
WHERE m.id = (SELECT id FROM problem_meeting);

-- ============================================================================
-- STEP 7: Recommendations based on results
-- ============================================================================
SELECT
  '💡 DIAGNOSTIC SUMMARY' as section,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.transcript_text IS NOT NULL
        AND m.sentiment_score IS NULL
        AND m.talk_time_rep_pct IS NULL
        AND m.created_at > NOW() - INTERVAL '48 hours'
    ) THEN '❌ AI analysis is NOT running at all - check ANTHROPIC_API_KEY and function logs'

    WHEN EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.transcript_text IS NOT NULL
        AND m.sentiment_score IS NOT NULL
        AND m.talk_time_rep_pct IS NOT NULL
        AND m.created_at > NOW() - INTERVAL '48 hours'
        AND NOT EXISTS (
          SELECT 1 FROM meeting_action_items ai
          WHERE ai.meeting_id = m.id
        )
    ) THEN '⚠️  AI analysis runs but produces NO action items - check if meetings are too short or lack actionable content'

    WHEN EXISTS (
      SELECT 1 FROM meeting_action_items ai
      WHERE ai.ai_generated = true
        AND EXISTS (
          SELECT 1 FROM meetings m
          WHERE m.id = ai.meeting_id
            AND m.created_at > NOW() - INTERVAL '48 hours'
        )
    ) THEN '✅ AI extraction is working - some meetings may not have action items'

    ELSE '🤷 Unable to determine issue - check function logs'
  END as diagnosis;
