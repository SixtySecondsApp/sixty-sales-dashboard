-- ============================================================================
-- Migration: Waitlist Slack Notification Triggers
-- ============================================================================
-- Creates database triggers to send Slack notifications for:
-- 1. New waitlist signups (AFTER INSERT)
-- 2. Referral milestones (3, 5, 10 referrals) (AFTER UPDATE)
-- 3. Tier upgrades (VIP, Priority) (AFTER UPDATE)
--
-- The daily digest is handled by a cron job, not a trigger.
-- ============================================================================

-- ============================================================================
-- Function: Notify on new waitlist signup
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_waitlist_signup()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT;
  request_id BIGINT;
BEGIN
  -- Get edge function URL from system_config
  edge_function_url := get_system_config('supabase_url') || '/functions/v1/slack-waitlist-notification';

  -- Make async HTTP request using pg_net
  SELECT extensions.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || get_system_config('service_role_key')
    ),
    body := jsonb_build_object(
      'type', 'new_signup',
      'entry_id', NEW.id
    )
  ) INTO request_id;

  RAISE NOTICE 'Queued waitlist Slack notification for new signup: entry_id=% request_id=%',
    NEW.id, request_id;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Don't fail the insert if notification fails
  RAISE WARNING 'Failed to queue waitlist Slack notification: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new signups
DROP TRIGGER IF EXISTS on_waitlist_signup ON meetings_waitlist;
CREATE TRIGGER on_waitlist_signup
  AFTER INSERT ON meetings_waitlist
  FOR EACH ROW
  EXECUTE FUNCTION notify_waitlist_signup();

-- ============================================================================
-- Function: Notify on referral milestones and tier upgrades
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_waitlist_update()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT;
  request_id BIGINT;
  old_referrals INTEGER;
  new_referrals INTEGER;
  milestone INTEGER;
  old_position INTEGER;
  new_position INTEGER;
  should_notify_referral BOOLEAN := FALSE;
  should_notify_tier BOOLEAN := FALSE;
  new_tier TEXT;
BEGIN
  -- Get referral counts
  old_referrals := COALESCE(OLD.referral_count, 0);
  new_referrals := COALESCE(NEW.referral_count, 0);

  -- Get positions
  old_position := COALESCE(OLD.effective_position, OLD.signup_position, 999999);
  new_position := COALESCE(NEW.effective_position, NEW.signup_position, 999999);

  -- Get edge function URL
  edge_function_url := get_system_config('supabase_url') || '/functions/v1/slack-waitlist-notification';

  -- Check for referral milestones: 3, 5, 10
  IF new_referrals >= 3 AND old_referrals < 3 THEN
    milestone := 3;
    should_notify_referral := TRUE;
  ELSIF new_referrals >= 5 AND old_referrals < 5 THEN
    milestone := 5;
    should_notify_referral := TRUE;
  ELSIF new_referrals >= 10 AND old_referrals < 10 THEN
    milestone := 10;
    should_notify_referral := TRUE;
  END IF;

  -- Send referral milestone notification
  IF should_notify_referral THEN
    SELECT extensions.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || get_system_config('service_role_key')
      ),
      body := jsonb_build_object(
        'type', 'referral_milestone',
        'entry_id', NEW.id,
        'milestone', milestone
      )
    ) INTO request_id;

    RAISE NOTICE 'Queued waitlist referral milestone notification: entry_id=% milestone=% request_id=%',
      NEW.id, milestone, request_id;
  END IF;

  -- Check for tier upgrades
  -- VIP: position 1-50, Priority: 51-200
  IF new_position <= 50 AND old_position > 50 THEN
    new_tier := 'VIP';
    should_notify_tier := TRUE;
  ELSIF new_position <= 200 AND old_position > 200 THEN
    new_tier := 'Priority';
    should_notify_tier := TRUE;
  END IF;

  -- Send tier upgrade notification
  IF should_notify_tier THEN
    SELECT extensions.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || get_system_config('service_role_key')
      ),
      body := jsonb_build_object(
        'type', 'tier_upgrade',
        'entry_id', NEW.id,
        'new_tier', new_tier
      )
    ) INTO request_id;

    RAISE NOTICE 'Queued waitlist tier upgrade notification: entry_id=% new_tier=% request_id=%',
      NEW.id, new_tier, request_id;
  END IF;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Don't fail the update if notification fails
  RAISE WARNING 'Failed to queue waitlist update notification: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for updates (referral milestones and tier upgrades)
DROP TRIGGER IF EXISTS on_waitlist_update ON meetings_waitlist;
CREATE TRIGGER on_waitlist_update
  AFTER UPDATE ON meetings_waitlist
  FOR EACH ROW
  EXECUTE FUNCTION notify_waitlist_update();

-- ============================================================================
-- Daily Digest Cron Job
-- ============================================================================
-- Schedule daily digest at 9 AM UK time
-- Note: During BST (British Summer Time), UK is UTC+1
-- During GMT (winter), UK is UTC+0
-- We'll schedule at 9 AM UTC which is 9 AM GMT / 10 AM BST
-- For true UK time handling, consider GitHub Actions with TZ support

-- Check if pg_cron extension is available
DO $outer$
BEGIN
  -- Try to schedule the cron job
  -- This will fail silently if pg_cron is not available
  PERFORM cron.schedule(
    'waitlist-daily-digest',
    '0 9 * * *',  -- 9 AM UTC daily
    $cron$
    SELECT extensions.http_post(
      url := get_system_config('supabase_url') || '/functions/v1/slack-waitlist-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || get_system_config('service_role_key')
      ),
      body := '{"type": "daily_digest"}'::jsonb
    );
    $cron$
  );
  RAISE NOTICE 'Scheduled waitlist daily digest cron job';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available or failed to schedule: %. Use GitHub Actions for daily digest.', SQLERRM;
END;
$outer$;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION notify_waitlist_signup IS
  'Sends Slack notification when a new user signs up for the waitlist';

COMMENT ON FUNCTION notify_waitlist_update IS
  'Sends Slack notifications for referral milestones (3, 5, 10) and tier upgrades (VIP, Priority)';

COMMENT ON TRIGGER on_waitlist_signup ON meetings_waitlist IS
  'Triggers Slack notification on new waitlist signup';

COMMENT ON TRIGGER on_waitlist_update ON meetings_waitlist IS
  'Triggers Slack notifications for referral milestones and tier upgrades';
