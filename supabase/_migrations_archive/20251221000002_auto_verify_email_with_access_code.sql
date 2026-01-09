-- ============================================================================
-- Migration: Auto-Verify Email for Users with Valid Access Codes
-- ============================================================================
-- Updates the handle_new_user function to auto-verify email when user
-- signs up with a valid access code (stored in user metadata)
-- ============================================================================

-- Function to auto-verify email for users with valid access codes
-- This runs after auth.users is created and checks for waitlist entry
CREATE OR REPLACE FUNCTION auto_verify_email_for_access_code_user()
RETURNS TRIGGER AS $$
DECLARE
  v_has_waitlist_entry BOOLEAN;
BEGIN
  -- Check if user is linked to a waitlist entry (indicates valid access code was used)
  -- Waitlist entries are linked by email when user signs up
  SELECT EXISTS (
    SELECT 1 FROM meetings_waitlist
    WHERE LOWER(email) = LOWER(NEW.email)
      AND (user_id = NEW.id OR user_id IS NULL)
      AND status IN ('released', 'pending', 'converted')
  ) INTO v_has_waitlist_entry;

  -- If user has waitlist entry, auto-verify email
  IF v_has_waitlist_entry THEN
    -- Auto-confirm email by updating auth.users
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
    WHERE id = NEW.id AND email_confirmed_at IS NULL;
    
    RAISE NOTICE 'Auto-verified email for user % (has waitlist entry)', NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-verify email after auth.users is created
DROP TRIGGER IF EXISTS auto_verify_email_on_user_create ON auth.users;
CREATE TRIGGER auto_verify_email_on_user_create
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_verify_email_for_access_code_user();

COMMENT ON FUNCTION auto_verify_email_for_access_code_user() IS
  'Auto-verifies email for users who signed up with valid access codes (linked to waitlist entry).';
