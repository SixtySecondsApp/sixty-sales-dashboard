-- Enable pg_net extension for HTTP requests from database functions
-- This is required for the Next-Actions trigger system to call Edge Functions

-- Enable pg_net extension (allows database to make HTTP requests)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant permissions to service role
GRANT USAGE ON SCHEMA net TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA net TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA net TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA net TO service_role;

-- Grant permissions to authenticated users (for trigger execution)
GRANT USAGE ON SCHEMA net TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO authenticated;

-- Verify extension is enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
  ) THEN
    RAISE EXCEPTION 'pg_net extension failed to install';
  END IF;

  RAISE NOTICE 'pg_net extension successfully enabled';
END $$;
