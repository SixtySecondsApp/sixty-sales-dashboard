-- =====================================================
-- Deal Health Monitoring & Risk Alerts System
-- =====================================================
-- This migration creates tables and functions for AI-powered
-- proactive deal health monitoring with multi-signal analysis

-- =====================================================
-- 1. Deal Health Scores Table
-- =====================================================
-- Stores calculated health metrics for each deal
CREATE TABLE IF NOT EXISTS deal_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Overall health metrics (0-100 scale)
  overall_health_score INTEGER CHECK (overall_health_score >= 0 AND overall_health_score <= 100),
  health_status TEXT CHECK (health_status IN ('healthy', 'warning', 'critical', 'stalled')) DEFAULT 'healthy',

  -- Individual signal scores (0-100 scale each)
  stage_velocity_score INTEGER CHECK (stage_velocity_score >= 0 AND stage_velocity_score <= 100),
  sentiment_score INTEGER CHECK (sentiment_score >= 0 AND sentiment_score <= 100),
  engagement_score INTEGER CHECK (engagement_score >= 0 AND engagement_score <= 100),
  activity_score INTEGER CHECK (activity_score >= 0 AND activity_score <= 100),
  response_time_score INTEGER CHECK (response_time_score >= 0 AND response_time_score <= 100),

  -- Raw metrics
  days_in_current_stage INTEGER DEFAULT 0,
  days_since_last_meeting INTEGER,
  days_since_last_activity INTEGER,
  avg_sentiment_last_3_meetings NUMERIC,
  sentiment_trend TEXT CHECK (sentiment_trend IN ('improving', 'stable', 'declining', 'unknown')),
  meeting_count_last_30_days INTEGER DEFAULT 0,
  activity_count_last_30_days INTEGER DEFAULT 0,
  avg_response_time_hours NUMERIC,

  -- Risk indicators
  risk_factors TEXT[], -- Array of identified risk factors
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')) DEFAULT 'low',

  -- Predictions
  predicted_close_probability INTEGER CHECK (predicted_close_probability >= 0 AND predicted_close_probability <= 100),
  predicted_days_to_close INTEGER,

  -- Metadata
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one health score per deal
  UNIQUE(deal_id)
);

-- =====================================================
-- 2. Deal Health Alerts Table
-- =====================================================
-- Stores generated alerts for deals at risk
CREATE TABLE IF NOT EXISTS deal_health_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  health_score_id UUID REFERENCES deal_health_scores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Alert details
  alert_type TEXT CHECK (alert_type IN (
    'stage_stall',
    'sentiment_drop',
    'engagement_decline',
    'no_activity',
    'missed_follow_up',
    'close_date_approaching',
    'high_risk'
  )) NOT NULL,
  severity TEXT CHECK (severity IN ('info', 'warning', 'critical')) DEFAULT 'warning',
  title TEXT NOT NULL,
  message TEXT NOT NULL,

  -- Suggested actions
  suggested_actions TEXT[],
  action_priority TEXT CHECK (action_priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',

  -- Alert state
  status TEXT CHECK (status IN ('active', 'acknowledged', 'resolved', 'dismissed')) DEFAULT 'active',
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,

  -- Notification tracking
  notification_id UUID,
  notification_sent BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB, -- Additional context data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Index for querying active alerts
  CONSTRAINT active_alert_check CHECK (
    (status = 'active') OR
    (status = 'acknowledged' AND acknowledged_at IS NOT NULL) OR
    (status = 'resolved' AND resolved_at IS NOT NULL) OR
    (status = 'dismissed' AND dismissed_at IS NOT NULL)
  )
);

-- =====================================================
-- 3. Deal Health Rules Table (Admin Configuration)
-- =====================================================
-- Configurable thresholds for health monitoring
CREATE TABLE IF NOT EXISTS deal_health_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Rule identification
  rule_name TEXT NOT NULL UNIQUE,
  rule_type TEXT CHECK (rule_type IN (
    'stage_velocity',
    'sentiment',
    'engagement',
    'activity',
    'response_time'
  )) NOT NULL,
  description TEXT,

  -- Threshold configuration
  threshold_value NUMERIC NOT NULL,
  threshold_operator TEXT CHECK (threshold_operator IN ('>', '<', '>=', '<=', '=')) DEFAULT '>',
  threshold_unit TEXT, -- e.g., 'days', 'hours', 'percentage', 'count'

  -- Alert configuration
  alert_severity TEXT CHECK (alert_severity IN ('info', 'warning', 'critical')) DEFAULT 'warning',
  alert_message_template TEXT,
  suggested_action_template TEXT,

  -- Rule conditions (JSONB for flexibility)
  conditions JSONB, -- e.g., {"stage": "Opportunity", "deal_value_min": 10000}

  -- Rule status
  is_active BOOLEAN DEFAULT true,
  is_system_rule BOOLEAN DEFAULT false, -- System rules can't be deleted

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. Deal Health History Table (for trending)
-- =====================================================
-- Tracks historical health scores for trend analysis
CREATE TABLE IF NOT EXISTS deal_health_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,

  -- Snapshot of health metrics
  overall_health_score INTEGER,
  stage_velocity_score INTEGER,
  sentiment_score INTEGER,
  engagement_score INTEGER,
  activity_score INTEGER,

  -- Snapshot timestamp
  snapshot_at TIMESTAMPTZ DEFAULT NOW(),

  -- Index for time-series queries
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
-- Deal Health Scores
CREATE INDEX idx_deal_health_scores_deal ON deal_health_scores(deal_id);
CREATE INDEX idx_deal_health_scores_user ON deal_health_scores(user_id);
CREATE INDEX idx_deal_health_scores_status ON deal_health_scores(health_status);
CREATE INDEX idx_deal_health_scores_risk ON deal_health_scores(risk_level);
CREATE INDEX idx_deal_health_scores_updated ON deal_health_scores(updated_at DESC);

-- Deal Health Alerts
CREATE INDEX idx_deal_health_alerts_deal ON deal_health_alerts(deal_id);
CREATE INDEX idx_deal_health_alerts_user ON deal_health_alerts(user_id);
CREATE INDEX idx_deal_health_alerts_status ON deal_health_alerts(status);
CREATE INDEX idx_deal_health_alerts_severity ON deal_health_alerts(severity);
CREATE INDEX idx_deal_health_alerts_type ON deal_health_alerts(alert_type);
CREATE INDEX idx_deal_health_alerts_created ON deal_health_alerts(created_at DESC);

-- Deal Health Rules
CREATE INDEX idx_deal_health_rules_type ON deal_health_rules(rule_type);
CREATE INDEX idx_deal_health_rules_active ON deal_health_rules(is_active);

-- Deal Health History
CREATE INDEX idx_deal_health_history_deal ON deal_health_history(deal_id);
CREATE INDEX idx_deal_health_history_snapshot ON deal_health_history(snapshot_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE deal_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_health_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_health_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_health_history ENABLE ROW LEVEL SECURITY;

-- Deal Health Scores Policies
CREATE POLICY "Users can view their own deal health scores" ON deal_health_scores
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own deal health scores" ON deal_health_scores
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own deal health scores" ON deal_health_scores
  FOR UPDATE USING (auth.uid() = user_id);

-- Deal Health Alerts Policies
CREATE POLICY "Users can view their own deal alerts" ON deal_health_alerts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own deal alerts" ON deal_health_alerts
  FOR UPDATE USING (auth.uid() = user_id);

-- Deal Health Rules Policies (Admin-only for modifications)
CREATE POLICY "Everyone can view active rules" ON deal_health_rules
  FOR SELECT USING (is_active = true);

CREATE POLICY "Only admins can manage rules" ON deal_health_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Deal Health History Policies
CREATE POLICY "Users can view health history for their deals" ON deal_health_history
  FOR SELECT USING (
    deal_id IN (
      SELECT id FROM deals WHERE owner_id = auth.uid()
    )
  );

-- =====================================================
-- DEFAULT HEALTH MONITORING RULES
-- =====================================================
-- Insert system default rules
INSERT INTO deal_health_rules (
  rule_name,
  rule_type,
  description,
  threshold_value,
  threshold_operator,
  threshold_unit,
  alert_severity,
  alert_message_template,
  suggested_action_template,
  is_system_rule
) VALUES
  (
    'Stage Stall Warning (14 days)',
    'stage_velocity',
    'Alert when deal has been in current stage for 14+ days without progression',
    14,
    '>=',
    'days',
    'warning',
    'Deal "{{deal_name}}" has been in {{stage}} stage for {{days_in_stage}} days without progression.',
    'Review deal status and schedule follow-up meeting to advance the conversation.',
    true
  ),
  (
    'Stage Stall Critical (30 days)',
    'stage_velocity',
    'Critical alert when deal has been stalled for 30+ days',
    30,
    '>=',
    'days',
    'critical',
    'CRITICAL: Deal "{{deal_name}}" has been stalled in {{stage}} for {{days_in_stage}} days.',
    'Immediate action required: Contact stakeholder, reassess deal viability, or mark as lost.',
    true
  ),
  (
    'Sentiment Drop Alert',
    'sentiment',
    'Alert when call sentiment drops by 20% or more across recent meetings',
    20,
    '>=',
    'percentage_drop',
    'warning',
    'Deal "{{deal_name}}" sentiment dropped {{sentiment_change}}% in recent meetings (now {{current_sentiment}}).',
    'Review recent meeting recordings, identify concerns, and schedule alignment call.',
    true
  ),
  (
    'No Recent Activity (7 days)',
    'activity',
    'Alert when no activities logged for 7+ days',
    7,
    '>=',
    'days',
    'warning',
    'Deal "{{deal_name}}" has had no activity for {{days_inactive}} days.',
    'Log outbound activity or schedule next touchpoint to maintain momentum.',
    true
  ),
  (
    'No Recent Activity Critical (14 days)',
    'activity',
    'Critical alert when no activities for 14+ days',
    14,
    '>=',
    'days',
    'critical',
    'CRITICAL: Deal "{{deal_name}}" has been inactive for {{days_inactive}} days.',
    'Contact immediately to re-engage or consider moving to lost/nurture.',
    true
  ),
  (
    'Low Meeting Frequency',
    'engagement',
    'Alert when fewer than 1 meeting in last 30 days for active deals',
    1,
    '<',
    'meetings_per_month',
    'warning',
    'Deal "{{deal_name}}" has low meeting frequency ({{meeting_count}} meetings in 30 days).',
    'Schedule demo, discovery call, or stakeholder meeting to increase engagement.',
    true
  ),
  (
    'Slow Response Time',
    'response_time',
    'Alert when average response time exceeds 48 hours',
    48,
    '>',
    'hours',
    'info',
    'Deal "{{deal_name}}" has slow average response time ({{avg_response_hours}} hours).',
    'Follow up promptly on communications and check in on decision timeline.',
    true
  ),
  (
    'Close Date Approaching',
    'stage_velocity',
    'Alert when expected close date is within 7 days but deal not in final stage',
    7,
    '<=',
    'days_until_close',
    'warning',
    'Deal "{{deal_name}}" close date is {{days_until_close}} days away but still in {{stage}} stage.',
    'Verify close date is realistic or update timeline. Accelerate deal progression.',
    true
  );

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON TABLE deal_health_scores IS 'Stores calculated health metrics for deals using multi-signal analysis';
COMMENT ON TABLE deal_health_alerts IS 'Active and historical alerts for at-risk deals';
COMMENT ON TABLE deal_health_rules IS 'Configurable thresholds and rules for health monitoring (admin-managed)';
COMMENT ON TABLE deal_health_history IS 'Historical snapshots of deal health scores for trend analysis';

COMMENT ON COLUMN deal_health_scores.overall_health_score IS 'Composite health score (0-100) based on all signals';
COMMENT ON COLUMN deal_health_scores.risk_factors IS 'Array of identified risk factors (e.g., ["sentiment_declining", "no_meetings"])';
COMMENT ON COLUMN deal_health_scores.sentiment_trend IS 'Trend direction based on last 3-5 meetings';

COMMENT ON COLUMN deal_health_alerts.suggested_actions IS 'AI-generated action recommendations for the rep';
COMMENT ON COLUMN deal_health_alerts.metadata IS 'Additional context like previous values, changes, specific meeting data';

COMMENT ON COLUMN deal_health_rules.conditions IS 'JSONB conditions for when rule applies (e.g., stage, deal value, etc.)';
COMMENT ON COLUMN deal_health_rules.is_system_rule IS 'System rules cannot be deleted, only deactivated';
