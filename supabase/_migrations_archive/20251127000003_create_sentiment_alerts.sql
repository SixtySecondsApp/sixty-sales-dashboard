-- Phase 3: Sentiment Dashboard
-- Create sentiment_alerts table for negative sentiment notifications

CREATE TABLE IF NOT EXISTS sentiment_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('negative_meeting', 'declining_trend', 'at_risk')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  sentiment_score NUMERIC CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sentiment_alerts_user_id ON sentiment_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_alerts_meeting_id ON sentiment_alerts(meeting_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_alerts_contact_id ON sentiment_alerts(contact_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_alerts_is_read ON sentiment_alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_sentiment_alerts_created_at ON sentiment_alerts(created_at DESC);

-- Enable RLS
ALTER TABLE sentiment_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own alerts
CREATE POLICY "Users can view their own sentiment alerts"
  ON sentiment_alerts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sentiment alerts"
  ON sentiment_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sentiment alerts"
  ON sentiment_alerts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sentiment alerts"
  ON sentiment_alerts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sentiment_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sentiment_alerts_timestamp
  BEFORE UPDATE ON sentiment_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_sentiment_alerts_updated_at();

-- Helper function to mark alerts as read
CREATE OR REPLACE FUNCTION mark_sentiment_alert_read(p_alert_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE sentiment_alerts
  SET is_read = true, updated_at = NOW()
  WHERE id = p_alert_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION mark_sentiment_alert_read TO authenticated;

-- Helper function to get unread alert count
CREATE OR REPLACE FUNCTION get_unread_sentiment_alert_count()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM sentiment_alerts
    WHERE user_id = auth.uid() AND is_read = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_unread_sentiment_alert_count TO authenticated;

-- Add comment
COMMENT ON TABLE sentiment_alerts IS 'Alerts for negative sentiment patterns in meetings';
COMMENT ON FUNCTION mark_sentiment_alert_read IS 'Mark a sentiment alert as read for the current user';
COMMENT ON FUNCTION get_unread_sentiment_alert_count IS 'Get count of unread sentiment alerts for the current user';

