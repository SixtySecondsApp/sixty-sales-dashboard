-- Migration: MeetingBaaS Core Tables
-- Purpose: Create database schema for white-labelled meeting recording integration
-- Date: 2026-01-04

-- =============================================================================
-- 1. recording_rules - Rules engine for automatic recording decisions
-- =============================================================================
CREATE TABLE IF NOT EXISTS recording_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = org-wide rule

  -- Rule metadata
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- Higher = evaluated first

  -- Domain rules
  domain_mode TEXT CHECK (domain_mode IN ('external_only', 'internal_only', 'specific_domains', 'all')) DEFAULT 'external_only',
  specific_domains TEXT[], -- For 'specific_domains' mode
  internal_domain TEXT, -- Company domain for external detection (overrides org company_domain)

  -- Attendee rules
  min_attendee_count INTEGER DEFAULT 2,
  max_attendee_count INTEGER, -- NULL = no limit

  -- Title keyword rules
  title_keywords TEXT[], -- Match if title contains ANY of these
  title_keywords_exclude TEXT[], -- Exclude if title contains ANY of these

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for recording_rules
CREATE INDEX IF NOT EXISTS idx_recording_rules_org ON recording_rules(org_id);
CREATE INDEX IF NOT EXISTS idx_recording_rules_user ON recording_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_recording_rules_active ON recording_rules(org_id, is_active, priority DESC);

-- =============================================================================
-- 2. recordings - Core recording storage
-- =============================================================================
CREATE TABLE IF NOT EXISTS recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Meeting info
  meeting_platform TEXT NOT NULL CHECK (meeting_platform IN ('zoom', 'google_meet', 'microsoft_teams')),
  meeting_url TEXT NOT NULL,
  meeting_title TEXT,
  meeting_start_time TIMESTAMPTZ,
  meeting_end_time TIMESTAMPTZ,
  meeting_duration_seconds INTEGER,

  -- Calendar link (if triggered from calendar)
  calendar_event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,

  -- MeetingBaaS references
  bot_id TEXT, -- MeetingBaaS bot ID
  meetingbaas_recording_id TEXT,

  -- Storage
  recording_s3_key TEXT,
  recording_s3_url TEXT,
  transcript_s3_key TEXT,

  -- Transcript data
  transcript_json JSONB, -- Full transcript with timestamps and speakers
  transcript_text TEXT, -- Plain text version for search

  -- AI Analysis
  summary TEXT,
  highlights JSONB, -- [{timestamp, text, type}]
  action_items JSONB, -- Extracted by use60 AI

  -- Speaker identification
  speakers JSONB, -- [{speaker_id, email, name, is_internal}]
  speaker_identification_method TEXT CHECK (speaker_identification_method IN ('email_match', 'ai_inference', 'manual', 'unknown')),

  -- CRM links
  crm_contacts JSONB, -- [{contact_id, email, name, crm_type}]
  crm_deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  crm_activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,

  -- HITL tracking
  hitl_required BOOLEAN DEFAULT false,
  hitl_type TEXT, -- 'speaker_confirmation', 'deal_selection', etc.
  hitl_data JSONB, -- Context for HITL resolution
  hitl_resolved_at TIMESTAMPTZ,
  hitl_resolved_by UUID REFERENCES auth.users(id),

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'bot_joining', 'recording', 'processing', 'ready', 'failed')),
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for recordings
CREATE INDEX IF NOT EXISTS idx_recordings_org ON recordings(org_id);
CREATE INDEX IF NOT EXISTS idx_recordings_user ON recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_recordings_status ON recordings(status);
CREATE INDEX IF NOT EXISTS idx_recordings_bot ON recordings(bot_id);
CREATE INDEX IF NOT EXISTS idx_recordings_created ON recordings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recordings_calendar_event ON recordings(calendar_event_id);
CREATE INDEX IF NOT EXISTS idx_recordings_deal ON recordings(crm_deal_id);

-- Full-text search on transcript
CREATE INDEX IF NOT EXISTS idx_recordings_transcript_search ON recordings USING gin(to_tsvector('english', transcript_text));

-- =============================================================================
-- 3. recording_usage - Monthly usage tracking per organization
-- =============================================================================
CREATE TABLE IF NOT EXISTS recording_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Period (monthly billing cycles)
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Usage counts
  recordings_count INTEGER DEFAULT 0,
  recordings_limit INTEGER DEFAULT 20, -- Default free tier limit
  total_duration_seconds INTEGER DEFAULT 0,

  -- Storage tracking
  storage_used_bytes BIGINT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id, period_start)
);

-- Indexes for recording_usage
CREATE INDEX IF NOT EXISTS idx_recording_usage_org_period ON recording_usage(org_id, period_start DESC);

-- =============================================================================
-- 4. bot_deployments - Track MeetingBaaS bot lifecycle
-- =============================================================================
CREATE TABLE IF NOT EXISTS bot_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recording_id UUID REFERENCES recordings(id) ON DELETE SET NULL,

  -- MeetingBaaS reference
  bot_id TEXT NOT NULL, -- MeetingBaaS bot ID

  -- Status tracking
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'joining', 'in_meeting', 'leaving', 'completed', 'failed', 'cancelled')),
  status_history JSONB DEFAULT '[]', -- [{status, timestamp, details}]

  -- Meeting details
  meeting_url TEXT NOT NULL,
  scheduled_join_time TIMESTAMPTZ,
  actual_join_time TIMESTAMPTZ,
  leave_time TIMESTAMPTZ,

  -- Bot config used
  bot_name TEXT,
  bot_image_url TEXT,
  entry_message TEXT,

  -- Errors
  error_code TEXT,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for bot_deployments
CREATE INDEX IF NOT EXISTS idx_bot_deployments_bot ON bot_deployments(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_deployments_org ON bot_deployments(org_id);
CREATE INDEX IF NOT EXISTS idx_bot_deployments_status ON bot_deployments(status);
CREATE INDEX IF NOT EXISTS idx_bot_deployments_recording ON bot_deployments(recording_id);

-- =============================================================================
-- 5. webhook_events - Generic webhook event logging (if not exists)
-- =============================================================================
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source identification
  source TEXT NOT NULL, -- 'meetingbaas', 'hubspot', 'slack', etc.
  event_type TEXT NOT NULL,
  event_id TEXT, -- External event ID for deduplication

  -- Payload
  payload JSONB NOT NULL,
  headers JSONB, -- Store relevant headers

  -- Processing status
  status TEXT DEFAULT 'received' CHECK (status IN ('received', 'processing', 'processed', 'failed', 'ignored')),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for webhook_events
CREATE INDEX IF NOT EXISTS idx_webhook_events_source_type ON webhook_events(source, event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(source, event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON webhook_events(created_at DESC);

-- =============================================================================
-- 6. Add recording settings to organizations
-- =============================================================================
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS recording_settings JSONB DEFAULT '{
    "bot_name": "60 Notetaker",
    "bot_image_url": null,
    "entry_message_enabled": true,
    "entry_message": "Hi! I''m here to take notes so {rep_name} can focus on our conversation. 📝",
    "default_transcription_provider": "gladia",
    "recordings_enabled": false,
    "auto_record_enabled": false
  }';

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{
    "recording_started": {"slack": true, "email": false, "in_app": true},
    "recording_failed": {"slack": true, "email": true, "in_app": true},
    "recording_ready": {"slack": true, "email": false, "in_app": true},
    "hitl_required": {"slack": true, "email": false, "in_app": true}
  }';

-- =============================================================================
-- 7. RLS Policies
-- =============================================================================

-- Enable RLS
ALTER TABLE recording_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE recording_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- recording_rules policies
CREATE POLICY "Users can view their org's recording rules"
  ON recording_rules FOR SELECT
  USING (
    org_id IN (
      SELECT om.org_id FROM organization_memberships om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage recording rules"
  ON recording_rules FOR ALL
  USING (
    org_id IN (
      SELECT om.org_id FROM organization_memberships om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

-- recordings policies
CREATE POLICY "Users can view their org's recordings"
  ON recordings FOR SELECT
  USING (
    org_id IN (
      SELECT om.org_id FROM organization_memberships om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create recordings for their org"
  ON recordings FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT om.org_id FROM organization_memberships om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own recordings"
  ON recordings FOR UPDATE
  USING (
    user_id = auth.uid() OR
    org_id IN (
      SELECT om.org_id FROM organization_memberships om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

-- recording_usage policies
CREATE POLICY "Users can view their org's usage"
  ON recording_usage FOR SELECT
  USING (
    org_id IN (
      SELECT om.org_id FROM organization_memberships om
      WHERE om.user_id = auth.uid()
    )
  );

-- bot_deployments policies
CREATE POLICY "Users can view their org's bot deployments"
  ON bot_deployments FOR SELECT
  USING (
    org_id IN (
      SELECT om.org_id FROM organization_memberships om
      WHERE om.user_id = auth.uid()
    )
  );

-- webhook_events - service role only (no user access)
CREATE POLICY "Service role can manage webhook events"
  ON webhook_events FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- 8. Helper Functions
-- =============================================================================

-- Function to increment recording usage
CREATE OR REPLACE FUNCTION increment_recording_usage(
  p_org_id UUID,
  p_period DATE DEFAULT NULL,
  p_duration_seconds INTEGER DEFAULT 0,
  p_storage_bytes BIGINT DEFAULT 0
)
RETURNS recording_usage AS $$
DECLARE
  v_period_start DATE;
  v_period_end DATE;
  v_result recording_usage;
BEGIN
  -- Default to current month
  v_period_start := COALESCE(p_period, date_trunc('month', CURRENT_DATE)::DATE);
  v_period_end := (date_trunc('month', v_period_start) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  -- Upsert usage record
  INSERT INTO recording_usage (org_id, period_start, period_end, recordings_count, total_duration_seconds, storage_used_bytes)
  VALUES (p_org_id, v_period_start, v_period_end, 1, p_duration_seconds, p_storage_bytes)
  ON CONFLICT (org_id, period_start) DO UPDATE SET
    recordings_count = recording_usage.recordings_count + 1,
    total_duration_seconds = recording_usage.total_duration_seconds + p_duration_seconds,
    storage_used_bytes = recording_usage.storage_used_bytes + p_storage_bytes,
    updated_at = NOW()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if org has available recording quota
CREATE OR REPLACE FUNCTION check_recording_quota(p_org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_usage recording_usage;
  v_period_start DATE;
BEGIN
  v_period_start := date_trunc('month', CURRENT_DATE)::DATE;

  SELECT * INTO v_usage
  FROM recording_usage
  WHERE org_id = p_org_id AND period_start = v_period_start;

  -- No usage record = under limit
  IF NOT FOUND THEN
    RETURN TRUE;
  END IF;

  -- Check against limit
  RETURN v_usage.recordings_count < v_usage.recordings_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get org internal domain (for external attendee detection)
CREATE OR REPLACE FUNCTION get_org_internal_domain(p_org_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_domain TEXT;
BEGIN
  SELECT company_domain INTO v_domain
  FROM organizations
  WHERE id = p_org_id;

  RETURN v_domain;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 9. Triggers for updated_at
-- =============================================================================

-- Generic updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_recording_rules_updated_at ON recording_rules;
CREATE TRIGGER update_recording_rules_updated_at
  BEFORE UPDATE ON recording_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_recordings_updated_at ON recordings;
CREATE TRIGGER update_recordings_updated_at
  BEFORE UPDATE ON recordings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_recording_usage_updated_at ON recording_usage;
CREATE TRIGGER update_recording_usage_updated_at
  BEFORE UPDATE ON recording_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bot_deployments_updated_at ON bot_deployments;
CREATE TRIGGER update_bot_deployments_updated_at
  BEFORE UPDATE ON bot_deployments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_webhook_events_updated_at ON webhook_events;
CREATE TRIGGER update_webhook_events_updated_at
  BEFORE UPDATE ON webhook_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 10. Default recording rule for new organizations (optional seed)
-- =============================================================================
-- This can be called when an org enables recording for the first time

CREATE OR REPLACE FUNCTION create_default_recording_rules(p_org_id UUID)
RETURNS void AS $$
BEGIN
  -- Only create if no rules exist
  IF NOT EXISTS (SELECT 1 FROM recording_rules WHERE org_id = p_org_id) THEN
    -- Default rule: Record all external meetings with 2+ attendees
    INSERT INTO recording_rules (
      org_id,
      name,
      is_active,
      priority,
      domain_mode,
      min_attendee_count,
      title_keywords_exclude
    ) VALUES (
      p_org_id,
      'Record external meetings',
      true,
      100,
      'external_only',
      2,
      ARRAY['internal', '1:1', 'standup', 'stand-up', 'sync']
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
