-- Safe version that handles existing policies
-- Create table for storing Slack OAuth tokens and workspace information
CREATE TABLE IF NOT EXISTS slack_integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL, -- Slack workspace ID
  team_name TEXT NOT NULL, -- Slack workspace name
  access_token TEXT NOT NULL, -- Bot user OAuth token (xoxb-...)
  bot_user_id TEXT NOT NULL, -- Bot user ID in Slack
  app_id TEXT NOT NULL, -- Slack app ID
  authed_user JSONB, -- Information about the user who authorized the app
  scope TEXT NOT NULL, -- OAuth scopes granted
  token_type TEXT DEFAULT 'bot', -- Type of token (bot or user)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, team_id)
);

-- Create table for caching Slack channels
CREATE TABLE IF NOT EXISTS slack_channels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID NOT NULL REFERENCES slack_integrations(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL, -- Slack channel ID (C1234567890)
  channel_name TEXT NOT NULL, -- Channel name (#general)
  is_private BOOLEAN DEFAULT false,
  is_member BOOLEAN DEFAULT true, -- Is the bot a member of this channel
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(integration_id, channel_id)
);

-- Enable RLS
ALTER TABLE slack_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_channels ENABLE ROW LEVEL SECURITY;

-- Drop existing policies safely (no error if they don't exist)
DROP POLICY IF EXISTS "Users can manage own Slack integrations" ON slack_integrations;
DROP POLICY IF EXISTS "Service role can manage all Slack integrations" ON slack_integrations;
DROP POLICY IF EXISTS "Users can manage own Slack channels" ON slack_channels;
DROP POLICY IF EXISTS "Service role can manage all Slack channels" ON slack_channels;

-- Create fresh policies
CREATE POLICY "Users can manage own Slack integrations" ON slack_integrations
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all Slack integrations" ON slack_integrations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can manage own Slack channels" ON slack_channels
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM slack_integrations
      WHERE slack_integrations.id = slack_channels.integration_id
      AND slack_integrations.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all Slack channels" ON slack_channels
  FOR ALL USING (auth.role() = 'service_role');

-- Create indexes (IF NOT EXISTS handles duplicates)
CREATE INDEX IF NOT EXISTS idx_slack_integrations_user_id ON slack_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_slack_integrations_team_id ON slack_integrations(team_id);
CREATE INDEX IF NOT EXISTS idx_slack_channels_integration_id ON slack_channels(integration_id);
CREATE INDEX IF NOT EXISTS idx_slack_channels_channel_id ON slack_channels(channel_id);

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop triggers if they exist and recreate
DROP TRIGGER IF EXISTS update_slack_integrations_updated_at ON slack_integrations;
DROP TRIGGER IF EXISTS update_slack_channels_updated_at ON slack_channels;

CREATE TRIGGER update_slack_integrations_updated_at
  BEFORE UPDATE ON slack_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_slack_channels_updated_at
  BEFORE UPDATE ON slack_channels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (safe to run multiple times)
GRANT ALL ON slack_integrations TO authenticated;
GRANT ALL ON slack_channels TO authenticated;
GRANT ALL ON slack_integrations TO service_role;
GRANT ALL ON slack_channels TO service_role;

-- Verify tables exist
SELECT 'Tables created successfully!' as status;
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('slack_integrations', 'slack_channels') 
AND table_schema = 'public';