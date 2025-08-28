-- Update API keys table structure to match the frontend implementation

-- Drop existing tables if they exist with different structure
DROP TABLE IF EXISTS api_key_usage CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;

-- Create the api_keys table matching our component expectations
CREATE TABLE api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_preview TEXT NOT NULL, -- Preview of the key (first 8 chars + ... + last 4)
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  permissions TEXT[] NOT NULL DEFAULT ARRAY['deals:read'], -- Array of permission strings
  rate_limit INTEGER NOT NULL DEFAULT 500,
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create the api_requests table for logging and rate limiting
CREATE TABLE api_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  headers JSONB,
  body TEXT,
  status_code INTEGER,
  response_body TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active);
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX idx_api_requests_api_key_id ON api_requests(api_key_id);
CREATE INDEX idx_api_requests_user_id ON api_requests(user_id);
CREATE INDEX idx_api_requests_created_at ON api_requests(created_at);
CREATE INDEX idx_api_requests_endpoint_method ON api_requests(endpoint, method);

-- RLS policies for api_keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Users can only see their own API keys
CREATE POLICY "Users can view own API keys" ON api_keys
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own API keys (will be handled by Edge Function)
CREATE POLICY "Users can create own API keys" ON api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own API keys
CREATE POLICY "Users can update own API keys" ON api_keys
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own API keys
CREATE POLICY "Users can delete own API keys" ON api_keys
  FOR DELETE USING (auth.uid() = user_id);

-- Service role can do everything (for Edge Functions)
CREATE POLICY "Service role full access to api_keys" ON api_keys
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS policies for api_requests
ALTER TABLE api_requests ENABLE ROW LEVEL SECURITY;

-- Users can only see requests for their own API keys
CREATE POLICY "Users can view own API requests" ON api_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert and manage all requests
CREATE POLICY "Service role full access to api_requests" ON api_requests
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for updated_at on api_keys
CREATE TRIGGER update_api_keys_updated_at 
  BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();