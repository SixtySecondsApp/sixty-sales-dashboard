-- =============================================================================
-- MeetingBaaS Calendar Connections
-- =============================================================================
-- Stores the mapping between user's calendars and MeetingBaaS calendar IDs
-- This enables automatic bot deployment for calendar events

CREATE TABLE IF NOT EXISTS meetingbaas_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- MeetingBaaS reference
  meetingbaas_calendar_id TEXT NOT NULL,

  -- Calendar details
  raw_calendar_id TEXT NOT NULL DEFAULT 'primary',
  platform TEXT NOT NULL DEFAULT 'google' CHECK (platform IN ('google', 'microsoft')),
  email TEXT,
  name TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  sync_error TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(user_id, raw_calendar_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meetingbaas_calendars_user ON meetingbaas_calendars(user_id);
CREATE INDEX IF NOT EXISTS idx_meetingbaas_calendars_org ON meetingbaas_calendars(org_id);
CREATE INDEX IF NOT EXISTS idx_meetingbaas_calendars_mb_id ON meetingbaas_calendars(meetingbaas_calendar_id);
CREATE INDEX IF NOT EXISTS idx_meetingbaas_calendars_active ON meetingbaas_calendars(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE meetingbaas_calendars ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can view own calendar connections" ON meetingbaas_calendars;
DROP POLICY IF EXISTS "Users can manage own calendar connections" ON meetingbaas_calendars;
DROP POLICY IF EXISTS "Service role full access to calendar connections" ON meetingbaas_calendars;

-- Users can view their own calendar connections
CREATE POLICY "Users can view own calendar connections"
  ON meetingbaas_calendars FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can manage their own calendar connections
CREATE POLICY "Users can manage own calendar connections"
  ON meetingbaas_calendars FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role can do anything
CREATE POLICY "Service role full access to calendar connections"
  ON meetingbaas_calendars FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_meetingbaas_calendars_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_meetingbaas_calendars_updated_at ON meetingbaas_calendars;
CREATE TRIGGER update_meetingbaas_calendars_updated_at
  BEFORE UPDATE ON meetingbaas_calendars
  FOR EACH ROW
  EXECUTE FUNCTION update_meetingbaas_calendars_updated_at();

-- Comment
COMMENT ON TABLE meetingbaas_calendars IS 'Stores MeetingBaaS calendar connections for automatic bot deployment';
