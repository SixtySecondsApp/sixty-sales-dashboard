-- ============================================================================
-- Fix trigger_roadmap_sync_webhook function - app_settings schema issue
-- ============================================================================
-- The trigger_roadmap_sync_webhook function is referencing app_settings
-- without the public schema prefix, causing errors.
-- ============================================================================

-- Drop the problematic triggers first
DROP TRIGGER IF EXISTS roadmap_sync_on_delete ON public.roadmap_suggestions;
DROP TRIGGER IF EXISTS roadmap_sync_on_insert ON public.roadmap_suggestions;
DROP TRIGGER IF EXISTS roadmap_sync_on_update ON public.roadmap_suggestions;

-- Drop the old function
DROP FUNCTION IF EXISTS trigger_roadmap_sync_webhook();
DROP FUNCTION IF EXISTS public.trigger_roadmap_sync_webhook();

-- Recreate the function with proper schema qualification
CREATE OR REPLACE FUNCTION public.trigger_roadmap_sync_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  webhook_url TEXT;
  payload JSONB;
  record_data JSONB;
BEGIN
  -- Get webhook URL from app_settings with EXPLICIT schema qualification
  SELECT value INTO webhook_url
  FROM public.app_settings
  WHERE key = 'roadmap_webhook_url';

  -- If no webhook configured, skip
  IF webhook_url IS NULL OR webhook_url = '' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  -- Build record data based on operation
  IF TG_OP = 'DELETE' THEN
    record_data := to_jsonb(OLD);
  ELSE
    record_data := to_jsonb(NEW);
  END IF;

  -- Build notification payload
  payload := jsonb_build_object(
    'event', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', record_data,
    'timestamp', now()
  );

  -- Send async HTTP request via pg_net if available
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
    RAISE WARNING 'Failed to send roadmap sync webhook: %', SQLERRM;
  END;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Recreate triggers (they were being used, so restore them)
CREATE TRIGGER roadmap_sync_on_insert
  AFTER INSERT ON public.roadmap_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_roadmap_sync_webhook();

CREATE TRIGGER roadmap_sync_on_update
  AFTER UPDATE ON public.roadmap_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_roadmap_sync_webhook();

CREATE TRIGGER roadmap_sync_on_delete
  AFTER DELETE ON public.roadmap_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_roadmap_sync_webhook();

-- ============================================================================
-- Verify
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ trigger_roadmap_sync_webhook fixed';
  RAISE NOTICE '   - Function recreated with SET search_path = public';
  RAISE NOTICE '   - All app_settings references use public.app_settings';
  RAISE NOTICE '   - Triggers recreated on roadmap_suggestions';
END $$;
