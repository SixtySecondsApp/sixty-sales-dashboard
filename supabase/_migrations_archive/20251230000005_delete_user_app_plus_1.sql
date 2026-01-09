-- ============================================================================
-- Migration: Delete User app+1@sixtyseconds.video
-- ============================================================================
-- Purpose: Permanently remove test user account and all associated data.
-- The CASCADE constraints will automatically delete related records.
-- ============================================================================

DO $$
DECLARE
  v_user_id UUID;
  v_email TEXT := 'app+1@sixtyseconds.video';
  v_profile_exists BOOLEAN;
BEGIN
  -- Find the user ID
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User % not found in auth.users - may already be deleted', v_email;
  ELSE
    RAISE NOTICE 'Found user % with ID: %', v_email, v_user_id;

    -- Check if profile exists
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = v_user_id) INTO v_profile_exists;
    IF v_profile_exists THEN
      RAISE NOTICE 'Profile exists - will be cascade deleted';
    END IF;

    -- Delete from auth.users (cascades to profiles and all related tables)
    DELETE FROM auth.users WHERE id = v_user_id;

    RAISE NOTICE 'User % deleted successfully ✓', v_email;
  END IF;

  -- Also clean up internal_users table if entry exists
  DELETE FROM internal_users WHERE email = v_email;

  RAISE NOTICE 'Cleanup complete for %', v_email;
END;
$$;

-- Verification
DO $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM auth.users WHERE email = 'app+1@sixtyseconds.video'
  ) INTO v_exists;

  IF v_exists THEN
    RAISE WARNING 'User still exists - deletion may have failed!';
  ELSE
    RAISE NOTICE 'Verified: app+1@sixtyseconds.video no longer exists in auth.users ✓';
  END IF;
END;
$$;
