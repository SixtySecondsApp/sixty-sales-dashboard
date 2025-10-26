-- Debug transcript format issues
-- Check what the actual transcript data looks like

-- 1. Show first 500 characters of recent transcripts
SELECT
  title,
  meeting_start,
  LENGTH(transcript_text) as total_length,
  LEFT(transcript_text, 500) as transcript_preview,
  transcript_text LIKE '%{%' as contains_json,
  transcript_text LIKE '%[object%' as contains_object_string
FROM meetings
WHERE meeting_start >= NOW() - INTERVAL '7 days'
  AND transcript_text IS NOT NULL
ORDER BY meeting_start DESC
LIMIT 5;

-- 2. Check for common data format issues
SELECT
  COUNT(*) as total_transcripts,
  COUNT(CASE WHEN transcript_text LIKE '%[object Object]%' THEN 1 END) as has_object_placeholder,
  COUNT(CASE WHEN transcript_text LIKE '%{%}%' THEN 1 END) as looks_like_json,
  COUNT(CASE WHEN transcript_text ~ '^[A-Za-z ]+:' THEN 1 END) as has_speaker_format,
  COUNT(CASE WHEN LENGTH(transcript_text) < 100 THEN 1 END) as very_short,
  COUNT(CASE WHEN LENGTH(transcript_text) > 1000 THEN 1 END) as reasonable_length
FROM meetings
WHERE meeting_start >= NOW() - INTERVAL '7 days'
  AND transcript_text IS NOT NULL;

-- 3. Show exact transcript for one meeting (to see the actual problem)
SELECT
  fathom_recording_id,
  title,
  LENGTH(transcript_text) as length,
  transcript_text
FROM meetings
WHERE meeting_start >= NOW() - INTERVAL '7 days'
  AND transcript_text IS NOT NULL
ORDER BY meeting_start DESC
LIMIT 1;
