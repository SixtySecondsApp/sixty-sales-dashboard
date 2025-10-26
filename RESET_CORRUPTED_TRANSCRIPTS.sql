-- Reset corrupted transcripts so they can be re-fetched with correct parsing
-- Run this after deploying the transcript parsing fix

-- 1. Show how many transcripts are corrupted
SELECT
  COUNT(*) as total_transcripts,
  COUNT(CASE WHEN transcript_text LIKE '%[object Object]%' THEN 1 END) as corrupted_transcripts,
  COUNT(CASE WHEN transcript_text NOT LIKE '%[object Object]%' AND transcript_text IS NOT NULL THEN 1 END) as valid_transcripts
FROM meetings
WHERE meeting_start >= NOW() - INTERVAL '30 days';

-- 2. Clear corrupted transcripts and reset fetch attempts
-- This will trigger re-fetching on the next sync
UPDATE meetings
SET
  transcript_text = NULL,
  transcript_fetch_attempts = 0,
  last_transcript_fetch_at = NULL,
  -- Also clear the bad AI metrics that were based on corrupted transcripts
  sentiment_score = NULL,
  sentiment_reasoning = NULL,
  talk_time_rep_pct = NULL,
  talk_time_customer_pct = NULL,
  talk_time_judgement = NULL
WHERE meeting_start >= NOW() - INTERVAL '30 days'
  AND (
    transcript_text LIKE '%[object Object]%'  -- Corrupted format
    OR talk_time_judgement LIKE '%Unable to analyze%'  -- Failed analysis
  );

-- 3. Verify the reset
SELECT
  COUNT(*) as meetings_ready_for_refetch,
  MIN(meeting_start) as oldest_meeting,
  MAX(meeting_start) as newest_meeting
FROM meetings
WHERE meeting_start >= NOW() - INTERVAL '30 days'
  AND transcript_text IS NULL
  AND transcript_fetch_attempts = 0;

-- 4. Show remaining valid transcripts (if any)
SELECT
  title,
  meeting_start,
  LENGTH(transcript_text) as transcript_length,
  LEFT(transcript_text, 200) as preview
FROM meetings
WHERE meeting_start >= NOW() - INTERVAL '30 days'
  AND transcript_text IS NOT NULL
  AND transcript_text NOT LIKE '%[object Object]%'
ORDER BY meeting_start DESC
LIMIT 5;
