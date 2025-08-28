-- API Keys System Production Fix V3
-- Run this in Supabase Dashboard > SQL Editor
-- This version fixes all column naming issues

-- Step 1: Drop existing functions if they exist (to avoid parameter name conflicts)
DROP FUNCTION IF EXISTS generate_api_key(text);
DROP FUNCTION IF EXISTS hash_api_key(text);

-- Step 2: Add missing columns to api_keys table if it exists
DO $$
BEGIN
    -- Check if api_keys table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_keys') THEN
        -- Add missing columns if they don't exist
        ALTER TABLE api_keys 
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
        
        ALTER TABLE api_keys 
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        
        ALTER TABLE api_keys 
        ADD COLUMN IF NOT EXISTS last_used TIMESTAMP WITH TIME ZONE;
        
        ALTER TABLE api_keys 
        ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
        
        ALTER TABLE api_keys 
        ADD COLUMN IF NOT EXISTS key_preview TEXT;
        
        ALTER TABLE api_keys 
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        
        -- Update permissions column default if needed
        ALTER TABLE api_keys 
        ALTER COLUMN permissions SET DEFAULT '[]'::jsonb;
        
        RAISE NOTICE 'api_keys table updated successfully';
    ELSE
        -- Create the table from scratch
        CREATE TABLE api_keys (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            key_hash TEXT NOT NULL UNIQUE,
            key_preview TEXT NOT NULL,
            permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
            rate_limit INTEGER NOT NULL DEFAULT 1000,
            expires_at TIMESTAMP WITH TIME ZONE,
            is_active BOOLEAN NOT NULL DEFAULT true,
            last_used TIMESTAMP WITH TIME ZONE,
            usage_count INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create indexes for better performance
        CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
        CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
        CREATE INDEX idx_api_keys_is_active ON api_keys(is_active);
        CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at);
        
        RAISE NOTICE 'api_keys table created successfully';
    END IF;
END $$;

-- Step 3: Create or replace helper functions with consistent parameter names
CREATE OR REPLACE FUNCTION generate_api_key(prefix TEXT DEFAULT 'sk')
RETURNS TEXT AS $$
DECLARE
    random_part TEXT;
BEGIN
    -- Generate a random string
    random_part := encode(gen_random_bytes(32), 'hex');
    RETURN prefix || '_' || random_part;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION hash_api_key(api_key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(digest(api_key, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Enable Row Level Security
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Step 5: Drop existing policies and recreate them
DROP POLICY IF EXISTS "Users can view their own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can create their own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can update their own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can delete their own API keys" ON api_keys;

-- Create RLS policies
CREATE POLICY "Users can view their own API keys"
    ON api_keys FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own API keys"
    ON api_keys FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys"
    ON api_keys FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys"
    ON api_keys FOR DELETE
    USING (auth.uid() = user_id);

-- Step 6: Grant necessary permissions
GRANT ALL ON api_keys TO authenticated;
GRANT ALL ON api_keys TO service_role;

-- Step 7: Create or update api_requests table for tracking
DROP TABLE IF EXISTS api_requests CASCADE;
CREATE TABLE api_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX idx_api_requests_api_key_id ON api_requests(api_key_id);
CREATE INDEX idx_api_requests_created_at ON api_requests(created_at DESC);

-- Enable RLS for api_requests
ALTER TABLE api_requests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for api_requests
CREATE POLICY "Users can view their own API requests"
    ON api_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM api_keys
            WHERE api_keys.id = api_requests.api_key_id
            AND api_keys.user_id = auth.uid()
        )
    );

-- Step 8: Create api_key_usage table for rate limiting
DROP TABLE IF EXISTS api_key_usage CASCADE;
CREATE TABLE api_key_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  -- Fixed column name
    ip_address INET,
    user_agent TEXT
);

-- Create indexes for api_key_usage
CREATE INDEX idx_api_key_usage_api_key_id ON api_key_usage(api_key_id);
CREATE INDEX idx_api_key_usage_created_at ON api_key_usage(created_at DESC);  -- Fixed column name

-- Enable RLS for api_key_usage
ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;

-- Create policies for api_key_usage
CREATE POLICY "Service role can insert usage"
    ON api_key_usage FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can view their own usage"
    ON api_key_usage FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM api_keys
            WHERE api_keys.id = api_key_usage.api_key_id
            AND api_keys.user_id = auth.uid()
        )
    );

-- Step 9: Grant permissions for new tables
GRANT ALL ON api_requests TO authenticated;
GRANT ALL ON api_requests TO service_role;
GRANT ALL ON api_key_usage TO service_role;
GRANT SELECT ON api_key_usage TO authenticated;

-- Step 10: Verify the setup
DO $$
DECLARE
    table_count INTEGER;
    column_count INTEGER;
    function_count INTEGER;
BEGIN
    -- Check tables exist
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_name IN ('api_keys', 'api_requests', 'api_key_usage')
    AND table_schema = 'public';
    
    -- Check columns exist in api_keys
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns
    WHERE table_name = 'api_keys'
    AND table_schema = 'public'
    AND column_name IN ('id', 'user_id', 'name', 'key_hash', 'key_preview', 
                        'permissions', 'rate_limit', 'expires_at', 'is_active',
                        'last_used', 'usage_count', 'created_at', 'updated_at');
    
    -- Check functions exist
    SELECT COUNT(*) INTO function_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname IN ('generate_api_key', 'hash_api_key');
    
    RAISE NOTICE '=================================';
    RAISE NOTICE 'VERIFICATION RESULTS:';
    RAISE NOTICE '=================================';
    RAISE NOTICE 'Tables found: % of 3 expected', table_count;
    RAISE NOTICE 'Columns found: % of 13 expected', column_count;
    RAISE NOTICE 'Functions found: % of 2 expected', function_count;
    
    IF table_count = 3 AND column_count = 13 AND function_count = 2 THEN
        RAISE NOTICE '✅ SUCCESS: All tables, columns, and functions are properly configured!';
    ELSE
        RAISE WARNING '⚠️ WARNING: Some components may be missing. Please check the output above.';
    END IF;
    
    RAISE NOTICE '=================================';
END $$;

-- Final status message
SELECT 
    '✅ API Keys database setup completed successfully!' as status,
    'Next step: Test API key creation using the test page' as action,
    'URL: Open test-production-api-keys.html in your browser' as test_page;