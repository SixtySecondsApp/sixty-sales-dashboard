-- =====================================================
-- ADD POINTS SYSTEM TO WAITLIST
-- =====================================================
-- Adds total_points column and updates position calculation
-- to use points instead of just referral_count

-- Step 1: Add new columns
ALTER TABLE meetings_waitlist
ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0;

ALTER TABLE meetings_waitlist
ADD COLUMN IF NOT EXISTS linkedin_boost_claimed BOOLEAN DEFAULT FALSE;

-- Step 2: Create function to calculate total points
-- Points = (referral_count * 5) + (linkedin_boost_claimed ? 50 : 0)
CREATE OR REPLACE FUNCTION calculate_total_points()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate total points
  NEW.total_points := (COALESCE(NEW.referral_count, 0) * 5) +
                      (CASE WHEN NEW.linkedin_boost_claimed THEN 50 ELSE 0 END);

  -- Recalculate effective position based on total points
  -- Formula: effective_position = MAX(1, signup_position - total_points)
  NEW.effective_position := GREATEST(1, NEW.signup_position - NEW.total_points);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger to auto-calculate points on insert/update
DROP TRIGGER IF EXISTS calculate_points_trigger ON meetings_waitlist;
CREATE TRIGGER calculate_points_trigger
BEFORE INSERT OR UPDATE OF referral_count, linkedin_boost_claimed, signup_position
ON meetings_waitlist
FOR EACH ROW
EXECUTE FUNCTION calculate_total_points();

-- Step 4: Temporarily disable admin action logging trigger
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'log_admin_action_trigger') THEN
    ALTER TABLE meetings_waitlist DISABLE TRIGGER log_admin_action_trigger;
  END IF;
END $$;

-- Step 5: Backfill total_points for existing entries
UPDATE meetings_waitlist
SET total_points = (COALESCE(referral_count, 0) * 5) +
                   (CASE WHEN linkedin_boost_claimed THEN 50 ELSE 0 END);

-- Step 6: Recalculate effective_position based on total_points
UPDATE meetings_waitlist
SET effective_position = GREATEST(1, signup_position - total_points);

-- Step 7: Re-enable admin action logging trigger
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'log_admin_action_trigger') THEN
    ALTER TABLE meetings_waitlist ENABLE TRIGGER log_admin_action_trigger;
  END IF;
END $$;

-- Step 8: Verify the changes
SELECT
  full_name,
  signup_position,
  effective_position,
  referral_count,
  linkedin_boost_claimed,
  total_points,
  signup_position - effective_position as positions_moved
FROM meetings_waitlist
ORDER BY effective_position ASC, signup_position ASC
LIMIT 10;
