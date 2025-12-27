-- ============================================================================
-- Migration: Add andrew.bryce@sixtyseconds.video to internal users
-- ============================================================================
-- Issue: User andrew.bryce@sixtyseconds.video does not have internal view access
-- Solution: Add email to internal_users whitelist
-- ============================================================================

INSERT INTO internal_users (email, name, reason, is_active) VALUES
  ('andrew.bryce@sixtyseconds.video', 'Andrew Bryce', 'Founder - alternate email', true)
ON CONFLICT (email) DO UPDATE SET
  is_active = true,
  updated_at = NOW();

-- Verification
DO $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM internal_users 
    WHERE email = 'andrew.bryce@sixtyseconds.video' 
    AND is_active = true
  ) INTO v_exists;
  
  IF v_exists THEN
    RAISE NOTICE 'andrew.bryce@sixtyseconds.video added to internal users whitelist ✓';
  ELSE
    RAISE WARNING 'Failed to add andrew.bryce@sixtyseconds.video';
  END IF;
END;
$$;














