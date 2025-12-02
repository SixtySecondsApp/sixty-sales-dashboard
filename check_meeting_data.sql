-- Check if meeting exists and has metrics
SELECT 
  m.id,
  m.title,
  m.meeting_start,
  mm.talk_time_rep_pct,
  mm.talk_time_customer_pct,
  mm.talk_time_judgement,
  mm.sentiment_score,
  mm.coach_rating
FROM meetings m
LEFT JOIN meeting_metrics mm ON mm.meeting_id = m.id
WHERE m.id = '101f70e0-a1d4-4be5-9695-1f080d234c4b';
