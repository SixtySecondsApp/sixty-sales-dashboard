-- Fix calculate_sentiment_trend function
-- Issue: Cannot use ORDER BY with aggregate function AVG()

-- Drop existing function first
DROP FUNCTION IF EXISTS calculate_sentiment_trend(UUID, UUID);

CREATE OR REPLACE FUNCTION calculate_sentiment_trend(p_company_id UUID, p_contact_id UUID DEFAULT NULL)
RETURNS NUMERIC AS $$
DECLARE
  v_avg_recent NUMERIC;
  v_avg_older NUMERIC;
BEGIN
  -- Get average sentiment from 3 most recent meetings (without ORDER BY in aggregate)
  SELECT AVG(sentiment_score) INTO v_avg_recent
  FROM (
    SELECT sentiment_score
    FROM meetings m
    WHERE m.company_id = p_company_id
      AND m.sentiment_score IS NOT NULL
      AND (p_contact_id IS NULL OR EXISTS (
        SELECT 1 FROM meeting_contacts mc
        WHERE mc.meeting_id = m.id AND mc.contact_id = p_contact_id
      ))
    ORDER BY m.meeting_start DESC
    LIMIT 3
  ) recent_meetings;

  -- Get average sentiment from 3 meetings before that (without ORDER BY in aggregate)
  SELECT AVG(sentiment_score) INTO v_avg_older
  FROM (
    SELECT sentiment_score
    FROM meetings m
    WHERE m.company_id = p_company_id
      AND m.sentiment_score IS NOT NULL
      AND (p_contact_id IS NULL OR EXISTS (
        SELECT 1 FROM meeting_contacts mc
        WHERE mc.meeting_id = m.id AND mc.contact_id = p_contact_id
      ))
    ORDER BY m.meeting_start DESC
    OFFSET 3
    LIMIT 3
  ) older_meetings;

  -- Return trend (positive = improving, negative = declining)
  IF v_avg_recent IS NULL OR v_avg_older IS NULL THEN
    RETURN 0; -- Not enough data
  END IF;

  RETURN v_avg_recent - v_avg_older;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_sentiment_trend IS 'Calculate sentiment trend by comparing recent vs older meetings';
