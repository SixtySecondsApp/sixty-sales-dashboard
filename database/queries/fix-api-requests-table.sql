-- Fix api_requests table structure

-- 1. First, let's see what the current table structure is
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'api_requests' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Drop existing policies first
DROP POLICY IF EXISTS "Users can read their own api requests" ON api_requests;
DROP POLICY IF EXISTS "Service role can manage all api requests" ON api_requests;

-- 3. Add missing columns if they don't exist
DO $$
BEGIN
  -- Add user_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'api_requests' 
      AND column_name = 'user_id'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE api_requests ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  -- Add other missing columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'api_requests' 
      AND column_name = 'response_time_ms'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE api_requests ADD COLUMN response_time_ms INTEGER;
  END IF;
END $$;

-- 4. Create simpler RLS policies
CREATE POLICY "Allow authenticated users to read api_requests" 
  ON api_requests FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "Allow service role full access to api_requests" 
  ON api_requests FOR ALL 
  TO service_role
  USING (true);

-- 5. Fix api_keys policies (simpler version)
DROP POLICY IF EXISTS "Users can read their own api keys" ON api_keys;
CREATE POLICY "Allow authenticated users to read api_keys" 
  ON api_keys FOR SELECT 
  TO authenticated
  USING (true);

-- 6. Grant permissions
GRANT ALL ON api_keys TO authenticated;
GRANT ALL ON api_requests TO authenticated;

SELECT '✅ API table fixes applied!' as result;