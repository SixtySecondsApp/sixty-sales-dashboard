-- =====================================================
-- Add Last Login Tracking
-- =====================================================
-- Tracks user last login for automated health refresh
-- Only refreshes health scores for active users (logged in last 7 days)

-- Add last_login_at column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_login 
ON profiles(last_login_at DESC) 
WHERE last_login_at IS NOT NULL;

-- Function to update last login when user signs in
CREATE OR REPLACE FUNCTION update_last_login()
RETURNS TRIGGER AS $$
BEGIN
  -- Update profiles table when auth.users.last_sign_in_at changes
  UPDATE profiles 
  SET last_login_at = NEW.last_sign_in_at 
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;

-- Create trigger to update last_login_at when user signs in
CREATE TRIGGER on_auth_user_login
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION update_last_login();

-- Backfill existing users with their last_sign_in_at
UPDATE profiles p
SET last_login_at = u.last_sign_in_at
FROM auth.users u
WHERE p.id = u.id 
  AND p.last_login_at IS NULL 
  AND u.last_sign_in_at IS NOT NULL;

-- Comments
COMMENT ON COLUMN profiles.last_login_at IS 'Last time user logged in, used for automated health refresh scheduling';
COMMENT ON FUNCTION update_last_login() IS 'Automatically updates profiles.last_login_at when auth.users.last_sign_in_at changes';












