-- ============================================================================
-- MANUAL MIGRATION: Add Share Tracking for Waitlist Gamification
-- ============================================================================
-- Run this in Supabase SQL Editor to add share tracking functionality
-- This extends the existing meetings_waitlist system with analytics
-- ============================================================================

-- Drop existing objects if they exist (for clean re-runs)
DROP TABLE IF EXISTS waitlist_shares CASCADE;

-- ============================================================================
-- 1. Create Share Tracking Table
-- ============================================================================
CREATE TABLE waitlist_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to waitlist entry
  waitlist_entry_id UUID NOT NULL REFERENCES meetings_waitlist(id) ON DELETE CASCADE,

  -- Share platform tracking
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'linkedin', 'email', 'copy')),

  -- Conversion tracking
  referral_clicked BOOLEAN DEFAULT FALSE,
  referral_converted BOOLEAN DEFAULT FALSE,

  -- Timestamps
  shared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 2. Create Indexes for Performance
-- ============================================================================
CREATE INDEX idx_waitlist_shares_entry ON waitlist_shares(waitlist_entry_id);
CREATE INDEX idx_waitlist_shares_platform ON waitlist_shares(platform);
CREATE INDEX idx_waitlist_shares_clicked ON waitlist_shares(referral_clicked) WHERE referral_clicked = TRUE;
CREATE INDEX idx_waitlist_shares_converted ON waitlist_shares(referral_converted) WHERE referral_converted = TRUE;
CREATE INDEX idx_waitlist_shares_created_at ON waitlist_shares(shared_at);

-- ============================================================================
-- 3. Add Table Comments
-- ============================================================================
COMMENT ON TABLE waitlist_shares IS 'Tracks referral link sharing for waitlist gamification and viral growth analytics';
COMMENT ON COLUMN waitlist_shares.platform IS 'Platform where link was shared: twitter, linkedin, email, or copy (clipboard)';
COMMENT ON COLUMN waitlist_shares.referral_clicked IS 'Whether someone clicked the referral link';
COMMENT ON COLUMN waitlist_shares.referral_converted IS 'Whether the click converted to a signup';

-- ============================================================================
-- 4. Enable Row Level Security (RLS)
-- ============================================================================
ALTER TABLE waitlist_shares ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. Create RLS Policies
-- ============================================================================

-- Public: Anyone can insert share records (for analytics tracking)
CREATE POLICY "Anyone can track shares"
  ON waitlist_shares
  FOR INSERT
  WITH CHECK (true);

-- Users: Can view their own shares
CREATE POLICY "Users can view their own shares"
  ON waitlist_shares
  FOR SELECT
  USING (
    waitlist_entry_id IN (
      SELECT id FROM meetings_waitlist
      WHERE email = current_setting('request.jwt.claims', true)::json->>'email'
    )
    OR auth.uid() IS NULL -- Allow unauthenticated access for public lookups
  );

-- Admin: Platform admins can view all shares
CREATE POLICY "Admins can view all shares"
  ON waitlist_shares
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Admin: Platform admins can update shares (for conversion tracking)
CREATE POLICY "Admins can update shares"
  ON waitlist_shares
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- ============================================================================
-- 6. Create Helper Function for Share Analytics
-- ============================================================================
CREATE OR REPLACE FUNCTION get_share_stats(entry_id UUID)
RETURNS TABLE (
  total_shares BIGINT,
  twitter_shares BIGINT,
  linkedin_shares BIGINT,
  email_shares BIGINT,
  copy_shares BIGINT,
  clicks BIGINT,
  conversions BIGINT,
  conversion_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_shares,
    COUNT(*) FILTER (WHERE platform = 'twitter')::BIGINT as twitter_shares,
    COUNT(*) FILTER (WHERE platform = 'linkedin')::BIGINT as linkedin_shares,
    COUNT(*) FILTER (WHERE platform = 'email')::BIGINT as email_shares,
    COUNT(*) FILTER (WHERE platform = 'copy')::BIGINT as copy_shares,
    COUNT(*) FILTER (WHERE referral_clicked = TRUE)::BIGINT as clicks,
    COUNT(*) FILTER (WHERE referral_converted = TRUE)::BIGINT as conversions,
    CASE
      WHEN COUNT(*) FILTER (WHERE referral_clicked = TRUE) > 0
      THEN (COUNT(*) FILTER (WHERE referral_converted = TRUE)::NUMERIC /
            COUNT(*) FILTER (WHERE referral_clicked = TRUE)::NUMERIC * 100)
      ELSE 0
    END as conversion_rate
  FROM waitlist_shares
  WHERE waitlist_entry_id = entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. Grant Execute Permission on Function
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_share_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_share_stats(UUID) TO anon;

-- ============================================================================
-- MIGRATION COMPLETE!
-- ============================================================================
-- You can now track shares and measure viral growth. Test with:
-- INSERT INTO waitlist_shares (waitlist_entry_id, platform)
-- VALUES ('your-entry-id', 'twitter');
--
-- Get stats with:
-- SELECT * FROM get_share_stats('your-entry-id');
-- ============================================================================
