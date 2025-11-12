-- =====================================================
-- Fathom Transcript AI Analysis Verification Queries
-- =====================================================
-- Run these queries to verify the AI analysis implementation
-- after running the database migration and triggering a sync.

-- =====================================================
-- 1. VERIFY NEW COLUMNS EXIST IN MEETINGS TABLE
-- =====================================================
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'meetings'
  AND column_name IN (
    'transcript_fetch_attempts',
    'last_transcript_fetch_at',
    'talk_time_rep_pct',
    'talk_time_customer_pct',
    'sentiment_score',
    'sentiment_reasoning',
    'talk_time_judgement'
  )
ORDER BY column_name;

-- Expected: 7 rows showing all new columns


-- =====================================================
-- 2. VERIFY NEW COLUMNS EXIST IN MEETING_ACTION_ITEMS TABLE
-- =====================================================
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'meeting_action_items'
  AND column_name IN (
    'ai_generated',
    'ai_confidence',
    'needs_review',
    'assigned_to_name',
    'assigned_to_email',
    'deadline_date'
  )
ORDER BY column_name;

-- Expected: 6 rows showing all new columns


-- =====================================================
-- 3. CHECK RECENT MEETINGS WITH TRANSCRIPT DATA
-- =====================================================
SELECT
  id,
  title,
  meeting_start,
  LENGTH(transcript_text) as transcript_length,
  transcript_fetch_attempts,
  last_transcript_fetch_at,
  sentiment_score,
  talk_time_rep_pct,
  talk_time_customer_pct,
  talk_time_judgement,
  LEFT(sentiment_reasoning, 100) as sentiment_summary
FROM meetings
WHERE meeting_start >= NOW() - INTERVAL '7 days'
ORDER BY meeting_start DESC
LIMIT 10;

-- Expected: Shows recent meetings with transcript data and AI metrics


-- =====================================================
-- 4. COUNT AI-GENERATED ACTION ITEMS
-- =====================================================
SELECT
  ai_generated,
  COUNT(*) as count,
  AVG(ai_confidence) as avg_confidence,
  COUNT(CASE WHEN needs_review THEN 1 END) as needs_review_count
FROM meeting_action_items
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY ai_generated;

-- Expected: Shows breakdown of AI vs Fathom action items


-- =====================================================
-- 5. VIEW AI-GENERATED ACTION ITEMS WITH DETAILS
-- =====================================================
SELECT
  mai.id,
  m.title as meeting_title,
  mai.title as action_item,
  mai.category,
  mai.priority,
  mai.ai_confidence,
  mai.needs_review,
  mai.assigned_to_name,
  mai.assigned_to_email,
  mai.deadline_date,
  mai.completed
FROM meeting_action_items mai
JOIN meetings m ON mai.meeting_id = m.id
WHERE mai.ai_generated = true
  AND m.meeting_start >= NOW() - INTERVAL '7 days'
ORDER BY m.meeting_start DESC, mai.ai_confidence DESC
LIMIT 20;

-- Expected: Shows AI-extracted action items with confidence scores


-- =====================================================
-- 6. COMPARE AI VS FATHOM ACTION ITEMS BY MEETING
-- =====================================================
SELECT
  m.title as meeting_title,
  m.meeting_start,
  COUNT(CASE WHEN mai.ai_generated = false THEN 1 END) as fathom_items,
  COUNT(CASE WHEN mai.ai_generated = true THEN 1 END) as ai_items,
  COUNT(*) as total_items
FROM meetings m
LEFT JOIN meeting_action_items mai ON m.id = mai.meeting_id
WHERE m.meeting_start >= NOW() - INTERVAL '7 days'
GROUP BY m.id, m.title, m.meeting_start
HAVING COUNT(*) > 0
ORDER BY m.meeting_start DESC;

-- Expected: Shows how many action items came from each source per meeting


-- =====================================================
-- 7. CHECK TRANSCRIPT FETCH RETRY STATUS
-- =====================================================
SELECT
  COUNT(CASE WHEN transcript_text IS NOT NULL THEN 1 END) as with_transcript,
  COUNT(CASE WHEN transcript_text IS NULL AND transcript_fetch_attempts = 0 THEN 1 END) as not_attempted,
  COUNT(CASE WHEN transcript_text IS NULL AND transcript_fetch_attempts BETWEEN 1 AND 2 THEN 1 END) as retrying_5_min,
  COUNT(CASE WHEN transcript_text IS NULL AND transcript_fetch_attempts BETWEEN 3 AND 5 THEN 1 END) as retrying_15_min,
  COUNT(CASE WHEN transcript_text IS NULL AND transcript_fetch_attempts BETWEEN 6 AND 11 THEN 1 END) as retrying_60_min,
  COUNT(CASE WHEN transcript_text IS NULL AND transcript_fetch_attempts >= 12 THEN 1 END) as heavy_retry_180_plus,
  COUNT(*) as total_meetings
FROM meetings
WHERE meeting_start >= NOW() - INTERVAL '7 days';

-- Expected: Shows retry status distribution


-- =====================================================
-- 8. ACTION ITEMS NEEDING MANUAL REVIEW (LOW CONFIDENCE)
-- =====================================================
SELECT
  m.title as meeting_title,
  m.meeting_start,
  mai.title as action_item,
  mai.category,
  mai.priority,
  mai.ai_confidence,
  mai.assigned_to_name,
  mai.deadline_date
FROM meeting_action_items mai
JOIN meetings m ON mai.meeting_id = m.id
WHERE mai.ai_generated = true
  AND mai.needs_review = true
ORDER BY mai.ai_confidence ASC, m.meeting_start DESC;

-- Expected: Shows low-confidence items that need manual review


-- =====================================================
-- 9. SENTIMENT ANALYSIS SUMMARY
-- =====================================================
SELECT
  CASE
    WHEN sentiment_score IS NULL THEN 'No Analysis'
    WHEN sentiment_score <= -0.25 THEN 'Challenging (≤ -0.25)'
    WHEN sentiment_score < 0.25 THEN 'Neutral (-0.25 to 0.25)'
    ELSE 'Positive (≥ 0.25)'
  END as sentiment_category,
  COUNT(*) as meeting_count,
  AVG(sentiment_score) as avg_score,
  MIN(sentiment_score) as min_score,
  MAX(sentiment_score) as max_score
FROM meetings
WHERE meeting_start >= NOW() - INTERVAL '7 days'
GROUP BY sentiment_category
ORDER BY AVG(sentiment_score) DESC NULLS LAST;

-- Expected: Distribution of meeting sentiments


-- =====================================================
-- 10. TALK TIME ANALYSIS
-- =====================================================
SELECT
  title,
  meeting_start,
  talk_time_rep_pct,
  talk_time_customer_pct,
  talk_time_judgement,
  sentiment_score
FROM meetings
WHERE talk_time_rep_pct IS NOT NULL
  AND meeting_start >= NOW() - INTERVAL '7 days'
ORDER BY ABS(talk_time_rep_pct - 50) DESC -- Most imbalanced first
LIMIT 10;

-- Expected: Meetings with talk time analysis showing balance


-- =====================================================
-- 11. MOST PRODUCTIVE MEETINGS (BY ACTION ITEMS)
-- =====================================================
SELECT
  m.title,
  m.meeting_start,
  COUNT(mai.id) as total_action_items,
  COUNT(CASE WHEN mai.ai_generated = true THEN 1 END) as ai_items,
  COUNT(CASE WHEN mai.ai_generated = false THEN 1 END) as fathom_items,
  m.sentiment_score,
  m.talk_time_rep_pct
FROM meetings m
LEFT JOIN meeting_action_items mai ON m.id = mai.meeting_id
WHERE m.meeting_start >= NOW() - INTERVAL '7 days'
GROUP BY m.id, m.title, m.meeting_start, m.sentiment_score, m.talk_time_rep_pct
HAVING COUNT(mai.id) > 0
ORDER BY COUNT(mai.id) DESC
LIMIT 10;

-- Expected: Meetings with the most action items extracted


-- =====================================================
-- 12. OVERALL SUMMARY STATISTICS
-- =====================================================
SELECT
  COUNT(DISTINCT m.id) as total_meetings,
  COUNT(DISTINCT CASE WHEN m.transcript_text IS NOT NULL THEN m.id END) as meetings_with_transcript,
  COUNT(DISTINCT CASE WHEN m.sentiment_score IS NOT NULL THEN m.id END) as meetings_with_sentiment,
  COUNT(DISTINCT CASE WHEN m.talk_time_rep_pct IS NOT NULL THEN m.id END) as meetings_with_talk_time,
  COUNT(mai.id) as total_action_items,
  COUNT(CASE WHEN mai.ai_generated = true THEN 1 END) as ai_action_items,
  COUNT(CASE WHEN mai.ai_generated = false THEN 1 END) as fathom_action_items,
  AVG(m.sentiment_score) as avg_sentiment,
  AVG(m.talk_time_rep_pct) as avg_rep_talk_time,
  AVG(mai.ai_confidence) FILTER (WHERE mai.ai_generated = true) as avg_ai_confidence
FROM meetings m
LEFT JOIN meeting_action_items mai ON m.id = mai.meeting_id
WHERE m.meeting_start >= NOW() - INTERVAL '7 days';

-- Expected: High-level overview of AI analysis coverage


-- =====================================================
-- 13. FIND MEETINGS READY FOR RETRY
-- =====================================================
SELECT
  id,
  title,
  meeting_start,
  transcript_fetch_attempts,
  last_transcript_fetch_at,
  EXTRACT(EPOCH FROM (NOW() - last_transcript_fetch_at)) / 60 as minutes_since_last_attempt
FROM meetings
WHERE transcript_text IS NULL
  AND transcript_fetch_attempts < 3
  AND (
    last_transcript_fetch_at IS NULL
    OR last_transcript_fetch_at < NOW() - INTERVAL '5 minutes'
  )
  AND meeting_start >= NOW() - INTERVAL '7 days'
ORDER BY meeting_start DESC;

-- Expected: Meetings that will be retried on next sync


-- =====================================================
-- INTERPRETATION GUIDE
-- =====================================================
--
-- HEALTHY IMPLEMENTATION INDICATORS:
-- ✅ All new columns exist in both tables (queries 1 & 2)
-- ✅ Recent meetings have transcript_text populated (query 3)
-- ✅ AI metrics (sentiment, talk_time) are being calculated (query 3)
-- ✅ AI-generated action items exist with confidence scores (queries 4 & 5)
-- ✅ Deduplication is working (more total items than duplicates) (query 6)
-- ✅ Retry logic is working (attempts incrementing, times tracked) (query 7)
--
-- ISSUES TO INVESTIGATE:
-- ❌ No transcripts after 15+ minutes → Check Fathom API
-- ❌ No AI metrics despite transcripts → Check Claude API key
-- ❌ All AI items need review → Check confidence threshold
-- ❌ Identical AI and Fathom items → Deduplication not working
-- ❌ Max retry attempts reached for recent meetings → Fathom processing delays
--
-- COST TRACKING:
-- - Count of AI analyses = meetings with sentiment_score
-- - Estimated cost = count × $0.01 per meeting
--
