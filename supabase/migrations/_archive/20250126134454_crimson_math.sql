/*
  # Add Activity Functions and Indexes

  1. New Functions
    - Calculate activity points
    - Calculate activity trends
    - Get activity summary

  2. Indexes
    - Add composite indexes for better query performance
*/

-- Function to calculate activity points
CREATE OR REPLACE FUNCTION calculate_activity_points(
  activity_type activity_type,
  amount decimal DEFAULT NULL
)
RETURNS integer AS $$
BEGIN
  RETURN CASE activity_type
    WHEN 'outbound' THEN 1
    WHEN 'meeting' THEN 5
    WHEN 'proposal' THEN 10
    WHEN 'sale' THEN 20
    ELSE 0
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate activity trends
CREATE OR REPLACE FUNCTION calculate_activity_trend(
  user_id uuid,
  activity_type activity_type,
  start_date timestamptz,
  end_date timestamptz
)
RETURNS numeric AS $$
DECLARE
  current_count integer;
  previous_count integer;
  interval_days integer;
BEGIN
  -- Get interval in days
  interval_days := EXTRACT(DAY FROM (end_date - start_date));
  
  -- Get current period count
  SELECT COUNT(*) INTO current_count
  FROM activities
  WHERE activities.user_id = calculate_activity_trend.user_id
  AND activities.type = calculate_activity_trend.activity_type
  AND date BETWEEN start_date AND end_date;

  -- Get previous period count
  SELECT COUNT(*) INTO previous_count
  FROM activities
  WHERE activities.user_id = calculate_activity_trend.user_id
  AND activities.type = calculate_activity_trend.activity_type
  AND date BETWEEN (start_date - (interval_days || ' days')::interval) AND start_date;

  -- Calculate trend percentage
  IF previous_count = 0 THEN
    RETURN 0;
  END IF;

  RETURN ROUND(((current_count - previous_count)::numeric / previous_count * 100), 1);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get activity summary
CREATE OR REPLACE FUNCTION get_activity_summary(
  user_id uuid,
  start_date timestamptz,
  end_date timestamptz
)
RETURNS TABLE (
  activity_type text,
  count bigint,
  points bigint,
  trend numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH summary AS (
    SELECT 
      a.type::text,
      COUNT(*) as count,
      SUM(calculate_activity_points(a.type, a.amount)) as points
    FROM activities a
    WHERE a.user_id = get_activity_summary.user_id
    AND a.date BETWEEN start_date AND end_date
    GROUP BY a.type
  )
  SELECT
    s.activity_type,
    s.count,
    s.points,
    calculate_activity_trend(
      get_activity_summary.user_id,
      s.activity_type::activity_type,
      start_date,
      end_date
    ) as trend
  FROM summary s;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add composite indexes for common queries
CREATE INDEX IF NOT EXISTS activities_user_date_type_idx 
  ON activities(user_id, date, type);

CREATE INDEX IF NOT EXISTS activities_user_type_date_idx 
  ON activities(user_id, type, date);

CREATE INDEX IF NOT EXISTS activities_date_type_user_idx 
  ON activities(date, type, user_id);