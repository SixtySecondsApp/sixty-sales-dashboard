-- Get a meeting with transcript to test
SELECT 
  id,
  title,
  LENGTH(transcript_text) as transcript_chars,
  created_at
FROM meetings 
WHERE transcript_text IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 5;
