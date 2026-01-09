-- Create functions and triggers for automatic meeting insights aggregation

-- Function to calculate engagement score for a contact
CREATE OR REPLACE FUNCTION calculate_contact_engagement_score(
  p_total_meetings INTEGER,
  p_avg_sentiment NUMERIC,
  p_days_since_last_meeting INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_score INTEGER := 0;
  v_meeting_score INTEGER;
  v_sentiment_score INTEGER;
  v_recency_score INTEGER;
BEGIN
  -- Meeting frequency score (0-40 points)
  v_meeting_score := LEAST(p_total_meetings * 5, 40);

  -- Sentiment score (0-30 points)
  -- Map sentiment from -1/+1 to 0-30
  IF p_avg_sentiment IS NOT NULL THEN
    v_sentiment_score := GREATEST(0, ROUND((p_avg_sentiment + 1) * 15));
  ELSE
    v_sentiment_score := 15; -- Neutral default
  END IF;

  -- Recency score (0-30 points)
  -- More recent = higher score
  IF p_days_since_last_meeting IS NULL THEN
    v_recency_score := 0;
  ELSIF p_days_since_last_meeting <= 7 THEN
    v_recency_score := 30;
  ELSIF p_days_since_last_meeting <= 14 THEN
    v_recency_score := 25;
  ELSIF p_days_since_last_meeting <= 30 THEN
    v_recency_score := 20;
  ELSIF p_days_since_last_meeting <= 60 THEN
    v_recency_score := 10;
  ELSE
    v_recency_score := 5;
  END IF;

  v_score := v_meeting_score + v_sentiment_score + v_recency_score;

  RETURN LEAST(v_score, 100);
END;
$$ LANGUAGE plpgsql;

-- Function to determine sentiment trend
CREATE OR REPLACE FUNCTION calculate_sentiment_trend(
  p_contact_id UUID DEFAULT NULL,
  p_company_id UUID DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  v_recent_sentiment NUMERIC;
  v_older_sentiment NUMERIC;
  v_difference NUMERIC;
BEGIN
  -- Get average sentiment from last 3 meetings vs previous 3 meetings
  IF p_contact_id IS NOT NULL THEN
    -- Recent 3 meetings
    SELECT AVG(m.sentiment_score) INTO v_recent_sentiment
    FROM meetings m
    JOIN meeting_contacts mc ON m.id = mc.meeting_id
    WHERE mc.contact_id = p_contact_id
      AND m.sentiment_score IS NOT NULL
    ORDER BY m.meeting_start DESC
    LIMIT 3;

    -- Previous 3 meetings (offset 3)
    SELECT AVG(m.sentiment_score) INTO v_older_sentiment
    FROM meetings m
    JOIN meeting_contacts mc ON m.id = mc.meeting_id
    WHERE mc.contact_id = p_contact_id
      AND m.sentiment_score IS NOT NULL
    ORDER BY m.meeting_start DESC
    LIMIT 3 OFFSET 3;

  ELSIF p_company_id IS NOT NULL THEN
    -- Recent 3 meetings
    SELECT AVG(m.sentiment_score) INTO v_recent_sentiment
    FROM meetings m
    WHERE m.company_id = p_company_id
      AND m.sentiment_score IS NOT NULL
    ORDER BY m.meeting_start DESC
    LIMIT 3;

    -- Previous 3 meetings (offset 3)
    SELECT AVG(m.sentiment_score) INTO v_older_sentiment
    FROM meetings m
    WHERE m.company_id = p_company_id
      AND m.sentiment_score IS NOT NULL
    ORDER BY m.meeting_start DESC
    LIMIT 3 OFFSET 3;
  END IF;

  IF v_recent_sentiment IS NULL OR v_older_sentiment IS NULL THEN
    RETURN 'unknown';
  END IF;

  v_difference := v_recent_sentiment - v_older_sentiment;

  IF v_difference > 0.2 THEN
    RETURN 'improving';
  ELSIF v_difference < -0.2 THEN
    RETURN 'declining';
  ELSE
    RETURN 'stable';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate contact meeting insights
CREATE OR REPLACE FUNCTION aggregate_contact_meeting_insights(p_contact_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total_meetings INTEGER;
  v_last_meeting_date TIMESTAMPTZ;
  v_avg_sentiment NUMERIC;
  v_avg_talk_time NUMERIC;
  v_sentiment_trend TEXT;
  v_engagement_score INTEGER;
  v_days_since_last INTEGER;
  v_key_topics TEXT[];
BEGIN
  -- Aggregate basic statistics
  SELECT
    COUNT(*),
    MAX(m.meeting_start),
    AVG(m.sentiment_score),
    AVG(m.talk_time_customer_pct)
  INTO
    v_total_meetings,
    v_last_meeting_date,
    v_avg_sentiment,
    v_avg_talk_time
  FROM meetings m
  JOIN meeting_contacts mc ON m.id = mc.meeting_id
  WHERE mc.contact_id = p_contact_id
    AND m.sync_status = 'synced';

  -- Calculate days since last meeting
  IF v_last_meeting_date IS NOT NULL THEN
    v_days_since_last := EXTRACT(DAY FROM (NOW() - v_last_meeting_date));
  END IF;

  -- Calculate sentiment trend
  v_sentiment_trend := calculate_sentiment_trend(p_contact_id := p_contact_id);

  -- Calculate engagement score
  v_engagement_score := calculate_contact_engagement_score(
    v_total_meetings,
    v_avg_sentiment,
    v_days_since_last
  );

  -- Extract key topics (from meeting_topics table if available)
  SELECT ARRAY_AGG(DISTINCT t.label)
  INTO v_key_topics
  FROM meeting_topics t
  JOIN meeting_contacts mc ON t.meeting_id = mc.meeting_id
  WHERE mc.contact_id = p_contact_id
  LIMIT 20; -- Limit to top 20 topics

  -- Upsert insights
  INSERT INTO contact_meeting_insights (
    contact_id,
    total_meetings,
    last_meeting_date,
    avg_sentiment_score,
    sentiment_trend,
    avg_talk_time_customer_pct,
    engagement_score,
    key_topics,
    last_updated_at
  ) VALUES (
    p_contact_id,
    v_total_meetings,
    v_last_meeting_date,
    v_avg_sentiment,
    v_sentiment_trend,
    v_avg_talk_time,
    v_engagement_score,
    v_key_topics,
    NOW()
  )
  ON CONFLICT (contact_id) DO UPDATE SET
    total_meetings = EXCLUDED.total_meetings,
    last_meeting_date = EXCLUDED.last_meeting_date,
    avg_sentiment_score = EXCLUDED.avg_sentiment_score,
    sentiment_trend = EXCLUDED.sentiment_trend,
    avg_talk_time_customer_pct = EXCLUDED.avg_talk_time_customer_pct,
    engagement_score = EXCLUDED.engagement_score,
    key_topics = EXCLUDED.key_topics,
    last_updated_at = NOW();

  RAISE NOTICE 'Updated insights for contact %: % meetings, engagement score: %',
    p_contact_id, v_total_meetings, v_engagement_score;
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate company meeting insights
CREATE OR REPLACE FUNCTION aggregate_company_meeting_insights(p_company_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total_meetings INTEGER;
  v_total_contacts INTEGER;
  v_last_meeting_date TIMESTAMPTZ;
  v_avg_sentiment NUMERIC;
  v_sentiment_trend TEXT;
  v_engagement_score INTEGER;
  v_days_since_last INTEGER;
  v_avg_days_between_meetings NUMERIC;
  v_key_topics TEXT[];
BEGIN
  -- Aggregate basic statistics
  SELECT
    COUNT(DISTINCT m.id),
    COUNT(DISTINCT mc.contact_id),
    MAX(m.meeting_start),
    AVG(m.sentiment_score)
  INTO
    v_total_meetings,
    v_total_contacts,
    v_last_meeting_date,
    v_avg_sentiment
  FROM meetings m
  LEFT JOIN meeting_contacts mc ON m.id = mc.meeting_id
  WHERE m.company_id = p_company_id
    AND m.sync_status = 'synced';

  -- Calculate days since last meeting
  IF v_last_meeting_date IS NOT NULL THEN
    v_days_since_last := EXTRACT(DAY FROM (NOW() - v_last_meeting_date));
  END IF;

  -- Calculate average days between meetings
  WITH meeting_gaps AS (
    SELECT
      meeting_start,
      LAG(meeting_start) OVER (ORDER BY meeting_start) AS prev_meeting
    FROM meetings
    WHERE company_id = p_company_id
      AND sync_status = 'synced'
  )
  SELECT AVG(EXTRACT(DAY FROM (meeting_start - prev_meeting)))
  INTO v_avg_days_between_meetings
  FROM meeting_gaps
  WHERE prev_meeting IS NOT NULL;

  -- Calculate sentiment trend
  v_sentiment_trend := calculate_sentiment_trend(p_company_id := p_company_id);

  -- Calculate engagement score (similar to contact but company-level)
  v_engagement_score := calculate_contact_engagement_score(
    v_total_meetings,
    v_avg_sentiment,
    v_days_since_last
  );

  -- Extract key topics
  SELECT ARRAY_AGG(DISTINCT t.label)
  INTO v_key_topics
  FROM meeting_topics t
  JOIN meetings m ON t.meeting_id = m.id
  WHERE m.company_id = p_company_id
  LIMIT 20;

  -- Upsert insights
  INSERT INTO company_meeting_insights (
    company_id,
    total_meetings,
    total_contacts_met,
    last_meeting_date,
    avg_sentiment_score,
    sentiment_trend,
    engagement_score,
    meeting_frequency_days,
    key_topics,
    last_updated_at
  ) VALUES (
    p_company_id,
    v_total_meetings,
    v_total_contacts,
    v_last_meeting_date,
    v_avg_sentiment,
    v_sentiment_trend,
    v_engagement_score,
    v_avg_days_between_meetings,
    v_key_topics,
    NOW()
  )
  ON CONFLICT (company_id) DO UPDATE SET
    total_meetings = EXCLUDED.total_meetings,
    total_contacts_met = EXCLUDED.total_contacts_met,
    last_meeting_date = EXCLUDED.last_meeting_date,
    avg_sentiment_score = EXCLUDED.avg_sentiment_score,
    sentiment_trend = EXCLUDED.sentiment_trend,
    engagement_score = EXCLUDED.engagement_score,
    meeting_frequency_days = EXCLUDED.meeting_frequency_days,
    key_topics = EXCLUDED.key_topics,
    last_updated_at = NOW();

  RAISE NOTICE 'Updated insights for company %: % meetings with % contacts, engagement score: %',
    p_company_id, v_total_meetings, v_total_contacts, v_engagement_score;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to update insights when meetings are synced
CREATE OR REPLACE FUNCTION trigger_update_meeting_insights()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger on synced meetings
  IF NEW.sync_status = 'synced' THEN
    -- Update contact insights for all linked contacts
    PERFORM aggregate_contact_meeting_insights(mc.contact_id)
    FROM meeting_contacts mc
    WHERE mc.meeting_id = NEW.id;

    -- Update company insights if linked
    IF NEW.company_id IS NOT NULL THEN
      PERFORM aggregate_company_meeting_insights(NEW.company_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on meetings table
DROP TRIGGER IF EXISTS update_insights_on_meeting_sync ON meetings;
CREATE TRIGGER update_insights_on_meeting_sync
AFTER INSERT OR UPDATE ON meetings
FOR EACH ROW
WHEN (NEW.sync_status = 'synced')
EXECUTE FUNCTION trigger_update_meeting_insights();

-- Comments
COMMENT ON FUNCTION aggregate_contact_meeting_insights IS 'Aggregates all meeting data for a contact into insights table';
COMMENT ON FUNCTION aggregate_company_meeting_insights IS 'Aggregates all meeting data for a company into insights table';
COMMENT ON FUNCTION calculate_contact_engagement_score IS 'Calculates engagement score (0-100) based on meetings, sentiment, and recency';
COMMENT ON FUNCTION calculate_sentiment_trend IS 'Determines if sentiment is improving, stable, or declining';
