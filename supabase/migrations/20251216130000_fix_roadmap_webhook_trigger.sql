-- ============================================================================
-- Fix Roadmap Webhook Trigger - app_settings reference issue
-- ============================================================================
-- Problem: A Database Webhook trigger on roadmap_suggestions is referencing
-- app_settings without the public schema prefix, causing "relation does not exist"
-- errors when inserting roadmap suggestions.
--
-- Solution: Drop any supabase_functions webhook triggers on roadmap_suggestions
-- and ensure app_settings has proper schema qualification in any functions.
-- ============================================================================

-- First, let's ensure app_settings exists with proper schema
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Drop any existing webhook triggers on roadmap_suggestions
-- These are created by Supabase Dashboard webhooks
DO $$
DECLARE
  trigger_rec RECORD;
BEGIN
  -- Find all triggers on roadmap_suggestions that might be webhook-related
  FOR trigger_rec IN
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid = 'public.roadmap_suggestions'::regclass
    AND NOT tgisinternal
    AND tgname LIKE '%supabase%' OR tgname LIKE '%webhook%' OR tgname LIKE '%http%'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.roadmap_suggestions', trigger_rec.tgname);
    RAISE NOTICE 'Dropped trigger: %', trigger_rec.tgname;
  END LOOP;
END $$;

-- List all non-internal triggers on roadmap_suggestions for debugging
DO $$
DECLARE
  trigger_rec RECORD;
BEGIN
  RAISE NOTICE 'Remaining triggers on roadmap_suggestions:';
  FOR trigger_rec IN
    SELECT tgname, proname AS function_name
    FROM pg_trigger t
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE tgrelid = 'public.roadmap_suggestions'::regclass
    AND NOT tgisinternal
  LOOP
    RAISE NOTICE '  - Trigger: %, Function: %', trigger_rec.tgname, trigger_rec.function_name;
  END LOOP;
END $$;

-- ============================================================================
-- Notification Function with proper schema qualification
-- ============================================================================
-- If you want roadmap webhook notifications, use this function instead of
-- the Dashboard webhook feature. It properly qualifies app_settings.

CREATE OR REPLACE FUNCTION public.notify_roadmap_suggestion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  webhook_url TEXT;
  payload JSONB;
BEGIN
  -- Get webhook URL from app_settings (with proper schema qualification)
  SELECT value INTO webhook_url
  FROM public.app_settings
  WHERE key = 'roadmap_webhook_url';

  -- If no webhook configured, skip notification
  IF webhook_url IS NULL OR webhook_url = '' THEN
    RETURN NEW;
  END IF;

  -- Build notification payload
  payload := jsonb_build_object(
    'event', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', to_jsonb(NEW),
    'timestamp', now()
  );

  -- Send async HTTP request via pg_net
  -- Note: This requires pg_net extension to be enabled
  BEGIN
    PERFORM net.http_post(
      url := webhook_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := payload::text
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to send roadmap webhook: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Don't automatically create the trigger - let user enable it manually if needed
-- CREATE TRIGGER roadmap_suggestion_webhook_trigger
--   AFTER INSERT ON public.roadmap_suggestions
--   FOR EACH ROW
--   EXECUTE FUNCTION public.notify_roadmap_suggestion();

-- ============================================================================
-- Verify fix
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Roadmap webhook trigger fix applied';
  RAISE NOTICE '   - app_settings table ensured';
  RAISE NOTICE '   - Webhook triggers cleaned up';
  RAISE NOTICE '   - New notify function created with proper schema';
  RAISE NOTICE '';
  RAISE NOTICE 'To enable roadmap webhooks, run:';
  RAISE NOTICE '  INSERT INTO app_settings (key, value) VALUES (''roadmap_webhook_url'', ''https://your-webhook-url'');';
  RAISE NOTICE '  CREATE TRIGGER roadmap_suggestion_webhook_trigger';
  RAISE NOTICE '    AFTER INSERT ON public.roadmap_suggestions';
  RAISE NOTICE '    FOR EACH ROW EXECUTE FUNCTION public.notify_roadmap_suggestion();';
END $$;
