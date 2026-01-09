-- Create rate_limit_attempts table for tracking authentication rate limiting
CREATE TABLE IF NOT EXISTS rate_limit_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action TEXT NOT NULL CHECK (action IN ('login', 'signup', 'password_reset')),
    identifier TEXT NOT NULL, -- email or IP address
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Index for efficient rate limit queries
    CONSTRAINT unique_rate_limit_entry UNIQUE (action, identifier, created_at)
);

-- Create index for efficient time-based queries
CREATE INDEX IF NOT EXISTS idx_rate_limit_action_identifier_time 
ON rate_limit_attempts (action, identifier, created_at DESC);

-- Create index for cleanup operations
CREATE INDEX IF NOT EXISTS idx_rate_limit_created_at 
ON rate_limit_attempts (created_at);

-- RLS policies (restrict access to service role only)
ALTER TABLE rate_limit_attempts ENABLE ROW LEVEL SECURITY;

-- Only service role can access rate limiting data
CREATE POLICY "Service role only" ON rate_limit_attempts
FOR ALL USING (auth.role() = 'service_role');

-- Add cleanup function to remove old entries (optional, can be run via cron)
CREATE OR REPLACE FUNCTION cleanup_rate_limit_attempts()
RETURNS void AS $$
BEGIN
    -- Delete entries older than 24 hours
    DELETE FROM rate_limit_attempts 
    WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 