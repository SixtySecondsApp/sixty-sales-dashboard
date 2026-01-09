-- ============================================================================
-- Migration: Add max.parish@sixtyseconds.video to internal users and grant admin access
-- ============================================================================
-- Issue: User max.parish@sixtyseconds.video needs internal view access and platform admin
-- Solution: Add email to internal_users whitelist AND set is_admin flag in profiles
-- ============================================================================

-- Step 1: Add to internal users whitelist
INSERT INTO internal_users (email, name, reason, is_active) VALUES
  ('max.parish@sixtyseconds.video', 'Max Parish', 'Team member', true)
ON CONFLICT (email) DO UPDATE SET
  is_active = true,
  updated_at = NOW();

-- Step 2: Grant platform admin access (requires both internal user + is_admin flag)
UPDATE profiles 
SET is_admin = true 
WHERE email = 'max.parish@sixtyseconds.video';

-- Verification
DO $$
DECLARE
  v_internal_exists BOOLEAN;
  v_admin_exists BOOLEAN;
BEGIN
  -- Check internal users whitelist
  SELECT EXISTS(
    SELECT 1 FROM internal_users 
    WHERE email = 'max.parish@sixtyseconds.video' 
    AND is_active = true
  ) INTO v_internal_exists;
  
  -- Check admin flag in profiles
  SELECT EXISTS(
    SELECT 1 FROM profiles 
    WHERE email = 'max.parish@sixtyseconds.video' 
    AND is_admin = true
  ) INTO v_admin_exists;
  
  IF v_internal_exists AND v_admin_exists THEN
    RAISE NOTICE 'max.parish@sixtyseconds.video added to internal users whitelist ✓';
    RAISE NOTICE 'max.parish@sixtyseconds.video granted platform admin access ✓';
  ELSIF v_internal_exists AND NOT v_admin_exists THEN
    RAISE WARNING 'Added to internal users but profile not found or admin flag not set';
  ELSIF NOT v_internal_exists THEN
    RAISE WARNING 'Failed to add max.parish@sixtyseconds.video to internal users';
  END IF;
END;
$$;
