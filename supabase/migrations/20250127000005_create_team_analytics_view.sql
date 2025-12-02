-- Phase 5: Team Analytics Database View
-- Creates a view for aggregating team meeting metrics

CREATE OR REPLACE VIEW team_meeting_analytics AS
SELECT
  p.id as user_id,
  COALESCE(
    NULLIF(TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))), ''),
    p.email
  ) as full_name,
  p.email,
  COUNT(m.id) as total_meetings,
  AVG(m.sentiment_score) as avg_sentiment,
  AVG(m.talk_time_rep_pct) as avg_talk_time,
  AVG(m.coach_rating) as avg_coach_rating,
  COUNT(CASE WHEN m.sentiment_score > 0.2 THEN 1 END) as positive_meetings,
  COUNT(CASE WHEN m.sentiment_score < -0.2 THEN 1 END) as negative_meetings,
  SUM(m.duration_minutes) as total_duration_minutes,
  MAX(m.meeting_start) as last_meeting_date,
  MIN(m.meeting_start) as first_meeting_date
FROM profiles p
LEFT JOIN meetings m ON m.owner_user_id = p.id
WHERE m.meeting_start >= NOW() - INTERVAL '30 days'
  OR m.meeting_start IS NULL
GROUP BY p.id, p.first_name, p.last_name, p.email;

-- Add RLS policy for the view (users can only see their own team)
-- Note: This assumes team membership is tracked elsewhere
-- For now, we'll rely on application-level filtering

COMMENT ON VIEW team_meeting_analytics IS 'Aggregated team meeting metrics for the last 30 days';

