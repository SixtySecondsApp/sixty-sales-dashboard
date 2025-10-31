-- Direct pg_net Extension Enablement
-- Run this in Supabase SQL Editor as postgres user

-- Try multiple approaches to enable pg_net

-- Approach 1: Standard CREATE EXTENSION
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Approach 2: With explicit schema (if Approach 1 fails)
-- CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Approach 3: With explicit schema = net (if Approach 2 fails)
-- CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA net;

-- After successful creation, grant permissions:
DO $$
BEGIN
  -- Check if net schema exists
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'net') THEN
    -- Grant permissions
    GRANT USAGE ON SCHEMA net TO service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA net TO service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA net TO service_role;
    GRANT ALL ON ALL FUNCTIONS IN SCHEMA net TO service_role;
    GRANT USAGE ON SCHEMA net TO authenticated;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO authenticated;

    RAISE NOTICE '✅ Permissions granted on net schema';
  ELSE
    RAISE NOTICE '⚠️  net schema does not exist - extension may not be installed';
  END IF;
END $$;

-- Verify extension is enabled
SELECT
  extname,
  extversion,
  '✅ pg_net is ENABLED' as status
FROM pg_extension
WHERE extname = 'pg_net';

-- If above returns nothing, pg_net is NOT enabled
-- You MUST enable it via Supabase Dashboard → Database → Extensions
