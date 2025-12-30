-- ============================================================================
-- Migration: Exclude app@sixtyseconds.video from Internal Users
-- ============================================================================
-- Purpose: Ensure app@sixtyseconds.video is treated as an external/customer
-- account for testing purposes, not as an internal user.
-- ============================================================================

-- Remove app@sixtyseconds.video from internal_users if it exists
-- This ensures the account is treated as an external customer
DELETE FROM internal_users
WHERE email = 'app@sixtyseconds.video';

-- Verification
DO $$
DECLARE
  v_exists BOOLEAN;
  v_internal_count INTEGER;
BEGIN
  -- Check if email is in internal_users
  SELECT EXISTS(
    SELECT 1 FROM internal_users
    WHERE email = 'app@sixtyseconds.video'
  ) INTO v_exists;

  -- Get current internal users count
  SELECT COUNT(*) INTO v_internal_count FROM internal_users WHERE is_active = true;

  IF v_exists THEN
    RAISE WARNING 'app@sixtyseconds.video still exists in internal_users - deletion may have failed';
  ELSE
    RAISE NOTICE 'app@sixtyseconds.video confirmed NOT in internal_users table ✓';
    RAISE NOTICE 'This email will be treated as an external/customer account ✓';
    RAISE NOTICE 'Current active internal users count: %', v_internal_count;
  END IF;
END;
$$;

-- Add a comment to the internal_users table documenting test accounts
COMMENT ON TABLE internal_users IS 'Whitelist of users with internal (full) access.
Test accounts like app@sixtyseconds.video should NOT be in this table to simulate customer experience.';
