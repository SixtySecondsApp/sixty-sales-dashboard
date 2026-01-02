-- Smart Engagement Algorithm - Phase 3: Feedback Functions
-- Implements feedback handling and preference adjustment

-- ============================================================================
-- Function: Adjust notification fatigue level
-- ============================================================================
CREATE OR REPLACE FUNCTION adjust_notification_fatigue(
  p_user_id UUID,
  p_adjustment INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE user_engagement_metrics
  SET
    notification_fatigue_level = GREATEST(0, LEAST(100, COALESCE(notification_fatigue_level, 0) + p_adjustment)),
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- If no row exists, create one with the adjustment
  IF NOT FOUND THEN
    INSERT INTO user_engagement_metrics (user_id, notification_fatigue_level)
    VALUES (p_user_id, GREATEST(0, LEAST(100, 50 + p_adjustment)));
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Check if feedback should be requested
-- ============================================================================
CREATE OR REPLACE FUNCTION should_request_feedback(
  p_user_id UUID
)
RETURNS TABLE (
  should_request BOOLEAN,
  reason TEXT,
  days_since_last_feedback INTEGER,
  notifications_since_last_feedback INTEGER
) AS $$
DECLARE
  v_metrics RECORD;
  v_days_since INTEGER;
  v_notif_count INTEGER;
BEGIN
  -- Get user metrics
  SELECT
    last_feedback_requested_at,
    COALESCE(notifications_since_last_feedback, 0) AS notif_count
  INTO v_metrics
  FROM user_engagement_metrics
  WHERE user_id = p_user_id;

  -- Calculate days since last feedback
  IF v_metrics.last_feedback_requested_at IS NOT NULL THEN
    v_days_since := EXTRACT(DAY FROM NOW() - v_metrics.last_feedback_requested_at)::INTEGER;
  ELSE
    v_days_since := NULL;
  END IF;

  v_notif_count := COALESCE(v_metrics.notif_count, 0);

  -- Check conditions
  -- 1. Never requested before and sent enough notifications (10+)
  IF v_days_since IS NULL AND v_notif_count >= 10 THEN
    RETURN QUERY SELECT TRUE, 'first_feedback_request'::TEXT, v_days_since, v_notif_count;
    RETURN;
  END IF;

  -- 2. Time-based check (every 14 days)
  IF v_days_since IS NOT NULL AND v_days_since >= 14 THEN
    RETURN QUERY SELECT TRUE, 'interval_elapsed'::TEXT, v_days_since, v_notif_count;
    RETURN;
  END IF;

  -- 3. High notification count (20+)
  IF v_notif_count >= 20 THEN
    RETURN QUERY SELECT TRUE, 'high_notification_count'::TEXT, v_days_since, v_notif_count;
    RETURN;
  END IF;

  -- Not due for feedback
  RETURN QUERY SELECT FALSE, 'not_due'::TEXT, v_days_since, v_notif_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Increment notification count for feedback tracking
-- ============================================================================
CREATE OR REPLACE FUNCTION increment_notification_count(
  p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE user_engagement_metrics
  SET
    notifications_since_last_feedback = COALESCE(notifications_since_last_feedback, 0) + 1,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- If no row exists, create one
  IF NOT FOUND THEN
    INSERT INTO user_engagement_metrics (user_id, notifications_since_last_feedback)
    VALUES (p_user_id, 1);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Record feedback and update preferences
-- ============================================================================
CREATE OR REPLACE FUNCTION record_notification_preference_feedback(
  p_user_id UUID,
  p_feedback_value TEXT  -- 'more', 'just_right', 'less'
)
RETURNS VOID AS $$
DECLARE
  v_new_frequency TEXT;
  v_fatigue_adjustment INTEGER;
BEGIN
  -- Determine new frequency and fatigue adjustment
  CASE p_feedback_value
    WHEN 'more' THEN
      v_new_frequency := 'high';
      v_fatigue_adjustment := -20;
    WHEN 'less' THEN
      v_new_frequency := 'low';
      v_fatigue_adjustment := 30;
    ELSE  -- 'just_right'
      v_new_frequency := NULL;  -- Keep current
      v_fatigue_adjustment := 0;
  END CASE;

  -- Update user preferences
  UPDATE user_engagement_metrics
  SET
    preferred_notification_frequency = COALESCE(v_new_frequency, preferred_notification_frequency),
    notification_fatigue_level = GREATEST(0, LEAST(100, COALESCE(notification_fatigue_level, 0) + v_fatigue_adjustment)),
    last_feedback_requested_at = NOW(),
    notifications_since_last_feedback = 0,
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Get users due for feedback requests
-- ============================================================================
CREATE OR REPLACE FUNCTION get_users_due_for_feedback(
  p_org_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  user_id UUID,
  org_id UUID,
  slack_user_id TEXT,
  days_since_last_feedback INTEGER,
  notifications_since_last_feedback INTEGER,
  reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    uem.user_id,
    uem.org_id,
    p.slack_user_id,
    CASE
      WHEN uem.last_feedback_requested_at IS NULL THEN NULL
      ELSE EXTRACT(DAY FROM NOW() - uem.last_feedback_requested_at)::INTEGER
    END AS days_since_last_feedback,
    COALESCE(uem.notifications_since_last_feedback, 0) AS notifications_since_last_feedback,
    CASE
      WHEN uem.last_feedback_requested_at IS NULL
           AND COALESCE(uem.notifications_since_last_feedback, 0) >= 10 THEN 'first_feedback_request'
      WHEN uem.last_feedback_requested_at IS NOT NULL
           AND NOW() - uem.last_feedback_requested_at >= INTERVAL '14 days' THEN 'interval_elapsed'
      WHEN COALESCE(uem.notifications_since_last_feedback, 0) >= 20 THEN 'high_notification_count'
      ELSE NULL
    END AS reason
  FROM user_engagement_metrics uem
  JOIN profiles p ON p.id = uem.user_id
  WHERE
    -- Has Slack connected
    p.slack_user_id IS NOT NULL
    -- Filter by org if specified
    AND (p_org_id IS NULL OR uem.org_id = p_org_id)
    -- Due for feedback
    AND (
      -- Never requested and has enough notifications
      (uem.last_feedback_requested_at IS NULL AND COALESCE(uem.notifications_since_last_feedback, 0) >= 10)
      -- Interval elapsed (14 days)
      OR (uem.last_feedback_requested_at IS NOT NULL AND NOW() - uem.last_feedback_requested_at >= INTERVAL '14 days')
      -- High notification count (20+)
      OR (COALESCE(uem.notifications_since_last_feedback, 0) >= 20)
    )
  ORDER BY
    -- Prioritize users with highest notification count
    COALESCE(uem.notifications_since_last_feedback, 0) DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Grant permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION adjust_notification_fatigue(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION should_request_feedback(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION increment_notification_count(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION record_notification_preference_feedback(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_users_due_for_feedback(UUID, INTEGER) TO service_role;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON FUNCTION adjust_notification_fatigue IS 'Adjust user notification fatigue level by given amount';
COMMENT ON FUNCTION should_request_feedback IS 'Check if a user is due for a feedback request';
COMMENT ON FUNCTION increment_notification_count IS 'Increment notification count for feedback tracking';
COMMENT ON FUNCTION record_notification_preference_feedback IS 'Record feedback and update user preferences';
COMMENT ON FUNCTION get_users_due_for_feedback IS 'Get list of users who are due for feedback requests';
