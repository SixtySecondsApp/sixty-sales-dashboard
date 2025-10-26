-- Debug query to investigate AI analysis persistence issue
-- Run this immediately after seeing "✅ AI metrics stored" in logs

-- 1. Check if ANY meetings have AI metrics populated
SELECT
  COUNT(*) as total_meetings,
  COUNT(sentiment_score) as meetings_with_sentiment,
  COUNT(talk_time_rep_pct) as meetings_with_talk_time,
  COUNT(transcript_text) as meetings_with_transcript
FROM meetings;

-- 2. Check specific meetings from the last sync
SELECT
  id,
  fathom_recording_id,
  title,
  meeting_start,
  LENGTH(transcript_text) as transcript_chars,
  transcript_fetch_attempts,
  sentiment_score,
  talk_time_rep_pct,
  talk_time_customer_pct,
  talk_time_judgement,
  sentiment_reasoning,
  last_synced_at,
  updated_at
FROM meetings
WHERE meeting_start >= NOW() - INTERVAL '7 days'
ORDER BY last_synced_at DESC NULLS LAST
LIMIT 10;

-- 3. Check if there's a difference between last_synced_at and updated_at
-- This would indicate if the AI analysis UPDATE is failing
SELECT
  fathom_recording_id,
  title,
  last_synced_at,
  updated_at,
  EXTRACT(EPOCH FROM (updated_at - last_synced_at)) as seconds_difference,
  LENGTH(transcript_text) as has_transcript,
  sentiment_score IS NOT NULL as has_ai_metrics
FROM meetings
WHERE meeting_start >= NOW() - INTERVAL '7 days'
  AND last_synced_at IS NOT NULL
ORDER BY last_synced_at DESC
LIMIT 10;

-- 4. Check AI-generated action items (these should exist if AI analysis ran)
SELECT
  m.fathom_recording_id,
  m.title,
  COUNT(mai.id) as ai_action_items_count,
  MAX(mai.created_at) as latest_ai_item
FROM meetings m
LEFT JOIN meeting_action_items mai ON m.id = mai.meeting_id AND mai.ai_generated = true
WHERE m.meeting_start >= NOW() - INTERVAL '7 days'
GROUP BY m.id, m.fathom_recording_id, m.title
ORDER BY m.meeting_start DESC
LIMIT 10;

-- 5. Check for any database errors or constraints that might be blocking updates
-- This shows if there are any triggers or RLS policies that could interfere
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE tablename = 'meetings'
  AND indexname LIKE '%sentiment%' OR indexname LIKE '%talk_time%';

-- 6. Check RLS policies on meetings table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'meetings';
