-- Award points when email invites are successfully sent
-- Each sent invite increments referral_count by 1 (worth 5 positions)

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
