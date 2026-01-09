-- Enhance meetings_waitlist table for user access management
-- Adds user linking and conversion tracking capabilities

-- Add new columns for user access management
ALTER TABLE meetings_waitlist
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS magic_link_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS magic_link_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS access_granted_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_waitlist_user_id ON meetings_waitlist(user_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_status_user ON meetings_waitlist(status, user_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_converted ON meetings_waitlist(converted_at) WHERE converted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_waitlist_magic_link_expiry ON meetings_waitlist(magic_link_expires_at)
  WHERE magic_link_expires_at IS NOT NULL;

-- Update the status enum if 'converted' doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'converted'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'waitlist_status')
  ) THEN
    ALTER TYPE waitlist_status ADD VALUE 'converted';
  END IF;
END
$$;

-- Trigger function to automatically link users to waitlist entries
CREATE OR REPLACE FUNCTION link_user_to_waitlist()
RETURNS TRIGGER AS $$
DECLARE
  waitlist_entry RECORD;
BEGIN
  -- Find waitlist entry by email where status='released' or 'pending' and no user linked
  SELECT * INTO waitlist_entry
  FROM meetings_waitlist
  WHERE LOWER(email) = LOWER(NEW.email)
    AND status IN ('released', 'pending')
    AND user_id IS NULL
  ORDER BY
    CASE WHEN status = 'released' THEN 1 ELSE 2 END, -- Prioritize 'released' status
    created_at ASC
  LIMIT 1;

  IF FOUND THEN
    -- Link user to waitlist entry
    UPDATE meetings_waitlist
    SET
      user_id = NEW.id,
      status = 'converted',
      converted_at = now()
    WHERE id = waitlist_entry.id;

    -- Create waitlist onboarding progress record
    INSERT INTO waitlist_onboarding_progress (
      user_id,
      waitlist_entry_id,
      account_created_at
    )
    VALUES (
      NEW.id,
      waitlist_entry.id,
      now()
    )
    ON CONFLICT (user_id) DO NOTHING;

    RAISE LOG 'Linked user % to waitlist entry %', NEW.id, waitlist_entry.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger (drop first if exists to avoid conflicts)
DROP TRIGGER IF EXISTS auto_link_user_to_waitlist ON auth.users;

CREATE TRIGGER auto_link_user_to_waitlist
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION link_user_to_waitlist();

-- Function to bulk grant access to waitlist entries
CREATE OR REPLACE FUNCTION bulk_grant_waitlist_access(
  p_entry_ids UUID[],
  p_admin_user_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  granted_count INTEGER := 0;
  failed_count INTEGER := 0;
  result_details JSON;
  entry RECORD;
  error_messages TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Validate admin permissions
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_admin_user_id AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'User % does not have admin permissions', p_admin_user_id;
  END IF;

  -- Limit to 50 entries maximum for safety
  IF array_length(p_entry_ids, 1) > 50 THEN
    RAISE EXCEPTION 'Cannot grant access to more than 50 users at once';
  END IF;

  -- Process each entry
  FOR entry IN
    SELECT id, email, name, status
    FROM meetings_waitlist
    WHERE id = ANY(p_entry_ids)
  LOOP
    BEGIN
      -- Validate entry is in 'pending' status
      IF entry.status != 'pending' THEN
        failed_count := failed_count + 1;
        error_messages := array_append(
          error_messages,
          json_build_object(
            'entry_id', entry.id,
            'email', entry.email,
            'error', 'Entry status is not pending: ' || entry.status
          )::TEXT
        );
        CONTINUE;
      END IF;

      -- Update waitlist entry to 'released'
      UPDATE meetings_waitlist
      SET
        status = 'released',
        access_granted_by = p_admin_user_id,
        admin_notes = p_admin_notes,
        magic_link_sent_at = now(),
        magic_link_expires_at = now() + INTERVAL '7 days',
        updated_at = now()
      WHERE id = entry.id;

      granted_count := granted_count + 1;

    EXCEPTION WHEN OTHERS THEN
      failed_count := failed_count + 1;
      error_messages := array_append(
        error_messages,
        json_build_object(
          'entry_id', entry.id,
          'email', entry.email,
          'error', SQLERRM
        )::TEXT
      );
    END;
  END LOOP;

  -- Build result
  result_details := json_build_object(
    'success', granted_count > 0,
    'granted', granted_count,
    'failed', failed_count,
    'total', array_length(p_entry_ids, 1),
    'errors', error_messages
  );

  RETURN result_details;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to resend magic link for a waitlist entry
CREATE OR REPLACE FUNCTION resend_waitlist_magic_link(
  p_entry_id UUID,
  p_admin_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  entry RECORD;
  result JSON;
BEGIN
  -- Validate admin permissions
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_admin_user_id AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'User % does not have admin permissions', p_admin_user_id;
  END IF;

  -- Get waitlist entry
  SELECT * INTO entry
  FROM meetings_waitlist
  WHERE id = p_entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Waitlist entry % not found', p_entry_id;
  END IF;

  -- Validate entry is in 'released' status or already converted
  IF entry.status NOT IN ('released', 'converted') THEN
    RAISE EXCEPTION 'Cannot resend magic link for entry with status: %', entry.status;
  END IF;

  -- Update magic link timestamps
  UPDATE meetings_waitlist
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get waitlist analytics
CREATE OR REPLACE FUNCTION get_waitlist_analytics()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_entries', COUNT(*),
    'by_status', json_build_object(
      'pending', COUNT(*) FILTER (WHERE status = 'pending'),
      'released', COUNT(*) FILTER (WHERE status = 'released'),
      'converted', COUNT(*) FILTER (WHERE status = 'converted')
    ),
    'conversion_rate', ROUND(
      (COUNT(*) FILTER (WHERE status = 'converted')::FLOAT /
       NULLIF(COUNT(*) FILTER (WHERE status = 'released'), 0)) * 100,
      2
    ),
    'avg_conversion_time_days', ROUND(
      AVG(EXTRACT(EPOCH FROM (converted_at - magic_link_sent_at)) / 86400),
      2
    ) FILTER (WHERE converted_at IS NOT NULL AND magic_link_sent_at IS NOT NULL),
    'expired_links', COUNT(*) FILTER (
      WHERE status = 'released'
      AND magic_link_expires_at < now()
    ),
    'recent_conversions_7d', COUNT(*) FILTER (
      WHERE status = 'converted'
      AND converted_at > now() - INTERVAL '7 days'
    )
  ) INTO result
  FROM meetings_waitlist;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON COLUMN meetings_waitlist.user_id IS 'Linked auth user ID after account creation';
COMMENT ON COLUMN meetings_waitlist.converted_at IS 'Timestamp when user successfully created account';
COMMENT ON COLUMN meetings_waitlist.magic_link_sent_at IS 'Timestamp when magic link was sent';
COMMENT ON COLUMN meetings_waitlist.magic_link_expires_at IS 'Timestamp when magic link expires (7 days from send)';
COMMENT ON COLUMN meetings_waitlist.admin_notes IS 'Admin notes added when granting access';
COMMENT ON COLUMN meetings_waitlist.access_granted_by IS 'Admin user who granted access';

COMMENT ON FUNCTION link_user_to_waitlist IS 'Automatically links new auth users to their waitlist entries by email';
COMMENT ON FUNCTION bulk_grant_waitlist_access IS 'Grant access to multiple waitlist entries (max 50 at once)';
COMMENT ON FUNCTION resend_waitlist_magic_link IS 'Resend magic link for a waitlist entry';
COMMENT ON FUNCTION get_waitlist_analytics IS 'Get aggregated waitlist analytics including conversion rates';
