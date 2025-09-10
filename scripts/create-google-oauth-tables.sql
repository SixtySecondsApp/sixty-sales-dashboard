-- Create google_oauth_states table if it doesn't exist
-- This table stores OAuth state and PKCE verifier temporarily during the OAuth flow
CREATE TABLE IF NOT EXISTS google_oauth_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  state TEXT UNIQUE NOT NULL,
  code_verifier TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes')
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_google_oauth_states_state ON google_oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_google_oauth_states_user_id ON google_oauth_states(user_id);

-- Create cleanup function to remove expired states
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM google_oauth_states WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create google_service_logs table for debugging
CREATE TABLE IF NOT EXISTS google_service_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID REFERENCES google_integrations(id) ON DELETE CASCADE,
  service TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  request_data JSONB,
  response_data JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_google_service_logs_integration_id ON google_service_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_google_service_logs_created_at ON google_service_logs(created_at DESC);

-- Enable RLS
ALTER TABLE google_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_service_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for google_oauth_states
CREATE POLICY "Users can view their own OAuth states" ON google_oauth_states
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own OAuth states" ON google_oauth_states
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own OAuth states" ON google_oauth_states
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for google_service_logs (admin only for now)
CREATE POLICY "Users can view their own service logs" ON google_service_logs
  FOR SELECT USING (
    integration_id IN (
      SELECT id FROM google_integrations WHERE user_id = auth.uid()
    )
  );

-- Grant necessary permissions
GRANT ALL ON google_oauth_states TO authenticated;
GRANT ALL ON google_service_logs TO authenticated;

-- Also update the google_integrations table to ensure it has all needed columns
ALTER TABLE google_integrations 
ADD COLUMN IF NOT EXISTS access_token TEXT,
ADD COLUMN IF NOT EXISTS refresh_token TEXT;