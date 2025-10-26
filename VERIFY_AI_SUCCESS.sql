-- Verify AI Analysis is now working successfully
-- Run this after the constraint fix to confirm everything is populated

-- 1. Check recent meetings with AI metrics
SELECT
  title,
  meeting_start,
  LENGTH(transcript_text) as transcript_chars,
  sentiment_score,
  sentiment_reasoning,
  talk_time_rep_pct,
  talk_time_customer_pct,
  talk_time_judgement,
  (SELECT COUNT(*)
   FROM meeting_action_items
   WHERE meeting_id = m.id AND ai_generated = true) as ai_action_items
FROM meetings m
WHERE meeting_start >= NOW() - INTERVAL '7 days'
  AND transcript_text IS NOT NULL
ORDER BY meeting_start DESC
LIMIT 5;

-- 2. Verify data looks reasonable
SELECT
  COUNT(*) as total_meetings_with_transcript,
  COUNT(sentiment_score) as meetings_with_sentiment,
  COUNT(talk_time_rep_pct) as meetings_with_talk_time,
  ROUND(AVG(sentiment_score)::numeric, 2) as avg_sentiment,
  ROUND(AVG(talk_time_rep_pct)::numeric, 2) as avg_rep_talk_pct,
  ROUND(AVG(talk_time_customer_pct)::numeric, 2) as avg_customer_talk_pct
FROM meetings
WHERE meeting_start >= NOW() - INTERVAL '7 days'
  AND transcript_text IS NOT NULL;

-- 3. Check AI-generated action items
SELECT
  m.title,
  COUNT(mai.id) as ai_items_count,
  STRING_AGG(mai.title, '; ' ORDER BY mai.priority DESC) as action_items
FROM meetings m
JOIN meeting_action_items mai ON m.id = mai.meeting_id
WHERE m.meeting_start >= NOW() - INTERVAL '7 days'
  AND mai.ai_generated = true
GROUP BY m.id, m.title
ORDER BY m.meeting_start DESC;

-- 4. Sample of natural language judgements (showing Claude's insights work!)
SELECT
  title,
  talk_time_judgement,
  talk_time_rep_pct || '% rep / ' || talk_time_customer_pct || '% customer' as talk_split
FROM meetings
WHERE meeting_start >= NOW() - INTERVAL '7 days'
  AND talk_time_judgement IS NOT NULL
ORDER BY meeting_start DESC
LIMIT 10;
