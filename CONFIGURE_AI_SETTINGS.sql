-- Configure PostgreSQL settings for AI Edge Function calls
-- These settings are needed for the AI analysis to work

-- Set Supabase project URL
ALTER DATABASE postgres SET app.settings.supabase_url TO 'https://ewtuefzeogytgmsnkpmb.supabase.co';

-- Note: Service role key should be set as environment variable, not in database
-- The trigger will use the service_role context when executing

-- Verify settings
DO $$
BEGIN
  RAISE NOTICE 'Supabase URL configured: %', current_setting('app.settings.supabase_url', true);
  RAISE NOTICE '';
  RAISE NOTICE 'Note: Ensure service_role_key is available in function execution context';
  RAISE NOTICE 'AI analysis will now work when action items are created';
END $$;

-- Test the AI analysis manually
-- You can run this to test if it works:
-- SELECT analyze_action_item_with_ai('YOUR_ACTION_ITEM_ID'::UUID);
