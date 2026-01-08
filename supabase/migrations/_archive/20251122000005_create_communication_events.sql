-- =====================================================
-- Communication Events Table
-- =====================================================
-- Tracks all communication interactions for pattern analysis
-- Enables response time tracking, engagement analysis, and ghost detection

CREATE TABLE IF NOT EXISTS communication_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Target
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,

  -- Event details
  event_type TEXT NOT NULL CHECK (event_type IN (
    'email_sent',
    'email_received',
    'email_opened',
    'email_clicked',
    'meeting_scheduled',
    'meeting_held',
    'meeting_cancelled',
    'meeting_rescheduled',
    'call_made',
    'call_received',
    'linkedin_message',
    'linkedin_connection',
    'linkedin_inmail',
    'proposal_sent',
    'proposal_viewed',
    'document_shared',
    'document_viewed'
  )),

  -- Direction
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound', 'system')),

  -- Content
  subject TEXT,
  body TEXT,
  snippet TEXT, -- First 200 chars for quick reference

  -- Engagement
  was_opened BOOLEAN DEFAULT FALSE,
  was_clicked BOOLEAN DEFAULT FALSE,
  was_replied BOOLEAN DEFAULT FALSE,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,

  -- Timing
  response_time_hours NUMERIC, -- For inbound responses, time since our last outbound

  -- Sentiment (can be calculated via AI)
  sentiment_score NUMERIC CHECK (sentiment_score >= -1 AND sentiment_score <= 1), -- -1 to 1
  sentiment_label TEXT CHECK (sentiment_label IN ('very_negative', 'negative', 'neutral', 'positive', 'very_positive')),
  tone TEXT, -- 'formal', 'casual', 'enthusiastic', 'concerned', 'hedging'

  -- Thread context
  thread_id TEXT, -- Email thread ID
  is_thread_start BOOLEAN DEFAULT FALSE,
  thread_position INTEGER, -- Position in thread
  previous_event_id UUID REFERENCES communication_events(id) ON DELETE SET NULL,

  -- External IDs (for deduplication)
  external_id TEXT, -- Email message ID, LinkedIn message ID, etc.
  external_source TEXT, -- 'gmail', 'outlook', 'linkedin', 'fathom', 'calendly', etc.

  -- Metadata
  metadata JSONB,

  -- Timestamps
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Indexes
-- =====================================================

CREATE INDEX idx_communication_events_user ON communication_events(user_id);
CREATE INDEX idx_communication_events_contact ON communication_events(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_communication_events_company ON communication_events(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_communication_events_deal ON communication_events(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX idx_communication_events_type ON communication_events(event_type);
CREATE INDEX idx_communication_events_direction ON communication_events(direction);
CREATE INDEX idx_communication_events_timestamp ON communication_events(event_timestamp DESC);
CREATE INDEX idx_communication_events_thread ON communication_events(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX idx_communication_events_external ON communication_events(external_id, external_source) WHERE external_id IS NOT NULL;

-- Composite index for finding latest contact communication
CREATE INDEX idx_communication_events_contact_timestamp ON communication_events(contact_id, event_timestamp DESC) WHERE contact_id IS NOT NULL;

-- Index for finding unanswered outbound messages
CREATE INDEX idx_communication_events_unanswered ON communication_events(contact_id, event_timestamp DESC)
  WHERE direction = 'outbound' AND was_replied = FALSE;

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

ALTER TABLE communication_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own communication events"
  ON communication_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own communication events"
  ON communication_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own communication events"
  ON communication_events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own communication events"
  ON communication_events FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- Helper Functions
-- =====================================================

-- Get last communication date for a contact
CREATE OR REPLACE FUNCTION get_last_communication_date(contact_id_param UUID)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
  SELECT MAX(event_timestamp)
  FROM communication_events
  WHERE contact_id = contact_id_param;
$$ LANGUAGE SQL STABLE;

-- Get days since last contact
CREATE OR REPLACE FUNCTION get_days_since_last_contact(contact_id_param UUID)
RETURNS INTEGER AS $$
  SELECT EXTRACT(DAY FROM NOW() - MAX(event_timestamp))::INTEGER
  FROM communication_events
  WHERE contact_id = contact_id_param;
$$ LANGUAGE SQL STABLE;

-- Get last inbound response date
CREATE OR REPLACE FUNCTION get_last_response_date(contact_id_param UUID)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
  SELECT MAX(event_timestamp)
  FROM communication_events
  WHERE contact_id = contact_id_param
    AND direction = 'inbound';
$$ LANGUAGE SQL STABLE;

-- Calculate average response time for a contact
CREATE OR REPLACE FUNCTION get_avg_response_time(contact_id_param UUID)
RETURNS NUMERIC AS $$
  SELECT AVG(response_time_hours)
  FROM communication_events
  WHERE contact_id = contact_id_param
    AND direction = 'inbound'
    AND response_time_hours IS NOT NULL;
$$ LANGUAGE SQL STABLE;

-- Get communication frequency (events per week)
CREATE OR REPLACE FUNCTION get_communication_frequency(contact_id_param UUID, days INTEGER DEFAULT 30)
RETURNS NUMERIC AS $$
  SELECT
    CASE
      WHEN days > 0 THEN (COUNT(*)::NUMERIC / days::NUMERIC) * 7
      ELSE 0
    END
  FROM communication_events
  WHERE contact_id = contact_id_param
    AND event_timestamp >= NOW() - (days || ' days')::INTERVAL;
$$ LANGUAGE SQL STABLE;

-- Get unanswered outbound count
CREATE OR REPLACE FUNCTION get_unanswered_outbound_count(contact_id_param UUID, days INTEGER DEFAULT 14)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM communication_events
  WHERE contact_id = contact_id_param
    AND direction = 'outbound'
    AND was_replied = FALSE
    AND event_timestamp >= NOW() - (days || ' days')::INTERVAL;
$$ LANGUAGE SQL STABLE;

-- Calculate response rate percentage
CREATE OR REPLACE FUNCTION get_response_rate(contact_id_param UUID, days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
  SELECT
    CASE
      WHEN COUNT(*) FILTER (WHERE direction = 'outbound') > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE direction = 'outbound' AND was_replied = TRUE)::NUMERIC /
               COUNT(*) FILTER (WHERE direction = 'outbound')::NUMERIC) * 100)::INTEGER
      ELSE 0
    END
  FROM communication_events
  WHERE contact_id = contact_id_param
    AND event_timestamp >= NOW() - (days || ' days')::INTERVAL;
$$ LANGUAGE SQL STABLE;

-- Get email open rate
CREATE OR REPLACE FUNCTION get_email_open_rate(contact_id_param UUID, days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
  SELECT
    CASE
      WHEN COUNT(*) FILTER (WHERE event_type = 'email_sent') > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE event_type = 'email_sent' AND was_opened = TRUE)::NUMERIC /
               COUNT(*) FILTER (WHERE event_type = 'email_sent')::NUMERIC) * 100)::INTEGER
      ELSE 0
    END
  FROM communication_events
  WHERE contact_id = contact_id_param
    AND event_timestamp >= NOW() - (days || ' days')::INTERVAL;
$$ LANGUAGE SQL STABLE;

-- Get sentiment trend
CREATE OR REPLACE FUNCTION get_sentiment_trend(contact_id_param UUID)
RETURNS TEXT AS $$
DECLARE
  recent_sentiments NUMERIC[];
  trend TEXT;
BEGIN
  -- Get last 5 sentiment scores
  SELECT ARRAY_AGG(sentiment_score ORDER BY event_timestamp DESC)
  INTO recent_sentiments
  FROM (
    SELECT sentiment_score, event_timestamp
    FROM communication_events
    WHERE contact_id = contact_id_param
      AND sentiment_score IS NOT NULL
    ORDER BY event_timestamp DESC
    LIMIT 5
  ) sub;

  IF recent_sentiments IS NULL OR ARRAY_LENGTH(recent_sentiments, 1) < 3 THEN
    RETURN 'unknown';
  END IF;

  -- Compare most recent vs average of older scores
  IF recent_sentiments[1] > (recent_sentiments[2] + recent_sentiments[3]) / 2 + 0.1 THEN
    trend := 'improving';
  ELSIF recent_sentiments[1] < (recent_sentiments[2] + recent_sentiments[3]) / 2 - 0.1 THEN
    trend := 'declining';
  ELSE
    trend := 'stable';
  END IF;

  RETURN trend;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE communication_events IS 'Tracks all communication interactions for pattern analysis and ghost detection';
COMMENT ON COLUMN communication_events.response_time_hours IS 'For inbound events, hours since the last outbound message';
COMMENT ON COLUMN communication_events.thread_id IS 'Unique identifier for email/message threads to track conversation flow';
COMMENT ON COLUMN communication_events.external_id IS 'Unique ID from external system (email message ID, etc.) for deduplication';
COMMENT ON COLUMN communication_events.sentiment_score IS 'Sentiment analysis score from -1 (very negative) to 1 (very positive)';
