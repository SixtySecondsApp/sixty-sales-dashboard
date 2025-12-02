-- =====================================================
-- ADD TWITTER/X SHARE BOOST (50 POINTS)
-- =====================================================
-- Adds twitter_boost_claimed column and updates trigger
-- to include Twitter shares in points calculation

-- Step 1: Add twitter_boost_claimed column
ALTER TABLE meetings_waitlist
ADD COLUMN IF NOT EXISTS twitter_boost_claimed BOOLEAN DEFAULT FALSE;

-- Step 2: Add twitter_first_share_at timestamp
ALTER TABLE meetings_waitlist
ADD COLUMN IF NOT EXISTS twitter_first_share_at TIMESTAMP WITH TIME ZONE;

-- Step 3: Update the calculate_total_points function to include Twitter
CREATE OR REPLACE FUNCTION calculate_total_points()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate total points
  -- Points = (referral_count * 5) + (linkedin ? 50 : 0) + (twitter ? 50 : 0)
  NEW.total_points := (COALESCE(NEW.referral_count, 0) * 5) +
                      (CASE WHEN NEW.linkedin_boost_claimed THEN 50 ELSE 0 END) +
                      (CASE WHEN NEW.twitter_boost_claimed THEN 50 ELSE 0 END);

  -- Recalculate effective position based on total points
  -- Formula: effective_position = MAX(1, signup_position - total_points)
  NEW.effective_position := GREATEST(1, NEW.signup_position - NEW.total_points);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Update trigger to watch twitter_boost_claimed
DROP TRIGGER IF EXISTS calculate_points_trigger ON meetings_waitlist;
CREATE TRIGGER calculate_points_trigger
BEFORE INSERT OR UPDATE OF referral_count, linkedin_boost_claimed, twitter_boost_claimed, signup_position
ON meetings_waitlist
FOR EACH ROW
EXECUTE FUNCTION calculate_total_points();

-- Step 5: Temporarily disable admin action logging trigger
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'log_admin_action_trigger') THEN
    ALTER TABLE meetings_waitlist DISABLE TRIGGER log_admin_action_trigger;
  END IF;
END $$;

-- Step 6: Recalculate total_points for existing entries (including new Twitter boost)
UPDATE meetings_waitlist
SET total_points = (COALESCE(referral_count, 0) * 5) +
                   (CASE WHEN linkedin_boost_claimed THEN 50 ELSE 0 END) +
                   (CASE WHEN twitter_boost_claimed THEN 50 ELSE 0 END);

-- Step 7: Recalculate effective_position based on updated total_points
UPDATE meetings_waitlist
SET effective_position = GREATEST(1, signup_position - total_points);

-- Step 8: Re-enable admin action logging trigger
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'log_admin_action_trigger') THEN
    ALTER TABLE meetings_waitlist ENABLE TRIGGER log_admin_action_trigger;
  END IF;
END $$;

-- Step 9: Verify the changes
SELECT
  full_name,
  signup_position,
  effective_position,
  referral_count,
  linkedin_boost_claimed,
  twitter_boost_claimed,
  total_points,
  signup_position - effective_position as positions_moved
FROM meetings_waitlist
ORDER BY total_points DESC
LIMIT 10;
