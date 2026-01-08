-- Add Waitlist Invitation Tracking
-- This migration adds support for password-based invitation flow instead of magic links

-- Add invitation tracking columns to meetings_waitlist table
ALTER TABLE meetings_waitlist
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS invited_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS invitation_accepted_at TIMESTAMPTZ;

-- Add index for invited users lookup
CREATE INDEX IF NOT EXISTS idx_waitlist_invited_user
  ON meetings_waitlist(invited_user_id)
  WHERE invited_user_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN meetings_waitlist.invited_at IS
  'Timestamp when invitation was sent via Supabase admin.inviteUserByEmail()';
COMMENT ON COLUMN meetings_waitlist.invitation_expires_at IS
  'Expiration timestamp (7 days from invited_at)';
COMMENT ON COLUMN meetings_waitlist.invited_user_id IS
  'Reference to auth.users record created by invitation';
COMMENT ON COLUMN meetings_waitlist.invitation_accepted_at IS
  'Timestamp when user completed password setup and activated account';

-- Create RPC function to check if user exists by email
-- This prevents duplicate invitations and provides helpful error messages
CREATE OR REPLACE FUNCTION check_user_exists_by_email(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE LOWER(email) = LOWER(p_email)
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_user_exists_by_email TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION check_user_exists_by_email(TEXT) IS
  'Check if a user account already exists for the given email address (case-insensitive)';
