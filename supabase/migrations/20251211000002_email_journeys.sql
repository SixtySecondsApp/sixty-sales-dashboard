-- ============================================================================
-- EMAIL JOURNEYS MIGRATION
-- Store email journey definitions and track email sends for deduplication
-- ============================================================================

-- Store email journey definitions
CREATE TABLE IF NOT EXISTS email_journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_name TEXT NOT NULL,           -- 'onboarding', 'trial', 'engagement', 'win_back'
  trigger_event TEXT NOT NULL,          -- Event that triggers this email
  delay_minutes INT DEFAULT 0,          -- Delay after trigger (in minutes)
  email_template_id TEXT,               -- Encharge template ID or name
  email_type TEXT NOT NULL,             -- From EmailType enum
  conditions JSONB DEFAULT '{}'::jsonb, -- Segment conditions (e.g., {"fathom_connected": false})
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track email sends for deduplication and analytics
CREATE TABLE IF NOT EXISTS email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  journey_id UUID REFERENCES email_journeys(id) ON DELETE SET NULL,
  email_type TEXT NOT NULL,
  status TEXT DEFAULT 'sent',           -- 'sent', 'failed', 'bounced', 'opened', 'clicked'
  encharge_message_id TEXT,
  to_email TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_journeys_journey_name ON email_journeys(journey_name);
CREATE INDEX IF NOT EXISTS idx_email_journeys_trigger_event ON email_journeys(trigger_event);
CREATE INDEX IF NOT EXISTS idx_email_journeys_active ON email_journeys(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_email_sends_user_id ON email_sends(user_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_journey_id ON email_sends(journey_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_email_type ON email_sends(email_type);
CREATE INDEX IF NOT EXISTS idx_email_sends_status ON email_sends(status);
CREATE INDEX IF NOT EXISTS idx_email_sends_sent_at ON email_sends(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_sends_user_type ON email_sends(user_id, email_type);

-- RLS Policies
ALTER TABLE email_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sends ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "email_journeys_admin_select" ON email_journeys;
DROP POLICY IF EXISTS "email_journeys_admin_insert" ON email_journeys;
DROP POLICY IF EXISTS "email_journeys_admin_update" ON email_journeys;

DROP POLICY IF EXISTS "email_sends_user_select" ON email_sends;
DROP POLICY IF EXISTS "email_sends_user_insert" ON email_sends;
DROP POLICY IF EXISTS "email_sends_admin_select" ON email_sends;

-- Email journeys: Admin only (platform admins manage journeys)
CREATE POLICY "email_journeys_admin_select" ON email_journeys
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.is_admin = true
    )
  );

CREATE POLICY "email_journeys_admin_insert" ON email_journeys
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.is_admin = true
    )
  );

CREATE POLICY "email_journeys_admin_update" ON email_journeys
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.is_admin = true
    )
  );

-- Email sends: Users can see their own, admins can see all
CREATE POLICY "email_sends_user_select" ON email_sends
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "email_sends_user_insert" ON email_sends
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "email_sends_admin_select" ON email_sends
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.is_admin = true
    )
  );

-- Function to check if email was already sent (for deduplication)
CREATE OR REPLACE FUNCTION was_email_sent(
  p_user_id UUID,
  p_email_type TEXT,
  p_hours_window INT DEFAULT 24
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM email_sends
    WHERE user_id = p_user_id
    AND email_type = p_email_type
    AND sent_at >= NOW() - (p_hours_window || ' hours')::INTERVAL
    AND status = 'sent'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record email send
CREATE OR REPLACE FUNCTION record_email_send(
  p_user_id UUID,
  p_journey_id UUID,
  p_email_type TEXT,
  p_to_email TEXT,
  p_encharge_message_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_send_id UUID;
BEGIN
  INSERT INTO email_sends (
    user_id,
    journey_id,
    email_type,
    to_email,
    encharge_message_id,
    status,
    metadata
  )
  VALUES (
    p_user_id,
    p_journey_id,
    p_email_type,
    p_to_email,
    p_encharge_message_id,
    'sent',
    p_metadata
  )
  RETURNING id INTO v_send_id;

  RETURN v_send_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION was_email_sent(UUID, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION was_email_sent(UUID, TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION record_email_send(UUID, UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION record_email_send(UUID, UUID, TEXT, TEXT, TEXT, JSONB) TO service_role;

-- Insert default email journeys based on onboarding simulator timeline
INSERT INTO email_journeys (journey_name, trigger_event, delay_minutes, email_type, conditions, is_active) VALUES
  -- Onboarding Flow
  ('onboarding', 'account_created', 0, 'welcome', '{}', true),
  ('onboarding', 'waitlist_invite', 0, 'waitlist_invite', '{}', true),
  ('onboarding', 'account_created', 1440, 'reminder', '{"fathom_connected": false}', true), -- 24h reminder if Fathom not connected
  ('onboarding', 'account_created', 4320, 'reminder', '{"first_meeting_synced": false}', true), -- 3 days reminder if no meetings
  
  -- Trial Flow
  ('trial', 'trial_will_end', 0, 'trial_ending', '{"days_remaining": 3}', true),
  ('trial', 'trial_will_end', 0, 'trial_ending', '{"days_remaining": 1}', true),
  ('trial', 'trial_expired', 0, 'trial_expired', '{}', true),
  ('trial', 'trial_expired', 2880, 'win_back', '{}', true), -- 2 days after expiry
  
  -- Engagement Flow
  ('engagement', 'first_summary_viewed', 0, 'engagement', '{}', true),
  ('engagement', 'first_proposal_generated', 0, 'engagement', '{}', true),
  
  -- Retention Flow
  ('retention', 'user_inactive', 10080, 're_engagement', '{"days_inactive": 7}', true), -- 7 days inactive
  ('retention', 'user_inactive', 20160, 're_engagement', '{"days_inactive": 14}', true), -- 14 days inactive
  ('retention', 'user_inactive', 43200, 'win_back', '{"days_inactive": 30}', true) -- 30 days inactive
ON CONFLICT DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE email_journeys IS 'Email journey definitions that map events to email sends';
COMMENT ON TABLE email_sends IS 'Tracks all email sends for deduplication and analytics';
COMMENT ON FUNCTION was_email_sent IS 'Check if an email was already sent to a user within a time window';
COMMENT ON FUNCTION record_email_send IS 'Record an email send in the database';

-- ============================================================================
-- Done!
-- ============================================================================
SELECT 'Email journeys migration complete!' as status;
