-- Final consolidated API Keys database fix
-- This migration ensures the correct structure for the API key system

-- First, clean up any potential conflicts
-- Drop existing policies to avoid duplicates
DO $$ 
BEGIN
    -- Drop all existing policies on api_keys table
    DROP POLICY IF EXISTS "Users can view own API keys" ON api_keys;
    DROP POLICY IF EXISTS "Users can create own API keys" ON api_keys;
    DROP POLICY IF EXISTS "Users can update own API keys" ON api_keys;
    DROP POLICY IF EXISTS "Users can delete own API keys" ON api_keys;
    DROP POLICY IF EXISTS "Service role full access to api_keys" ON api_keys;
    DROP POLICY IF EXISTS "Admins can view all API keys" ON api_keys;
    
    -- Drop all existing policies on api_requests table  
    DROP POLICY IF EXISTS "Users can view own API requests" ON api_requests;
    DROP POLICY IF EXISTS "Service role full access to api_requests" ON api_requests;
    DROP POLICY IF EXISTS "System can insert API key usage" ON api_requests;
    DROP POLICY IF EXISTS "Admins can view all API key usage" ON api_requests;
EXCEPTION
    WHEN undefined_table THEN
        NULL; -- Table doesn't exist yet, ignore
    WHEN undefined_object THEN  
        NULL; -- Policy doesn't exist, ignore
END $$;

-- Drop and recreate tables to ensure correct structure
DROP TABLE IF EXISTS api_requests CASCADE;
DROP TABLE IF EXISTS api_key_usage CASCADE; -- from old migration
DROP TABLE IF EXISTS api_keys CASCADE;

-- Create the api_keys table with the exact structure expected by the Edge Function
CREATE TABLE api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_preview TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    permissions TEXT[] NOT NULL DEFAULT ARRAY['deals:read'],
    rate_limit INTEGER NOT NULL DEFAULT 500,
    usage_count INTEGER NOT NULL DEFAULT 0,
    last_used TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create the api_requests table for logging
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

-- Create performance indexes
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active);
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX idx_api_requests_api_key_id ON api_requests(api_key_id);
CREATE INDEX idx_api_requests_user_id ON api_requests(user_id);
CREATE INDEX idx_api_requests_created_at ON api_requests(created_at);
CREATE INDEX idx_api_requests_endpoint_method ON api_requests(endpoint, method);

-- Create or replace the update trigger function
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

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_requests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for api_keys
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

-- Service role can do everything (for Edge Functions)
CREATE POLICY "Service role full access to api_keys" ON api_keys
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Create RLS policies for api_requests
-- Users can only see requests for their own API keys or their own user_id
CREATE POLICY "Users can view own API requests" ON api_requests
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert and manage all requests (for Edge Functions)
CREATE POLICY "Service role full access to api_requests" ON api_requests
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Grant necessary permissions
GRANT ALL ON api_keys TO authenticated;
GRANT ALL ON api_requests TO authenticated;
GRANT ALL ON api_keys TO service_role;
GRANT ALL ON api_requests TO service_role;

-- Create helper functions for API key operations
-- Function to generate a secure API key
CREATE OR REPLACE FUNCTION generate_api_key(user_uuid UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    key_string TEXT;
    prefix TEXT := 'sk_';
    user_prefix TEXT;
    random_part TEXT;
BEGIN
    -- Use provided user_uuid or current auth user
    IF user_uuid IS NULL THEN
        user_uuid := auth.uid();
    END IF;
    
    -- Get first 8 characters of user ID
    user_prefix := substring(user_uuid::text, 1, 8);
    
    -- Generate random UUID and remove dashes
    SELECT replace(gen_random_uuid()::text, '-', '') INTO random_part;
    
    -- Construct key: sk_{user_prefix}_{random_part}
    key_string := prefix || user_prefix || '_' || random_part;
    
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

-- Function to validate API key and return user context
CREATE OR REPLACE FUNCTION validate_api_key(key_text TEXT)
RETURNS TABLE (
    is_valid BOOLEAN,
    user_id UUID,
    permissions TEXT[],
    rate_limit INTEGER,
    is_expired BOOLEAN,
    is_active BOOLEAN
) AS $$
DECLARE
    key_hash_val TEXT;
    key_record RECORD;
BEGIN
    -- Hash the provided key
    key_hash_val := hash_api_key(key_text);
    
    -- Look up the key
    SELECT ak.user_id, ak.permissions, ak.rate_limit, ak.expires_at, ak.is_active, ak.id
    INTO key_record
    FROM api_keys ak
    WHERE ak.key_hash = key_hash_val;
    
    -- Check if key exists
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT[], 0, false, false;
        RETURN;
    END IF;
    
    -- Check if key is inactive
    IF NOT key_record.is_active THEN
        RETURN QUERY SELECT false, key_record.user_id, key_record.permissions, key_record.rate_limit, false, false;
        RETURN;
    END IF;
    
    -- Check if key is expired
    IF key_record.expires_at IS NOT NULL AND key_record.expires_at < NOW() THEN
        RETURN QUERY SELECT false, key_record.user_id, key_record.permissions, key_record.rate_limit, true, key_record.is_active;
        RETURN;
    END IF;
    
    -- Update last_used_at and usage_count
    UPDATE api_keys 
    SET 
        last_used = NOW(),
        usage_count = usage_count + 1
    WHERE id = key_record.id;
    
    -- Return valid key info
    RETURN QUERY SELECT true, key_record.user_id, key_record.permissions, key_record.rate_limit, false, key_record.is_active;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check rate limit for an API key
CREATE OR REPLACE FUNCTION check_rate_limit(key_hash_val TEXT, window_minutes INTEGER DEFAULT 60)
RETURNS TABLE (
    allowed BOOLEAN,
    current_usage INTEGER,
    limit_value INTEGER,
    reset_time TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    api_key_record RECORD;
    current_window_usage INTEGER;
    window_start TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Calculate window start time
    window_start := NOW() - (window_minutes || ' minutes')::INTERVAL;
    
    -- Get API key info
    SELECT ak.id, ak.rate_limit
    INTO api_key_record
    FROM api_keys ak
    WHERE ak.key_hash = key_hash_val;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0, 0, NOW()::TIMESTAMP WITH TIME ZONE;
        RETURN;
    END IF;
    
    -- Count usage in current window
    SELECT COUNT(*)::INTEGER
    INTO current_window_usage
    FROM api_requests ar
    WHERE ar.api_key_id = api_key_record.id
        AND ar.created_at >= window_start;
    
    -- Check if under limit
    IF current_window_usage < api_key_record.rate_limit THEN
        RETURN QUERY SELECT true, current_window_usage, api_key_record.rate_limit, (window_start + (window_minutes || ' minutes')::INTERVAL);
    ELSE
        RETURN QUERY SELECT false, current_window_usage, api_key_record.rate_limit, (window_start + (window_minutes || ' minutes')::INTERVAL);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log API request
CREATE OR REPLACE FUNCTION log_api_request(
    p_api_key_id UUID,
    p_user_id UUID,
    p_method TEXT,
    p_endpoint TEXT,
    p_headers JSONB DEFAULT NULL,
    p_body TEXT DEFAULT NULL,
    p_status_code INTEGER DEFAULT NULL,
    p_response_body TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    request_id UUID;
BEGIN
    INSERT INTO api_requests (
        api_key_id,
        user_id,
        method,
        endpoint,
        headers,
        body,
        status_code,
        response_body
    ) VALUES (
        p_api_key_id,
        p_user_id,
        p_method,
        p_endpoint,
        p_headers,
        p_body,
        p_status_code,
        p_response_body
    ) RETURNING id INTO request_id;
    
    RETURN request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION generate_api_key(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION hash_api_key(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION validate_api_key(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION log_api_request(UUID, UUID, TEXT, TEXT, JSONB, TEXT, INTEGER, TEXT) TO authenticated, service_role;