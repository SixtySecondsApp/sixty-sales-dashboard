-- Fix Edge Function authentication issue
-- The problem is Supabase is requiring JWT auth before our function runs

-- 1. Check if there are any RLS policies on tables that might be blocking
-- Let's see what RLS policies exist that might interfere
SELECT 
  '=== CHECKING RLS POLICIES THAT MIGHT BLOCK EDGE FUNCTIONS ===' as section,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('api_keys', 'contacts', 'companies', 'deals', 'tasks', 'meetings', 'activities')
ORDER BY tablename, policyname;

-- 2. Create a policy that allows service role access for our Edge Functions
-- The Edge Functions run as service_role, so we need to allow that

-- Drop and recreate api_keys policies to ensure service role access
DROP POLICY IF EXISTS "Service role full access" ON api_keys;
CREATE POLICY "Service role full access" 
  ON api_keys FOR ALL 
  TO service_role 
  USING (true)
  WITH CHECK (true);

-- Ensure service role can access all tables needed by the API
DROP POLICY IF EXISTS "Service role contacts access" ON contacts;
CREATE POLICY "Service role contacts access" 
  ON contacts FOR ALL 
  TO service_role 
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role companies access" ON companies;  
CREATE POLICY "Service role companies access" 
  ON companies FOR ALL 
  TO service_role 
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role deals access" ON deals;
CREATE POLICY "Service role deals access" 
  ON deals FOR ALL 
  TO service_role 
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role tasks access" ON tasks;
CREATE POLICY "Service role tasks access" 
  ON tasks FOR ALL 
  TO service_role 
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role meetings access" ON meetings;
CREATE POLICY "Service role meetings access" 
  ON meetings FOR ALL 
  TO service_role 
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role activities access" ON activities;
CREATE POLICY "Service role activities access" 
  ON activities FOR ALL 
  TO service_role 
  USING (true)
  WITH CHECK (true);

-- 3. Ensure all necessary grants are in place
GRANT ALL ON api_keys TO service_role;
GRANT ALL ON contacts TO service_role;
GRANT ALL ON companies TO service_role;
GRANT ALL ON deals TO service_role;
GRANT ALL ON tasks TO service_role;
GRANT ALL ON meetings TO service_role;
GRANT ALL ON activities TO service_role;

-- 4. Test the API key validation with service role context
SET ROLE service_role;
SELECT 
  '=== TESTING AS SERVICE ROLE ===' as test,
  is_valid,
  user_id,
  permissions
FROM validate_api_key('sk_test_api_key_for_suite_12345')
LIMIT 1;

RESET ROLE;

SELECT '🔧 Edge Function auth policies updated!' as result;