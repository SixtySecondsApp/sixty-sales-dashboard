-- Fix API tables and RLS policies for frontend loading

-- 1. Create api_requests table if it doesn't exist
CREATE TABLE IF NOT EXISTS api_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  headers JSONB DEFAULT '{}',
  body JSONB,
  status_code INTEGER,
  response_body JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  response_time_ms INTEGER
);

-- 2. Create RLS policies for api_requests
ALTER TABLE api_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own api requests" ON api_requests;
CREATE POLICY "Users can read their own api requests" 
  ON api_requests FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage all api requests" ON api_requests;
CREATE POLICY "Service role can manage all api requests" 
  ON api_requests FOR ALL 
  USING (auth.role() = 'service_role');

-- 3. Fix api_keys RLS policies to allow frontend loading
DROP POLICY IF EXISTS "Users can read their own api keys" ON api_keys;
CREATE POLICY "Users can read their own api keys" 
  ON api_keys FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own api keys" ON api_keys;
CREATE POLICY "Users can create their own api keys" 
  ON api_keys FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own api keys" ON api_keys;
CREATE POLICY "Users can update their own api keys" 
  ON api_keys FOR UPDATE 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own api keys" ON api_keys;
CREATE POLICY "Users can delete their own api keys" 
  ON api_keys FOR DELETE 
  USING (auth.uid() = user_id);

-- 4. Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON api_keys TO authenticated;
GRANT SELECT, INSERT ON api_requests TO authenticated;

-- 5. Verify the test API key is accessible
SELECT 
  'API Key Access Test' as test_name,
  name,
  key_preview,
  is_active,
  user_id = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459' as correct_user
FROM api_keys 
WHERE name = 'Test Suite Key - Known Value';

-- 6. Create a simple function to get API keys for the current user
CREATE OR REPLACE FUNCTION get_user_api_keys()
RETURNS TABLE(
  id UUID,
  name TEXT,
  key_preview TEXT,
  permissions JSONB,
  rate_limit INTEGER,
  is_active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  last_used TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER
) 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY 
  SELECT 
    ak.id,
    ak.name,
    ak.key_preview,
    ak.permissions,
    ak.rate_limit,
    ak.is_active,
    ak.created_at,
    ak.last_used,
    ak.usage_count
  FROM api_keys ak
  WHERE ak.user_id = auth.uid()
    AND ak.is_active = true
  ORDER BY ak.created_at DESC;
END $$;

SELECT '🔧 API tables and RLS policies fixed!' as result;