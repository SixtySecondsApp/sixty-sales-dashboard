-- Smart Engagement Algorithm - Phase 4: Re-engagement
-- Implements user segmentation, re-engagement triggers, and content-driven notifications

-- ============================================================================
-- Add columns to user_engagement_metrics for re-engagement tracking
-- ============================================================================
ALTER TABLE user_engagement_metrics
ADD COLUMN IF NOT EXISTS reengagement_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_reengagement_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_reengagement_type TEXT,
ADD COLUMN IF NOT EXISTS reengagement_cooldown_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS previous_segment TEXT,
ADD COLUMN IF NOT EXISTS segment_changed_at TIMESTAMPTZ;

-- ============================================================================
-- Create re-engagement log table
-- ============================================================================
CREATE TABLE IF NOT EXISTS reengagement_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  org_id UUID NOT NULL REFERENCES organizations(id),

  -- Re-engagement details
  segment_at_send TEXT NOT NULL,
  reengagement_type TEXT NOT NULL,
  channel TEXT NOT NULL,  -- slack_dm, email

  -- Content context
  trigger_type TEXT,  -- upcoming_meeting, deal_update, champion_alert, etc.
  trigger_entity_type TEXT,
  trigger_entity_id UUID,
  trigger_context JSONB,

  -- Delivery
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered BOOLEAN DEFAULT FALSE,
  delivered_at TIMESTAMPTZ,

  -- Response tracking
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  action_taken TEXT,
  returned_to_app BOOLEAN DEFAULT FALSE,
  returned_at TIMESTAMPTZ,

  -- Outcome
  outcome TEXT,  -- success, ignored, unsubscribed
  new_segment_after TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reengagement_log_user ON reengagement_log(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_reengagement_log_org ON reengagement_log(org_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_reengagement_log_segment ON reengagement_log(segment_at_send, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_reengagement_log_type ON reengagement_log(reengagement_type, sent_at DESC);

-- ============================================================================
-- Function: Get users eligible for re-engagement
-- ============================================================================
CREATE OR REPLACE FUNCTION get_reengagement_candidates(
  p_org_id UUID DEFAULT NULL,
  p_segment TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  user_id UUID,
  org_id UUID,
  slack_user_id TEXT,
  email TEXT,
  full_name TEXT,
  segment TEXT,
  days_inactive INTEGER,
  overall_engagement_score INTEGER,
  reengagement_attempts INTEGER,
  last_reengagement_at TIMESTAMPTZ,
  last_reengagement_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    uem.user_id,
    uem.org_id,
    p.slack_user_id,
    p.email,
    p.full_name,
    uem.user_segment AS segment,
    EXTRACT(DAY FROM NOW() - GREATEST(
      uem.last_app_active_at,
      uem.last_slack_active_at,
      uem.last_login_at
    ))::INTEGER AS days_inactive,
    uem.overall_engagement_score,
    COALESCE(uem.reengagement_attempts, 0) AS reengagement_attempts,
    uem.last_reengagement_at,
    uem.last_reengagement_type
  FROM user_engagement_metrics uem
  JOIN profiles p ON p.id = uem.user_id
  WHERE
    -- Filter by org if specified
    (p_org_id IS NULL OR uem.org_id = p_org_id)
    -- Filter by segment if specified, otherwise get at_risk, dormant, churned
    AND (
      (p_segment IS NOT NULL AND uem.user_segment = p_segment)
      OR (p_segment IS NULL AND uem.user_segment IN ('at_risk', 'dormant', 'churned'))
    )
    -- Must have email or Slack
    AND (p.email IS NOT NULL OR p.slack_user_id IS NOT NULL)
    -- Not in cooldown
    AND (uem.reengagement_cooldown_until IS NULL OR uem.reengagement_cooldown_until < NOW())
    -- Check max attempts based on segment
    AND (
      (uem.user_segment = 'at_risk' AND COALESCE(uem.reengagement_attempts, 0) < 3)
      OR (uem.user_segment = 'dormant' AND COALESCE(uem.reengagement_attempts, 0) < 4)
      OR (uem.user_segment = 'churned' AND COALESCE(uem.reengagement_attempts, 0) < 2)
    )
    -- Days inactive thresholds
    AND (
      (uem.user_segment = 'at_risk' AND EXTRACT(DAY FROM NOW() - GREATEST(
        uem.last_app_active_at, uem.last_slack_active_at, uem.last_login_at
      )) >= 5)
      OR (uem.user_segment = 'dormant' AND EXTRACT(DAY FROM NOW() - GREATEST(
        uem.last_app_active_at, uem.last_slack_active_at, uem.last_login_at
      )) >= 3)
      OR (uem.user_segment = 'churned' AND EXTRACT(DAY FROM NOW() - GREATEST(
        uem.last_app_active_at, uem.last_slack_active_at, uem.last_login_at
      )) >= 14)
    )
  ORDER BY
    -- Prioritize by segment (at_risk first, then dormant, then churned)
    CASE uem.user_segment
      WHEN 'at_risk' THEN 1
      WHEN 'dormant' THEN 2
      WHEN 'churned' THEN 3
      ELSE 4
    END,
    -- Then by engagement score (higher = more likely to return)
    uem.overall_engagement_score DESC,
    -- Then by fewer attempts
    COALESCE(uem.reengagement_attempts, 0) ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Record re-engagement attempt
-- ============================================================================
CREATE OR REPLACE FUNCTION record_reengagement_attempt(
  p_user_id UUID,
  p_org_id UUID,
  p_reengagement_type TEXT,
  p_channel TEXT,
  p_trigger_type TEXT DEFAULT NULL,
  p_trigger_entity_type TEXT DEFAULT NULL,
  p_trigger_entity_id UUID DEFAULT NULL,
  p_trigger_context JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_segment TEXT;
  v_cooldown_days INTEGER;
BEGIN
  -- Get current segment
  SELECT user_segment INTO v_segment
  FROM user_engagement_metrics
  WHERE user_id = p_user_id;

  -- Calculate cooldown based on segment
  v_cooldown_days := CASE v_segment
    WHEN 'at_risk' THEN 7
    WHEN 'dormant' THEN 5
    WHEN 'churned' THEN 14
    ELSE 7
  END;

  -- Insert log entry
  INSERT INTO reengagement_log (
    user_id, org_id, segment_at_send, reengagement_type, channel,
    trigger_type, trigger_entity_type, trigger_entity_id, trigger_context
  ) VALUES (
    p_user_id, p_org_id, v_segment, p_reengagement_type, p_channel,
    p_trigger_type, p_trigger_entity_type, p_trigger_entity_id, p_trigger_context
  )
  RETURNING id INTO v_log_id;

  -- Update user metrics
  UPDATE user_engagement_metrics
  SET
    reengagement_attempts = COALESCE(reengagement_attempts, 0) + 1,
    last_reengagement_at = NOW(),
    last_reengagement_type = p_reengagement_type,
    reengagement_cooldown_until = NOW() + (v_cooldown_days || ' days')::INTERVAL,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Record re-engagement response
-- ============================================================================
CREATE OR REPLACE FUNCTION record_reengagement_response(
  p_log_id UUID,
  p_action TEXT,  -- opened, clicked, returned, unsubscribed
  p_action_detail TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE reengagement_log
  SET
    opened_at = CASE WHEN p_action = 'opened' AND opened_at IS NULL THEN NOW() ELSE opened_at END,
    clicked_at = CASE WHEN p_action = 'clicked' AND clicked_at IS NULL THEN NOW() ELSE clicked_at END,
    returned_to_app = CASE WHEN p_action = 'returned' THEN TRUE ELSE returned_to_app END,
    returned_at = CASE WHEN p_action = 'returned' AND returned_at IS NULL THEN NOW() ELSE returned_at END,
    action_taken = COALESCE(action_taken, p_action_detail),
    outcome = CASE
      WHEN p_action = 'returned' THEN 'success'
      WHEN p_action = 'unsubscribed' THEN 'unsubscribed'
      ELSE outcome
    END
  WHERE id = p_log_id;

  -- If user returned, reset their re-engagement attempts
  IF p_action = 'returned' THEN
    UPDATE user_engagement_metrics uem
    SET
      reengagement_attempts = 0,
      reengagement_cooldown_until = NULL,
      updated_at = NOW()
    FROM reengagement_log rl
    WHERE rl.id = p_log_id
      AND uem.user_id = rl.user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Get content triggers for a user
-- ============================================================================
CREATE OR REPLACE FUNCTION get_content_triggers_for_user(
  p_user_id UUID
)
RETURNS TABLE (
  trigger_type TEXT,
  entity_type TEXT,
  entity_id UUID,
  context JSONB,
  priority INTEGER
) AS $$
BEGIN
  -- Upcoming meetings (next 7 days)
  RETURN QUERY
  SELECT
    'upcoming_meeting'::TEXT AS trigger_type,
    'meeting'::TEXT AS entity_type,
    m.id AS entity_id,
    jsonb_build_object(
      'title', m.title,
      'company', c.name,
      'date', m.scheduled_at,
      'prep_ready', EXISTS(SELECT 1 FROM meeting_ai_analysis WHERE meeting_id = m.id)
    ) AS context,
    90 AS priority
  FROM meetings m
  LEFT JOIN contacts c ON c.id = ANY(m.contact_ids)
  WHERE m.owner_user_id = p_user_id
    AND m.scheduled_at > NOW()
    AND m.scheduled_at < NOW() + INTERVAL '7 days'
  ORDER BY m.scheduled_at
  LIMIT 3;

  -- Deal updates (stage changes in last 7 days)
  RETURN QUERY
  SELECT
    'deal_update'::TEXT AS trigger_type,
    'deal'::TEXT AS entity_type,
    d.id AS entity_id,
    jsonb_build_object(
      'deal_name', d.name,
      'company', c.name,
      'update_type', 'Stage Change',
      'detail', 'Deal moved to ' || d.stage
    ) AS context,
    80 AS priority
  FROM deals d
  LEFT JOIN contacts c ON c.id = d.primary_contact_id
  WHERE d.user_id = p_user_id
    AND d.updated_at > NOW() - INTERVAL '7 days'
    AND d.stage IS NOT NULL
  ORDER BY d.updated_at DESC
  LIMIT 3;

  -- New emails from key contacts (last 3 days)
  RETURN QUERY
  SELECT
    'new_email'::TEXT AS trigger_type,
    'activity'::TEXT AS entity_type,
    a.id AS entity_id,
    jsonb_build_object(
      'from', c.email,
      'from_name', c.full_name,
      'subject', a.description,
      'is_important', (c.contact_type = 'champion' OR c.contact_type = 'decision_maker')
    ) AS context,
    70 AS priority
  FROM activities a
  JOIN contacts c ON c.id = a.contact_id
  WHERE a.user_id = p_user_id
    AND a.activity_type = 'email_received'
    AND a.activity_date > NOW() - INTERVAL '3 days'
  ORDER BY a.activity_date DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Get re-engagement stats for dashboard
-- ============================================================================
CREATE OR REPLACE FUNCTION get_reengagement_stats(
  p_org_id UUID DEFAULT NULL,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  segment TEXT,
  total_candidates INTEGER,
  sent_count INTEGER,
  opened_count INTEGER,
  returned_count INTEGER,
  success_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT
      uem.user_segment AS segment,
      COUNT(DISTINCT uem.user_id) AS total
    FROM user_engagement_metrics uem
    WHERE (p_org_id IS NULL OR uem.org_id = p_org_id)
      AND uem.user_segment IN ('at_risk', 'dormant', 'churned')
    GROUP BY uem.user_segment
  ),
  sent AS (
    SELECT
      rl.segment_at_send AS segment,
      COUNT(*) AS sent_count,
      COUNT(*) FILTER (WHERE rl.opened_at IS NOT NULL) AS opened_count,
      COUNT(*) FILTER (WHERE rl.returned_to_app = TRUE) AS returned_count
    FROM reengagement_log rl
    WHERE (p_org_id IS NULL OR rl.org_id = p_org_id)
      AND rl.sent_at > NOW() - (p_days || ' days')::INTERVAL
    GROUP BY rl.segment_at_send
  )
  SELECT
    c.segment,
    c.total::INTEGER AS total_candidates,
    COALESCE(s.sent_count, 0)::INTEGER AS sent_count,
    COALESCE(s.opened_count, 0)::INTEGER AS opened_count,
    COALESCE(s.returned_count, 0)::INTEGER AS returned_count,
    CASE
      WHEN COALESCE(s.sent_count, 0) > 0
      THEN ROUND((COALESCE(s.returned_count, 0)::NUMERIC / s.sent_count) * 100, 1)
      ELSE 0
    END AS success_rate
  FROM candidates c
  LEFT JOIN sent s ON s.segment = c.segment
  ORDER BY
    CASE c.segment
      WHEN 'at_risk' THEN 1
      WHEN 'dormant' THEN 2
      WHEN 'churned' THEN 3
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Update segment on activity
-- ============================================================================
CREATE OR REPLACE FUNCTION on_user_activity_update_segment()
RETURNS TRIGGER AS $$
DECLARE
  v_current_segment TEXT;
BEGIN
  -- Get current segment
  SELECT user_segment INTO v_current_segment
  FROM user_engagement_metrics
  WHERE user_id = NEW.user_id;

  -- If user was at_risk, dormant, or churned and now has activity, reset
  IF v_current_segment IN ('at_risk', 'dormant', 'churned') THEN
    UPDATE user_engagement_metrics
    SET
      previous_segment = v_current_segment,
      segment_changed_at = NOW(),
      reengagement_attempts = 0,
      reengagement_cooldown_until = NULL,
      last_app_active_at = CASE WHEN NEW.event_source = 'app' THEN NOW() ELSE last_app_active_at END,
      last_slack_active_at = CASE WHEN NEW.event_source = 'slack' THEN NOW() ELSE last_slack_active_at END,
      updated_at = NOW()
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for segment update on activity
DROP TRIGGER IF EXISTS trigger_update_segment_on_activity ON user_activity_events;
CREATE TRIGGER trigger_update_segment_on_activity
  AFTER INSERT ON user_activity_events
  FOR EACH ROW
  EXECUTE FUNCTION on_user_activity_update_segment();

-- ============================================================================
-- Grant permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_reengagement_candidates(UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION record_reengagement_attempt(UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION record_reengagement_response(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_content_triggers_for_user(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_reengagement_stats(UUID, INTEGER) TO service_role;
GRANT ALL ON TABLE reengagement_log TO service_role;

-- ============================================================================
-- Schedule cron job for re-engagement processing
-- ============================================================================

-- Process re-engagement every 4 hours
SELECT cron.schedule(
  'process-reengagement',
  '0 */4 * * *',  -- Every 4 hours
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/process-reengagement',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  )
  $$
);

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE reengagement_log IS 'Log of all re-engagement attempts and their outcomes';
COMMENT ON FUNCTION get_reengagement_candidates IS 'Get users eligible for re-engagement based on segment and cooldown';
COMMENT ON FUNCTION record_reengagement_attempt IS 'Record a re-engagement attempt and set cooldown';
COMMENT ON FUNCTION record_reengagement_response IS 'Record user response to re-engagement (open, click, return)';
COMMENT ON FUNCTION get_content_triggers_for_user IS 'Get content-driven triggers for personalized re-engagement';
COMMENT ON FUNCTION get_reengagement_stats IS 'Get re-engagement statistics for dashboard';
