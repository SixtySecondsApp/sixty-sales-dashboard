-- ============================================================================
-- FIX: Create RPC function to claim waitlist boosts (bypasses RLS)
-- ============================================================================
--
-- PROBLEM: RLS policies block anonymous users from updating meetings_waitlist.
-- The client-side update returns "success" but affects 0 rows.
--
-- SOLUTION: Create a SECURITY DEFINER function that:
-- 1. Validates the entry exists
-- 2. Checks if boost is already claimed
-- 3. Calculates total_points and effective_position
-- 4. Updates all values in one transaction
-- 5. Returns the updated entry
--
-- HOW TO RUN: Copy and paste this SQL into the Supabase Dashboard SQL Editor
-- and execute it.
--
-- ============================================================================

-- First, ensure the email boost columns exist
ALTER TABLE meetings_waitlist ADD COLUMN IF NOT EXISTS email_boost_claimed BOOLEAN DEFAULT false;
ALTER TABLE meetings_waitlist ADD COLUMN IF NOT EXISTS email_first_share_at TIMESTAMPTZ;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS claim_waitlist_boost(UUID, TEXT);

-- Create the RPC function
CREATE OR REPLACE FUNCTION claim_waitlist_boost(
  p_entry_id UUID,
  p_platform TEXT -- 'twitter', 'linkedin', or 'email'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry RECORD;
  v_new_total_points INTEGER;
  v_new_effective_position INTEGER;
  v_already_claimed BOOLEAN;
BEGIN
  -- Validate platform
  IF p_platform NOT IN ('twitter', 'linkedin', 'email') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid platform. Must be twitter, linkedin, or email.'
    );
  END IF;

  -- Fetch the entry with row lock to prevent race conditions
  SELECT
    id,
    signup_position,
    effective_position,
    total_points,
    referral_count,
    twitter_boost_claimed,
    linkedin_boost_claimed,
    email_boost_claimed
  INTO v_entry
  FROM meetings_waitlist
  WHERE id = p_entry_id
  FOR UPDATE;

  -- Check if entry exists
  IF v_entry.id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Entry not found'
    );
  END IF;

  -- Check if boost already claimed
  IF p_platform = 'twitter' THEN
    v_already_claimed := COALESCE(v_entry.twitter_boost_claimed, false);
  ELSIF p_platform = 'linkedin' THEN
    v_already_claimed := COALESCE(v_entry.linkedin_boost_claimed, false);
  ELSE
    v_already_claimed := COALESCE(v_entry.email_boost_claimed, false);
  END IF;

  IF v_already_claimed THEN
    RETURN json_build_object(
      'success', true,
      'boosted', false,
      'message', 'Boost already claimed',
      'entry', json_build_object(
        'total_points', v_entry.total_points,
        'effective_position', v_entry.effective_position,
        'twitter_boost_claimed', COALESCE(v_entry.twitter_boost_claimed, false),
        'linkedin_boost_claimed', COALESCE(v_entry.linkedin_boost_claimed, false),
        'email_boost_claimed', COALESCE(v_entry.email_boost_claimed, false)
      )
    );
  END IF;

  -- Calculate new total points
  -- Formula: (referrals * 5) + (twitter_boost ? 50 : 0) + (linkedin_boost ? 50 : 0) + (email_boost ? 50 : 0)
  v_new_total_points := COALESCE(v_entry.referral_count, 0) * 5;

  -- Add existing boosts
  IF COALESCE(v_entry.twitter_boost_claimed, false) THEN
    v_new_total_points := v_new_total_points + 50;
  END IF;
  IF COALESCE(v_entry.linkedin_boost_claimed, false) THEN
    v_new_total_points := v_new_total_points + 50;
  END IF;
  IF COALESCE(v_entry.email_boost_claimed, false) THEN
    v_new_total_points := v_new_total_points + 50;
  END IF;

  -- Add the NEW boost being claimed
  v_new_total_points := v_new_total_points + 50;

  -- Calculate new effective position
  -- Formula: MAX(1, signup_position - total_points)
  v_new_effective_position := GREATEST(1, COALESCE(v_entry.signup_position, v_entry.effective_position, 1) - v_new_total_points);

  -- Update the entry based on platform
  IF p_platform = 'twitter' THEN
    UPDATE meetings_waitlist
    SET
      twitter_boost_claimed = true,
      twitter_first_share_at = NOW(),
      total_points = v_new_total_points,
      effective_position = v_new_effective_position,
      updated_at = NOW()
    WHERE id = p_entry_id;
  ELSIF p_platform = 'linkedin' THEN
    UPDATE meetings_waitlist
    SET
      linkedin_boost_claimed = true,
      linkedin_first_share_at = NOW(),
      total_points = v_new_total_points,
      effective_position = v_new_effective_position,
      updated_at = NOW()
    WHERE id = p_entry_id;
  ELSE
    UPDATE meetings_waitlist
    SET
      email_boost_claimed = true,
      email_first_share_at = NOW(),
      total_points = v_new_total_points,
      effective_position = v_new_effective_position,
      updated_at = NOW()
    WHERE id = p_entry_id;
  END IF;

  -- Return success with updated values
  RETURN json_build_object(
    'success', true,
    'boosted', true,
    'entry', json_build_object(
      'total_points', v_new_total_points,
      'effective_position', v_new_effective_position,
      'twitter_boost_claimed', CASE WHEN p_platform = 'twitter' THEN true ELSE COALESCE(v_entry.twitter_boost_claimed, false) END,
      'linkedin_boost_claimed', CASE WHEN p_platform = 'linkedin' THEN true ELSE COALESCE(v_entry.linkedin_boost_claimed, false) END,
      'email_boost_claimed', CASE WHEN p_platform = 'email' THEN true ELSE COALESCE(v_entry.email_boost_claimed, false) END,
      'referral_count', COALESCE(v_entry.referral_count, 0)
    )
  );
END;
$$;

-- Grant execute permission to anonymous users
GRANT EXECUTE ON FUNCTION claim_waitlist_boost(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION claim_waitlist_boost(UUID, TEXT) TO authenticated;

-- Test the function (optional - uncomment to test)
-- SELECT claim_waitlist_boost('your-entry-id-here'::uuid, 'twitter');

-- Verify function was created
SELECT
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_name = 'claim_waitlist_boost';


-- ============================================================================
-- EMAIL INVITE RPC FUNCTION (bypasses RLS)
-- ============================================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS create_waitlist_email_invite(UUID, TEXT);

-- Create the RPC function for email invites
CREATE OR REPLACE FUNCTION create_waitlist_email_invite(
  p_entry_id UUID,
  p_email TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry RECORD;
  v_existing_invite RECORD;
  v_new_invite_id UUID;
  v_email_lower TEXT;
BEGIN
  -- Normalize email
  v_email_lower := LOWER(TRIM(p_email));

  -- Validate email format (basic check)
  IF v_email_lower !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid email format'
    );
  END IF;

  -- Check if entry exists
  SELECT id, referral_count, total_points, signup_position, effective_position
  INTO v_entry
  FROM meetings_waitlist
  WHERE id = p_entry_id;

  IF v_entry.id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Entry not found'
    );
  END IF;

  -- Check if email already invited by this entry
  SELECT id INTO v_existing_invite
  FROM waitlist_email_invites
  WHERE waitlist_entry_id = p_entry_id
    AND email = v_email_lower;

  IF v_existing_invite.id IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'This email has already been invited'
    );
  END IF;

  -- Create the invite record
  INSERT INTO waitlist_email_invites (
    waitlist_entry_id,
    email,
    invite_status
  ) VALUES (
    p_entry_id,
    v_email_lower,
    'sent'
  )
  RETURNING id INTO v_new_invite_id;

  -- Award points for the invite (5 points per email)
  UPDATE meetings_waitlist
  SET
    referral_count = COALESCE(referral_count, 0) + 1,
    total_points = COALESCE(total_points, 0) + 5,
    effective_position = GREATEST(1, COALESCE(signup_position, effective_position, 1) - (COALESCE(total_points, 0) + 5)),
    updated_at = NOW()
  WHERE id = p_entry_id;

  -- Return success with updated values
  RETURN json_build_object(
    'success', true,
    'invite_id', v_new_invite_id,
    'email', v_email_lower,
    'entry', json_build_object(
      'total_points', COALESCE(v_entry.total_points, 0) + 5,
      'effective_position', GREATEST(1, COALESCE(v_entry.signup_position, v_entry.effective_position, 1) - (COALESCE(v_entry.total_points, 0) + 5)),
      'referral_count', COALESCE(v_entry.referral_count, 0) + 1
    )
  );
END;
$$;

-- Grant execute permission to anonymous users
GRANT EXECUTE ON FUNCTION create_waitlist_email_invite(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION create_waitlist_email_invite(UUID, TEXT) TO authenticated;


-- ============================================================================
-- LINK SHARE RPC FUNCTION (tracks shares without awarding points)
-- Points are only awarded on confirmation, not on click
-- ============================================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS track_waitlist_link_share(UUID, TEXT);

-- Create the RPC function for link shares (NO points - just tracking)
CREATE OR REPLACE FUNCTION track_waitlist_link_share(
  p_entry_id UUID,
  p_platform TEXT -- 'copy', 'twitter', 'linkedin', 'email', etc.
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry RECORD;
  v_new_share_id UUID;
BEGIN
  -- Validate platform (basic check)
  IF p_platform IS NULL OR TRIM(p_platform) = '' THEN
    p_platform := 'copy';
  END IF;

  -- Check if entry exists
  SELECT id FROM meetings_waitlist WHERE id = p_entry_id INTO v_entry;

  IF v_entry.id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Entry not found'
    );
  END IF;

  -- Create the share record (no points awarded - just tracking)
  INSERT INTO waitlist_shares (
    waitlist_entry_id,
    platform,
    referral_clicked,
    referral_converted
  ) VALUES (
    p_entry_id,
    p_platform,
    false,
    false
  )
  RETURNING id INTO v_new_share_id;

  -- Return success (no points awarded)
  RETURN json_build_object(
    'success', true,
    'share_id', v_new_share_id,
    'platform', p_platform,
    'points_awarded', 0
  );
END;
$$;

-- Grant execute permission to anonymous users
GRANT EXECUTE ON FUNCTION track_waitlist_link_share(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION track_waitlist_link_share(UUID, TEXT) TO authenticated;

-- Verify all functions were created
SELECT
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_name IN ('claim_waitlist_boost', 'create_waitlist_email_invite', 'track_waitlist_link_share');
