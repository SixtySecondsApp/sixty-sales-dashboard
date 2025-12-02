-- Migration: Add Display Rank to Handle Position Ties
-- Purpose: Create a view that shows unique ranks even when effective_position ties
-- Date: 2025-12-02

-- Create a view that adds a display_rank column to break ties
CREATE OR REPLACE VIEW waitlist_with_rank AS
SELECT
  *,
  -- Calculate display rank: rank by effective_position, then by created_at
  -- This ensures unique ranks even when multiple users have same effective_position
  ROW_NUMBER() OVER (
    ORDER BY
      COALESCE(effective_position, 999999) ASC,
      created_at ASC
  ) AS display_rank
FROM meetings_waitlist
WHERE status != 'declined';

-- Add helpful comment
COMMENT ON VIEW waitlist_with_rank IS 'Waitlist entries with display_rank that breaks ties by signup time';

-- Grant access to the view
GRANT SELECT ON waitlist_with_rank TO anon;
GRANT SELECT ON waitlist_with_rank TO authenticated;

-- Example usage:
-- Instead of: SELECT * FROM meetings_waitlist ORDER BY effective_position
-- Use: SELECT * FROM waitlist_with_rank ORDER BY display_rank
