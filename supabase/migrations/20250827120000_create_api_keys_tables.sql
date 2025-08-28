/*
  # API Keys Management Schema

  1. New tables
    - `api_keys` for storing API key metadata and permissions
    - `api_key_usage` for tracking API usage and analytics
    
  2. Security
    - API keys are hashed using SHA-256
    - Rate limiting support built-in
    - Expiration date support
    - Granular permissions via jsonb

  3. Indexes
    - Optimized for lookup and usage tracking
*/

-- Create API keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash of the API key
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  permissions JSONB NOT NULL DEFAULT '{"read": true, "write": false, "delete": false}'::jsonb,
  rate_limit INTEGER NOT NULL DEFAULT 1000, -- requests per hour
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create API key usage tracking table
CREATE TABLE IF NOT EXISTS api_key_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER NOT NULL,
  user_agent TEXT,
  ip_address INET,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  request_size INTEGER,
  response_size INTEGER
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON api_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_api_key_id ON api_key_usage(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_timestamp ON api_key_usage(timestamp);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_endpoint_method ON api_key_usage(endpoint, method);

-- Create updated_at trigger for api_keys
CREATE TRIGGER update_api_keys_updated_at 
  BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS policies for api_keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Users can only see their own API keys
CREATE POLICY "Users can view own API keys" ON api_keys
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own API keys
CREATE POLICY "Users can create own API keys" ON api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own API keys
CREATE POLICY "Users can update own API keys" ON api_keys
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own API keys
CREATE POLICY "Users can delete own API keys" ON api_keys
  FOR DELETE USING (auth.uid() = user_id);

-- Admins can see all API keys
CREATE POLICY "Admins can view all API keys" ON api_keys
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- RLS policies for api_key_usage
ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;

-- Users can only see usage for their own API keys
CREATE POLICY "Users can view own API key usage" ON api_key_usage
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM api_keys 
      WHERE id = api_key_usage.api_key_id 
      AND user_id = auth.uid()
    )
  );

-- API key usage is inserted by system only
CREATE POLICY "System can insert API key usage" ON api_key_usage
  FOR INSERT WITH CHECK (true);

-- Admins can view all usage
CREATE POLICY "Admins can view all API key usage" ON api_key_usage
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Function to generate secure API key
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS TEXT AS $$
DECLARE
  key_string TEXT;
  prefix TEXT := 'sk_';
  random_part TEXT;
BEGIN
  -- Generate 32 random bytes and encode as base64
  SELECT encode(gen_random_bytes(32), 'base64') INTO random_part;
  
  -- Remove padding and special characters, keep only alphanumeric
  random_part := regexp_replace(random_part, '[^A-Za-z0-9]', '', 'g');
  
  -- Take first 40 characters and add prefix
  key_string := prefix || substring(random_part, 1, 40);
  
  RETURN key_string;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to hash API key
CREATE OR REPLACE FUNCTION hash_api_key(key_text TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(key_text, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create API key (returns the unhashed key once)
CREATE OR REPLACE FUNCTION create_api_key(
  key_name TEXT,
  user_uuid UUID DEFAULT auth.uid(),
  permissions_json JSONB DEFAULT '{"read": true, "write": false, "delete": false}'::jsonb,
  rate_limit_val INTEGER DEFAULT 1000,
  expires_days INTEGER DEFAULT NULL
)
RETURNS TABLE (
  api_key TEXT,
  key_id UUID,
  key_hash TEXT
) AS $$
DECLARE
  new_key TEXT;
  key_hash_val TEXT;
  expires_date TIMESTAMP WITH TIME ZONE;
  new_key_id UUID;
BEGIN
  -- Generate new API key
  new_key := generate_api_key();
  key_hash_val := hash_api_key(new_key);
  
  -- Calculate expiration date if provided
  IF expires_days IS NOT NULL THEN
    expires_date := NOW() + (expires_days || ' days')::INTERVAL;
  END IF;
  
  -- Insert into api_keys table
  INSERT INTO api_keys (name, key_hash, user_id, permissions, rate_limit, expires_at)
  VALUES (key_name, key_hash_val, user_uuid, permissions_json, rate_limit_val, expires_date)
  RETURNING id INTO new_key_id;
  
  -- Return the unhashed key (this is the only time it will be available)
  RETURN QUERY SELECT new_key, new_key_id, key_hash_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate API key and get user context
CREATE OR REPLACE FUNCTION validate_api_key(key_text TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  user_id UUID,
  permissions JSONB,
  rate_limit INTEGER,
  is_expired BOOLEAN
) AS $$
DECLARE
  key_hash_val TEXT;
  key_record RECORD;
BEGIN
  -- Hash the provided key
  key_hash_val := hash_api_key(key_text);
  
  -- Look up the key
  SELECT ak.user_id, ak.permissions, ak.rate_limit, ak.expires_at, ak.id
  INTO key_record
  FROM api_keys ak
  WHERE ak.key_hash = key_hash_val;
  
  -- Check if key exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::JSONB, 0, false;
    RETURN;
  END IF;
  
  -- Check if key is expired
  IF key_record.expires_at IS NOT NULL AND key_record.expires_at < NOW() THEN
    RETURN QUERY SELECT false, key_record.user_id, key_record.permissions, key_record.rate_limit, true;
    RETURN;
  END IF;
  
  -- Update last_used_at
  UPDATE api_keys 
  SET last_used_at = NOW() 
  WHERE id = key_record.id;
  
  -- Return valid key info
  RETURN QUERY SELECT true, key_record.user_id, key_record.permissions, key_record.rate_limit, false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(key_hash_val TEXT)
RETURNS TABLE (
  allowed BOOLEAN,
  current_usage INTEGER,
  limit_value INTEGER
) AS $$
DECLARE
  api_key_record RECORD;
  current_hour_usage INTEGER;
  current_hour TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get current hour timestamp
  current_hour := date_trunc('hour', NOW());
  
  -- Get API key info
  SELECT ak.id, ak.rate_limit
  INTO api_key_record
  FROM api_keys ak
  WHERE ak.key_hash = key_hash_val;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;
  
  -- Count usage in current hour
  SELECT COUNT(*)::INTEGER
  INTO current_hour_usage
  FROM api_key_usage aku
  WHERE aku.api_key_id = api_key_record.id
    AND aku.timestamp >= current_hour;
  
  -- Check if under limit
  IF current_hour_usage < api_key_record.rate_limit THEN
    RETURN QUERY SELECT true, current_hour_usage, api_key_record.rate_limit;
  ELSE
    RETURN QUERY SELECT false, current_hour_usage, api_key_record.rate_limit;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;