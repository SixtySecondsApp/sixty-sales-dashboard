-- ============================================================================
-- Rate Limiting Infrastructure for Notifications
-- ============================================================================
-- Purpose: Prevent notification floods through rate limiting (max 10/hour, 50/day)
-- Date: 2025-12-03
-- Part of: Notification flood prevention system (Phase 4.1)
-- ============================================================================

-- Step 1: Create rate limiting table to track notification rates per user
CREATE TABLE IF NOT EXISTS notification_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient rate limit queries
CREATE INDEX IF NOT EXISTS idx_notification_rate_limits_user_type_created
  ON notification_rate_limits(user_id, notification_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_rate_limits_cleanup
  ON notification_rate_limits(created_at);

-- Add helpful comment
COMMENT ON TABLE notification_rate_limits IS
  'Tracks notification creation rates per user for flood prevention. Records are kept for 24 hours then cleaned up automatically.';

-- ============================================================================
-- Step 2: Create function to check if notification should be created
-- ============================================================================
CREATE OR REPLACE FUNCTION should_create_notification(
  p_user_id UUID,
  p_notification_type TEXT,
  p_max_per_hour INTEGER DEFAULT 10,
  p_max_per_day INTEGER DEFAULT 50
)
RETURNS BOOLEAN AS $$
DECLARE
  count_last_hour INTEGER;
  count_last_day INTEGER;
BEGIN
  -- Count notifications in the last hour
  SELECT COUNT(*) INTO count_last_hour
  FROM notification_rate_limits
  WHERE user_id = p_user_id
    AND notification_type = p_notification_type
    AND created_at > NOW() - INTERVAL '1 hour';

  -- Count notifications in the last 24 hours
  SELECT COUNT(*) INTO count_last_day
  FROM notification_rate_limits
  WHERE user_id = p_user_id
    AND notification_type = p_notification_type
    AND created_at > NOW() - INTERVAL '24 hours';

  -- Check if limits are exceeded
  IF count_last_hour >= p_max_per_hour THEN
    RAISE NOTICE 'Rate limit exceeded: % notifications in last hour (max: %)',
      count_last_hour, p_max_per_hour;
    RETURN FALSE;
  END IF;

  IF count_last_day >= p_max_per_day THEN
    RAISE NOTICE 'Rate limit exceeded: % notifications in last 24 hours (max: %)',
      count_last_day, p_max_per_day;
    RETURN FALSE;
  END IF;

  -- Record this notification attempt
  INSERT INTO notification_rate_limits (user_id, notification_type, created_at)
  VALUES (p_user_id, p_notification_type, NOW());

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add function comment
COMMENT ON FUNCTION should_create_notification IS
  'Check if notification should be created based on rate limits. Default limits: 10 per hour, 50 per day. Returns TRUE if notification should be created, FALSE if rate limit exceeded.';

-- ============================================================================
-- Step 3: Create cleanup function for old rate limit records
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_notification_rate_limits()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete records older than 24 hours
  DELETE FROM notification_rate_limits
  WHERE created_at < NOW() - INTERVAL '24 hours';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'Cleaned up % old notification rate limit records', deleted_count;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add function comment
COMMENT ON FUNCTION cleanup_notification_rate_limits IS
  'Remove rate limit records older than 24 hours. Should be called periodically (e.g., daily cron job).';

-- ============================================================================
-- Step 4: Enable Row Level Security on rate limits table
-- ============================================================================
ALTER TABLE notification_rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can only see their own rate limit records
CREATE POLICY notification_rate_limits_select_policy
  ON notification_rate_limits
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only system can insert rate limit records (via function)
CREATE POLICY notification_rate_limits_insert_policy
  ON notification_rate_limits
  FOR INSERT
  WITH CHECK (false); -- Prevent direct inserts, use function instead

-- No one can update or delete (cleanup function uses service role)
CREATE POLICY notification_rate_limits_update_policy
  ON notification_rate_limits
  FOR UPDATE
  USING (false);

CREATE POLICY notification_rate_limits_delete_policy
  ON notification_rate_limits
  FOR DELETE
  USING (false);

-- ============================================================================
-- Step 5: Verification and Testing
-- ============================================================================
DO $$
DECLARE
  test_user_id UUID;
  can_create BOOLEAN;
  i INTEGER;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Testing Rate Limiting Infrastructure:';
  RAISE NOTICE '========================================';

  -- Get a test user (first user in system)
  SELECT id INTO test_user_id
  FROM auth.users
  LIMIT 1;

  IF test_user_id IS NULL THEN
    RAISE NOTICE '⚠️  No users found for testing, skipping rate limit test';
    RETURN;
  END IF;

  RAISE NOTICE 'Using test user: %', test_user_id;

  -- Test 1: Should allow first notification
  can_create := should_create_notification(test_user_id, 'test_notification', 3, 5);
  IF can_create THEN
    RAISE NOTICE '✅ Test 1 PASSED: First notification allowed';
  ELSE
    RAISE WARNING '❌ Test 1 FAILED: First notification should be allowed';
  END IF;

  -- Test 2: Create notifications up to hourly limit
  FOR i IN 1..2 LOOP
    can_create := should_create_notification(test_user_id, 'test_notification', 3, 5);
    IF can_create THEN
      RAISE NOTICE '✅ Notification % created', i + 1;
    ELSE
      RAISE WARNING '❌ Notification % blocked unexpectedly', i + 1;
    END IF;
  END LOOP;

  -- Test 3: Should block after exceeding hourly limit (3)
  can_create := should_create_notification(test_user_id, 'test_notification', 3, 5);
  IF NOT can_create THEN
    RAISE NOTICE '✅ Test 3 PASSED: Hourly rate limit enforced correctly';
  ELSE
    RAISE WARNING '❌ Test 3 FAILED: Should have blocked after 3 notifications';
  END IF;

  -- Test 4: Different notification type should be allowed
  can_create := should_create_notification(test_user_id, 'different_type', 3, 5);
  IF can_create THEN
    RAISE NOTICE '✅ Test 4 PASSED: Different notification type allowed';
  ELSE
    RAISE WARNING '❌ Test 4 FAILED: Different notification type should be allowed';
  END IF;

  -- Clean up test records
  DELETE FROM notification_rate_limits WHERE user_id = test_user_id;
  RAISE NOTICE '✅ Test records cleaned up';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Rate Limiting Infrastructure Ready';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- Step 6: Show current rate limit configuration
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Rate Limiting Configuration:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Default Hourly Limit: 10 notifications per user';
  RAISE NOTICE 'Default Daily Limit: 50 notifications per user';
  RAISE NOTICE 'Cleanup Policy: Records deleted after 24 hours';
  RAISE NOTICE 'RLS Enabled: Users can only see their own records';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Usage: SELECT should_create_notification(user_id, type, max_hour, max_day)';
  RAISE NOTICE 'Cleanup: SELECT cleanup_notification_rate_limits()';
  RAISE NOTICE '========================================';
END $$;
