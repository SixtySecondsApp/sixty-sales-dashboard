-- ============================================================================
-- Fix resend_waitlist_magic_link function
-- Issue: Function references 'profiles' table without schema prefix
-- Solution: Use is_admin_optimized() function instead of direct profiles query
-- ============================================================================

-- Recreate the function with proper admin check
CREATE OR REPLACE FUNCTION public.resend_waitlist_magic_link(
  p_entry_id UUID,
  p_admin_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entry RECORD;
  result JSON;
BEGIN
  -- Validate admin permissions using the optimized function
  IF NOT public.is_admin_optimized() THEN
    RAISE EXCEPTION 'User % does not have admin permissions', p_admin_user_id;
  END IF;

  -- Get waitlist entry
  SELECT * INTO entry
  FROM public.meetings_waitlist
  WHERE id = p_entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Waitlist entry % not found', p_entry_id;
  END IF;

  -- Validate entry is in 'released' status or already converted
  IF entry.status NOT IN ('released', 'converted') THEN
    RAISE EXCEPTION 'Cannot resend magic link for entry with status: %', entry.status;
  END IF;

  -- Update magic link timestamps
  UPDATE public.meetings_waitlist
  SET
    magic_link_sent_at = now(),
    magic_link_expires_at = now() + INTERVAL '7 days',
    updated_at = now()
  WHERE id = p_entry_id;

  -- Build result
  result := json_build_object(
    'success', true,
    'entry_id', p_entry_id,
    'email', entry.email,
    'expires_at', now() + INTERVAL '7 days'
  );

  RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.resend_waitlist_magic_link(UUID, UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.resend_waitlist_magic_link IS 'Resend magic link for a waitlist entry - uses is_admin_optimized() for permission check';
