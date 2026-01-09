-- ============================================================================
-- RPC function for incrementing invite code usage
-- Called from the main app signup form (not waitlist)
-- ============================================================================

-- Create RPC function that can be called from the client
CREATE OR REPLACE FUNCTION increment_invite_code_usage(code_value TEXT)
RETURNS VOID AS $$
BEGIN
  -- Don't track admin bypass usage
  IF UPPER(code_value) = 'SIXTY60' THEN
    RETURN;
  END IF;

  -- Increment usage count for the code
  UPDATE waitlist_invite_codes
  SET use_count = use_count + 1,
      updated_at = NOW()
  WHERE UPPER(code) = UPPER(code_value);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users (signup happens after email verification)
GRANT EXECUTE ON FUNCTION increment_invite_code_usage(TEXT) TO authenticated;

-- Also grant to anon for pre-signup validation scenarios
GRANT EXECUTE ON FUNCTION increment_invite_code_usage(TEXT) TO anon;

COMMENT ON FUNCTION increment_invite_code_usage(TEXT) IS
'Increments the usage count for an invite code. Called after successful account signup.';

-- ============================================================================
-- Add last_used_at column for better tracking
-- ============================================================================

ALTER TABLE waitlist_invite_codes
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

COMMENT ON COLUMN waitlist_invite_codes.last_used_at IS
'Timestamp of the last time this code was used for signup.';

-- Update the RPC to also track last used time
CREATE OR REPLACE FUNCTION increment_invite_code_usage(code_value TEXT)
RETURNS VOID AS $$
BEGIN
  -- Don't track admin bypass usage
  IF UPPER(code_value) = 'SIXTY60' THEN
    RETURN;
  END IF;

  -- Increment usage count and update last_used_at
  UPDATE waitlist_invite_codes
  SET use_count = use_count + 1,
      last_used_at = NOW(),
      updated_at = NOW()
  WHERE UPPER(code) = UPPER(code_value);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
