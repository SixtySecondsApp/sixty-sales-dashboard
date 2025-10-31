-- QUICK FIX: Enable pg_net Extension
-- Run this immediately in Supabase SQL Editor to fix the http_post error

-- Enable the pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA net TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA net TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA net TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA net TO service_role;
GRANT USAGE ON SCHEMA net TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO authenticated;

-- Verify it's enabled
SELECT
  extname,
  extversion,
  CASE
    WHEN extname = 'pg_net' THEN '✅ pg_net is enabled'
    ELSE 'checking...'
  END as status
FROM pg_extension
WHERE extname = 'pg_net';

-- If you see a row returned above, you're good to go!
-- If not, the extension may need to be enabled at the project level.
