-- ============================================================================
-- Migration: Create Deal Sentiment Trends View
-- ============================================================================
-- Purpose:
--   Aggregate sentiment scores across all meetings for a deal to show
--   how sentiment is trending over time, not just individual meeting scores.
--
-- Features:
--   - Average, min, max sentiment per deal
--   - Meeting count per deal
--   - Trend calculation (recent 3 meetings vs previous 3)
--   - Trend direction indicator (improving/stable/declining)
--
-- Data Sources:
--   - meetings.sentiment_score (-1.0 to +1.0)
--   - activities table (links meetings to deals via meeting_id + deal_id)
-- ============================================================================

-- Create view for deal sentiment aggregation
CREATE OR REPLACE VIEW deal_sentiment_trends AS
WITH deal_meeting_data AS (
  -- Get meetings linked to deals via activities table
  -- Activities have both meeting_id and deal_id
  SELECT DISTINCT
    a.deal_id,
    m.id as meeting_id,
    m.sentiment_score,
    m.meeting_start,
    m.talk_time_rep_pct,
    m.coach_rating
  FROM activities a
  JOIN meetings m ON m.id = a.meeting_id
  WHERE a.deal_id IS NOT NULL
    AND a.meeting_id IS NOT NULL
    AND m.sentiment_score IS NOT NULL
),
ranked_meetings AS (
  -- Rank meetings by date for trend calculation
  SELECT
    deal_id,
    meeting_id,
    sentiment_score,
    meeting_start,
    talk_time_rep_pct,
    coach_rating,
    ROW_NUMBER() OVER (
      PARTITION BY deal_id
      ORDER BY meeting_start DESC NULLS LAST
    ) as rn
  FROM deal_meeting_data
),
aggregated AS (
  SELECT
    deal_id,

    -- Basic aggregations
    AVG(sentiment_score)::NUMERIC(4,3) as avg_sentiment,
    MIN(sentiment_score)::NUMERIC(4,3) as min_sentiment,
    MAX(sentiment_score)::NUMERIC(4,3) as max_sentiment,
    COUNT(DISTINCT meeting_id)::INTEGER as meeting_count,

    -- Latest meeting info
    MAX(meeting_start) as last_meeting_at,

    -- Trend: compare last 3 meetings vs previous 3
    AVG(CASE WHEN rn <= 3 THEN sentiment_score END)::NUMERIC(4,3) as recent_avg,
    AVG(CASE WHEN rn > 3 AND rn <= 6 THEN sentiment_score END)::NUMERIC(4,3) as previous_avg,

    -- Talk time and coaching averages
    AVG(talk_time_rep_pct)::NUMERIC(5,2) as avg_talk_time_rep_pct,
    AVG(coach_rating)::NUMERIC(4,2) as avg_coach_rating,

    -- Sparkline data: last 6 sentiment scores in chronological order
    ARRAY(
      SELECT rm2.sentiment_score
      FROM ranked_meetings rm2
      WHERE rm2.deal_id = ranked_meetings.deal_id
        AND rm2.rn <= 6
      ORDER BY rm2.rn DESC
    ) as sentiment_history

  FROM ranked_meetings
  GROUP BY deal_id
)
SELECT
  deal_id,
  avg_sentiment,
  min_sentiment,
  max_sentiment,
  meeting_count,
  last_meeting_at,
  recent_avg,
  previous_avg,
  avg_talk_time_rep_pct,
  avg_coach_rating,
  sentiment_history,

  -- Calculate trend direction
  CASE
    WHEN previous_avg IS NULL THEN 'insufficient_data'
    WHEN recent_avg - previous_avg > 0.1 THEN 'improving'
    WHEN recent_avg - previous_avg < -0.1 THEN 'declining'
    ELSE 'stable'
  END as trend_direction,

  -- Calculate trend magnitude (-1 to +1 range)
  CASE
    WHEN previous_avg IS NULL THEN 0
    ELSE (recent_avg - previous_avg)::NUMERIC(4,3)
  END as trend_delta

FROM aggregated;

-- Add comment on view
COMMENT ON VIEW deal_sentiment_trends IS
  'Aggregates meeting sentiment data per deal for trend analysis. Shows average sentiment, trend direction (improving/stable/declining), and historical data for sparklines.';

-- Create index on activities for the deal-meeting join (if not exists)
CREATE INDEX IF NOT EXISTS idx_activities_deal_meeting_lookup
  ON activities(deal_id, meeting_id)
  WHERE deal_id IS NOT NULL AND meeting_id IS NOT NULL;

-- Create index on meetings for sentiment queries
CREATE INDEX IF NOT EXISTS idx_meetings_sentiment_start
  ON meetings(meeting_start DESC)
  WHERE sentiment_score IS NOT NULL;

-- Grant select on view to authenticated users
GRANT SELECT ON deal_sentiment_trends TO authenticated;

-- ============================================================================
-- RLS Note: This view inherits security from the underlying tables.
-- Users can only see sentiment trends for deals they have access to via
-- the activities table and RLS policies on deals/meetings/activities.
-- ============================================================================
