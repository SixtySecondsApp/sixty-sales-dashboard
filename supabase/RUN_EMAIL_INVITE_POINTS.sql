-- =====================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- =====================================================
-- This adds automatic point awarding when email invites are sent
-- Each sent invite = 1 referral point = 5 position boost

-- Function to award points when email invite is marked as sent
CREATE OR REPLACE FUNCTION award_email_invite_points()
RETURNS TRIGGER AS $$
BEGIN
  -- Only award points when status changes to 'sent'
  IF NEW.invite_status = 'sent' AND (OLD.invite_status IS NULL OR OLD.invite_status != 'sent') THEN
    UPDATE meetings_waitlist
    SET referral_count = referral_count + 1
    WHERE id = NEW.waitlist_entry_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to award points on email invite sent
DROP TRIGGER IF EXISTS award_email_points_trigger ON waitlist_email_invites;
CREATE TRIGGER award_email_points_trigger
AFTER INSERT OR UPDATE OF invite_status ON waitlist_email_invites
FOR EACH ROW
EXECUTE FUNCTION award_email_invite_points();

-- Add helpful comment
COMMENT ON FUNCTION award_email_invite_points() IS 'Awards 1 referral point (5 positions) when email invite is marked as sent';

-- Verify trigger was created
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'award_email_points_trigger';

-- Test query to see current state
SELECT
  mw.id,
  mw.full_name,
  mw.email,
  mw.referral_count,
  mw.effective_position,
  COUNT(wei.id) as email_invites_sent
FROM meetings_waitlist mw
LEFT JOIN waitlist_email_invites wei ON wei.waitlist_entry_id = mw.id AND wei.invite_status = 'sent'
GROUP BY mw.id, mw.full_name, mw.email, mw.referral_count, mw.effective_position
ORDER BY mw.created_at DESC
LIMIT 10;
