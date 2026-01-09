-- Smart Engagement Algorithm - Phase 1: User Engagement Tables
-- Tracks user activity patterns, notification interactions, and feedback
-- to optimize notification timing and frequency

-- ============================================================================
-- Table 1: user_engagement_metrics
-- Core user activity tracking with computed engagement scores
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_engagement_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Activity timestamps
  last_app_active_at TIMESTAMPTZ,
  last_slack_active_at TIMESTAMPTZ,
  last_notification_clicked_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,

  -- Activity patterns (computed daily)
  typical_active_hours JSONB DEFAULT '{}',  -- {0: [9,10,11,14,15], 1: [...]} (day_of_week: hours)
  peak_activity_hour INTEGER,               -- Most active hour (0-23)
  avg_daily_sessions NUMERIC(5,2) DEFAULT 0,
  avg_session_duration_minutes INTEGER DEFAULT 0,

  -- Engagement scores (0-100, computed daily)
  app_engagement_score INTEGER DEFAULT 50 CHECK (app_engagement_score >= 0 AND app_engagement_score <= 100),
  slack_engagement_score INTEGER DEFAULT 50 CHECK (slack_engagement_score >= 0 AND slack_engagement_score <= 100),
  notification_engagement_score INTEGER DEFAULT 50 CHECK (notification_engagement_score >= 0 AND notification_engagement_score <= 100),
  overall_engagement_score INTEGER DEFAULT 50 CHECK (overall_engagement_score >= 0 AND overall_engagement_score <= 100),

  -- User segment (computed)
  user_segment TEXT DEFAULT 'regular' CHECK (user_segment IN ('power_user', 'regular', 'casual', 'at_risk', 'dormant', 'churned')),

  -- Notification preferences (learned from behavior + explicit feedback)
  preferred_notification_frequency TEXT DEFAULT 'moderate' CHECK (preferred_notification_frequency IN ('low', 'moderate', 'high')),
  notification_fatigue_level INTEGER DEFAULT 0 CHECK (notification_fatigue_level >= 0 AND notification_fatigue_level <= 100),
  last_feedback_requested_at TIMESTAMPTZ,
  notifications_since_last_feedback INTEGER DEFAULT 0,

  -- Timezone (inferred from activity patterns)
  inferred_timezone TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS user_engagement_metrics_user_id_idx ON user_engagement_metrics(user_id);
CREATE INDEX IF NOT EXISTS user_engagement_metrics_org_engagement_idx ON user_engagement_metrics(org_id, overall_engagement_score);
CREATE INDEX IF NOT EXISTS user_engagement_metrics_segment_idx ON user_engagement_metrics(user_segment);

-- Enable RLS
ALTER TABLE user_engagement_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own engagement metrics"
  ON user_engagement_metrics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all engagement metrics"
  ON user_engagement_metrics FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- Table 2: user_activity_events
-- Raw activity event log for tracking user behavior
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Event details
  event_type TEXT NOT NULL,  -- app_pageview, app_action, slack_button_click, notification_clicked, login, logout
  event_source TEXT NOT NULL CHECK (event_source IN ('app', 'slack', 'email')),
  event_category TEXT,       -- deals, meetings, tasks, contacts, settings, notifications

  -- Context
  entity_type TEXT,          -- deal, contact, meeting, task
  entity_id UUID,
  action_detail TEXT,        -- specific action taken (e.g., 'viewed_deal', 'created_task')

  -- Timing
  event_at TIMESTAMPTZ DEFAULT NOW(),
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  hour_of_day INTEGER CHECK (hour_of_day >= 0 AND hour_of_day <= 23),

  -- Session tracking
  session_id UUID,

  -- Additional metadata
  metadata JSONB DEFAULT '{}'
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS user_activity_events_user_time_idx ON user_activity_events(user_id, event_at DESC);
CREATE INDEX IF NOT EXISTS user_activity_events_type_time_idx ON user_activity_events(event_type, event_at DESC);
CREATE INDEX IF NOT EXISTS user_activity_events_org_time_idx ON user_activity_events(org_id, event_at DESC);
CREATE INDEX IF NOT EXISTS user_activity_events_session_idx ON user_activity_events(session_id);

-- Enable RLS
ALTER TABLE user_activity_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own activity events"
  ON user_activity_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity events"
  ON user_activity_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all activity events"
  ON user_activity_events FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- Table 3: notification_interactions
-- Track how users interact with notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Notification reference
  notification_id UUID,                    -- Reference to in-app notification if applicable
  slack_notification_sent_id UUID REFERENCES slack_notifications_sent(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL,         -- morning_brief, sales_assistant_digest, deal_alert, etc.

  -- Delivery details
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_via TEXT NOT NULL CHECK (delivered_via IN ('slack_dm', 'slack_channel', 'in_app', 'email')),

  -- Interaction tracking
  seen_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  action_taken TEXT,                       -- Which button/action was clicked

  -- Response time metrics
  time_to_interaction_seconds INTEGER,     -- Time from delivery to first interaction

  -- Inline feedback (optional, per-notification)
  feedback_rating TEXT CHECK (feedback_rating IN ('helpful', 'not_helpful', 'too_frequent')),
  feedback_at TIMESTAMPTZ,

  -- Context at delivery time
  user_was_active BOOLEAN DEFAULT false,   -- Was user active when notification was sent?
  hour_of_day INTEGER CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS notification_interactions_user_time_idx ON notification_interactions(user_id, delivered_at DESC);
CREATE INDEX IF NOT EXISTS notification_interactions_type_time_idx ON notification_interactions(notification_type, delivered_at DESC);
CREATE INDEX IF NOT EXISTS notification_interactions_slack_ref_idx ON notification_interactions(slack_notification_sent_id);

-- Enable RLS
ALTER TABLE notification_interactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notification interactions"
  ON notification_interactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all notification interactions"
  ON notification_interactions FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- Table 4: notification_feedback
-- Explicit user feedback on notification preferences
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Feedback details
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('frequency_preference', 'notification_rating', 'content_feedback')),
  feedback_value TEXT NOT NULL,            -- more, less, just_right, helpful, not_helpful
  feedback_source TEXT NOT NULL CHECK (feedback_source IN ('slack_button', 'settings_page', 'in_app', 'survey')),

  -- Context
  notification_type TEXT,                  -- Which notification type prompted the feedback (if applicable)
  triggered_by_notification_id UUID,       -- Specific notification that prompted feedback

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS notification_feedback_user_time_idx ON notification_feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notification_feedback_type_idx ON notification_feedback(feedback_type, created_at DESC);

-- Enable RLS
ALTER TABLE notification_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notification feedback"
  ON notification_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification feedback"
  ON notification_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all notification feedback"
  ON notification_feedback FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- Trigger: Auto-update updated_at for user_engagement_metrics
-- ============================================================================
CREATE OR REPLACE FUNCTION update_user_engagement_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_engagement_metrics_updated_at
  BEFORE UPDATE ON user_engagement_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_user_engagement_metrics_updated_at();

-- ============================================================================
-- Function: Initialize engagement metrics for a user
-- Called when a user first triggers activity tracking
-- ============================================================================
CREATE OR REPLACE FUNCTION initialize_user_engagement_metrics(
  p_user_id UUID,
  p_org_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_metrics_id UUID;
BEGIN
  INSERT INTO user_engagement_metrics (user_id, org_id)
  VALUES (p_user_id, p_org_id)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO v_metrics_id;

  -- If insert was skipped due to conflict, get existing id
  IF v_metrics_id IS NULL THEN
    SELECT id INTO v_metrics_id FROM user_engagement_metrics WHERE user_id = p_user_id;
  END IF;

  RETURN v_metrics_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Log activity event with auto-computed timing fields
-- ============================================================================
CREATE OR REPLACE FUNCTION log_user_activity_event(
  p_user_id UUID,
  p_org_id UUID,
  p_event_type TEXT,
  p_event_source TEXT,
  p_event_category TEXT DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_action_detail TEXT DEFAULT NULL,
  p_session_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  INSERT INTO user_activity_events (
    user_id, org_id, event_type, event_source, event_category,
    entity_type, entity_id, action_detail, session_id, metadata,
    event_at, day_of_week, hour_of_day
  )
  VALUES (
    p_user_id, p_org_id, p_event_type, p_event_source, p_event_category,
    p_entity_type, p_entity_id, p_action_detail, p_session_id, p_metadata,
    v_now,
    EXTRACT(DOW FROM v_now)::INTEGER,
    EXTRACT(HOUR FROM v_now)::INTEGER
  )
  RETURNING id INTO v_event_id;

  -- Update last activity timestamp in engagement metrics
  UPDATE user_engagement_metrics
  SET
    last_app_active_at = CASE WHEN p_event_source = 'app' THEN v_now ELSE last_app_active_at END,
    last_slack_active_at = CASE WHEN p_event_source = 'slack' THEN v_now ELSE last_slack_active_at END,
    last_login_at = CASE WHEN p_event_type = 'login' THEN v_now ELSE last_login_at END
  WHERE user_id = p_user_id;

  -- Initialize metrics if they don't exist yet
  IF NOT FOUND THEN
    PERFORM initialize_user_engagement_metrics(p_user_id, p_org_id);

    UPDATE user_engagement_metrics
    SET
      last_app_active_at = CASE WHEN p_event_source = 'app' THEN v_now ELSE NULL END,
      last_slack_active_at = CASE WHEN p_event_source = 'slack' THEN v_now ELSE NULL END,
      last_login_at = CASE WHEN p_event_type = 'login' THEN v_now ELSE NULL END
    WHERE user_id = p_user_id;
  END IF;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Record notification interaction
-- ============================================================================
CREATE OR REPLACE FUNCTION record_notification_interaction(
  p_user_id UUID,
  p_org_id UUID,
  p_notification_type TEXT,
  p_delivered_via TEXT,
  p_slack_notification_sent_id UUID DEFAULT NULL,
  p_notification_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_interaction_id UUID;
  v_now TIMESTAMPTZ := NOW();
  v_user_active BOOLEAN;
BEGIN
  -- Check if user was recently active (within last 5 minutes)
  SELECT EXISTS (
    SELECT 1 FROM user_activity_events
    WHERE user_id = p_user_id
      AND event_at > v_now - INTERVAL '5 minutes'
  ) INTO v_user_active;

  INSERT INTO notification_interactions (
    user_id, org_id, notification_type, delivered_via,
    slack_notification_sent_id, notification_id,
    delivered_at, user_was_active, hour_of_day, day_of_week
  )
  VALUES (
    p_user_id, p_org_id, p_notification_type, p_delivered_via,
    p_slack_notification_sent_id, p_notification_id,
    v_now, v_user_active,
    EXTRACT(HOUR FROM v_now)::INTEGER,
    EXTRACT(DOW FROM v_now)::INTEGER
  )
  RETURNING id INTO v_interaction_id;

  -- Increment notification counter for feedback timing
  UPDATE user_engagement_metrics
  SET notifications_since_last_feedback = notifications_since_last_feedback + 1
  WHERE user_id = p_user_id;

  RETURN v_interaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Update notification interaction (when user clicks/dismisses)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_notification_interaction(
  p_interaction_id UUID,
  p_action TEXT,  -- 'clicked', 'dismissed', 'seen'
  p_action_taken TEXT DEFAULT NULL,
  p_feedback_rating TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_delivered_at TIMESTAMPTZ;
  v_user_id UUID;
BEGIN
  -- Get delivery time for calculating response time
  SELECT delivered_at, user_id INTO v_delivered_at, v_user_id
  FROM notification_interactions
  WHERE id = p_interaction_id;

  UPDATE notification_interactions
  SET
    seen_at = CASE WHEN p_action = 'seen' AND seen_at IS NULL THEN v_now ELSE seen_at END,
    clicked_at = CASE WHEN p_action = 'clicked' THEN v_now ELSE clicked_at END,
    dismissed_at = CASE WHEN p_action = 'dismissed' THEN v_now ELSE dismissed_at END,
    action_taken = COALESCE(p_action_taken, action_taken),
    time_to_interaction_seconds = CASE
      WHEN p_action IN ('clicked', 'dismissed') AND time_to_interaction_seconds IS NULL
      THEN EXTRACT(EPOCH FROM (v_now - v_delivered_at))::INTEGER
      ELSE time_to_interaction_seconds
    END,
    feedback_rating = COALESCE(p_feedback_rating, feedback_rating),
    feedback_at = CASE WHEN p_feedback_rating IS NOT NULL THEN v_now ELSE feedback_at END
  WHERE id = p_interaction_id;

  -- Update engagement metrics if notification was clicked
  IF p_action = 'clicked' THEN
    UPDATE user_engagement_metrics
    SET last_notification_clicked_at = v_now
    WHERE user_id = v_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Grant execute permissions on functions
-- ============================================================================
GRANT EXECUTE ON FUNCTION initialize_user_engagement_metrics(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION log_user_activity_event(UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION record_notification_interaction(UUID, UUID, TEXT, TEXT, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION update_notification_interaction(UUID, TEXT, TEXT, TEXT) TO service_role;

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE user_engagement_metrics IS 'Stores computed engagement scores and notification preferences for each user';
COMMENT ON TABLE user_activity_events IS 'Raw event log of user activity across app, Slack, and email';
COMMENT ON TABLE notification_interactions IS 'Tracks delivery and interaction with notifications';
COMMENT ON TABLE notification_feedback IS 'Explicit user feedback on notification frequency and helpfulness';

COMMENT ON FUNCTION initialize_user_engagement_metrics IS 'Creates or returns engagement metrics record for a user';
COMMENT ON FUNCTION log_user_activity_event IS 'Logs a user activity event with auto-computed timing fields';
COMMENT ON FUNCTION record_notification_interaction IS 'Records when a notification is delivered to a user';
COMMENT ON FUNCTION update_notification_interaction IS 'Updates interaction status when user clicks, dismisses, or provides feedback';
