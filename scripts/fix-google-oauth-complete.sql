-- Complete Google OAuth Setup Script
-- This script safely handles existing tables and policies

-- 1. Drop existing policies if they exist
DO $$ 
BEGIN
    -- Drop policies for google_oauth_states if they exist
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'google_oauth_states' 
        AND policyname = 'Users can view their own OAuth states'
    ) THEN
        DROP POLICY "Users can view their own OAuth states" ON google_oauth_states;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'google_oauth_states' 
        AND policyname = 'Users can create their own OAuth states'
    ) THEN
        DROP POLICY "Users can create their own OAuth states" ON google_oauth_states;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'google_oauth_states' 
        AND policyname = 'Users can delete their own OAuth states'
    ) THEN
        DROP POLICY "Users can delete their own OAuth states" ON google_oauth_states;
    END IF;
    
    -- Drop policies for google_integrations if they exist
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'google_integrations' 
        AND policyname = 'Users can view their own integrations'
    ) THEN
        DROP POLICY "Users can view their own integrations" ON google_integrations;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'google_integrations' 
        AND policyname = 'Users can manage their own integrations'
    ) THEN
        DROP POLICY "Users can manage their own integrations" ON google_integrations;
    END IF;
    
    -- Drop policies for google_service_logs if they exist
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'google_service_logs' 
        AND policyname = 'Users can view logs for their integrations'
    ) THEN
        DROP POLICY "Users can view logs for their integrations" ON google_service_logs;
    END IF;
END $$;

-- 2. Create or update google_oauth_states table
CREATE TABLE IF NOT EXISTS google_oauth_states (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    state TEXT NOT NULL UNIQUE,
    code_verifier TEXT NOT NULL,
    code_challenge TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '10 minutes'
);

-- Create index if not exists
CREATE INDEX IF NOT EXISTS idx_google_oauth_states_user_id ON google_oauth_states(user_id);
CREATE INDEX IF NOT EXISTS idx_google_oauth_states_state ON google_oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_google_oauth_states_expires_at ON google_oauth_states(expires_at);

-- 3. Create or update google_integrations table
CREATE TABLE IF NOT EXISTS google_integrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    scopes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create index if not exists
CREATE INDEX IF NOT EXISTS idx_google_integrations_user_id ON google_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_google_integrations_is_active ON google_integrations(is_active);

-- 4. Create or update google_service_logs table
CREATE TABLE IF NOT EXISTS google_service_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    integration_id UUID REFERENCES google_integrations(id) ON DELETE CASCADE,
    service TEXT NOT NULL,
    action TEXT NOT NULL,
    status TEXT NOT NULL,
    request_data JSONB,
    response_data JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index if not exists
CREATE INDEX IF NOT EXISTS idx_google_service_logs_integration_id ON google_service_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_google_service_logs_created_at ON google_service_logs(created_at);

-- 5. Enable RLS on all tables
ALTER TABLE google_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_service_logs ENABLE ROW LEVEL SECURITY;

-- 6. Create new RLS policies
-- Policies for google_oauth_states
CREATE POLICY "Users can view their own OAuth states"
    ON google_oauth_states FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own OAuth states"
    ON google_oauth_states FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own OAuth states"
    ON google_oauth_states FOR DELETE
    USING (auth.uid() = user_id);

-- Policies for google_integrations
CREATE POLICY "Users can view their own integrations"
    ON google_integrations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own integrations"
    ON google_integrations FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policies for google_service_logs
CREATE POLICY "Users can view logs for their integrations"
    ON google_service_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM google_integrations
            WHERE google_integrations.id = google_service_logs.integration_id
            AND google_integrations.user_id = auth.uid()
        )
    );

-- 7. Create or replace RPC functions to bypass 406 error
CREATE OR REPLACE FUNCTION get_my_google_integration()
RETURNS TABLE(
    id UUID,
    user_id UUID,
    email TEXT,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    scopes TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gi.id,
        gi.user_id,
        gi.email,
        gi.access_token,
        gi.refresh_token,
        gi.expires_at,
        gi.scopes,
        gi.is_active,
        gi.created_at,
        gi.updated_at
    FROM google_integrations gi
    WHERE gi.user_id = auth.uid()
    AND gi.is_active = true
    LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION check_google_integration_exists()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM google_integrations 
        WHERE user_id = auth.uid() 
        AND is_active = true
    );
END;
$$;

CREATE OR REPLACE FUNCTION get_google_integration_by_user(p_user_id UUID)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    email TEXT,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    scopes TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only allow users to query their own integration
    IF p_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;
    
    RETURN QUERY
    SELECT 
        gi.id,
        gi.user_id,
        gi.email,
        gi.access_token,
        gi.refresh_token,
        gi.expires_at,
        gi.scopes,
        gi.is_active,
        gi.created_at,
        gi.updated_at
    FROM google_integrations gi
    WHERE gi.user_id = p_user_id
    AND gi.is_active = true
    LIMIT 1;
END;
$$;

-- 8. Clean up expired OAuth states automatically
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM google_oauth_states
    WHERE expires_at < NOW();
END;
$$;

-- 9. Create a scheduled job to cleanup expired states (if pg_cron is available)
-- Note: This requires pg_cron extension to be enabled
DO $$
BEGIN
    -- Check if pg_cron is available
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Schedule cleanup every hour
        PERFORM cron.schedule('cleanup-oauth-states', '0 * * * *', 'SELECT cleanup_expired_oauth_states();');
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Ignore if pg_cron is not available
        NULL;
END $$;

-- 10. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON google_oauth_states TO authenticated;
GRANT ALL ON google_integrations TO authenticated;
GRANT ALL ON google_service_logs TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_google_integration() TO authenticated;
GRANT EXECUTE ON FUNCTION check_google_integration_exists() TO authenticated;
GRANT EXECUTE ON FUNCTION get_google_integration_by_user(UUID) TO authenticated;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Google OAuth setup completed successfully!';
END $$;