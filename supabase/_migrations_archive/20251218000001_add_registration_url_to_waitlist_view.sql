-- Add registration_url column to waitlist_with_rank view
-- This view is used by the admin panel to display waitlist entries

DROP VIEW IF EXISTS waitlist_with_rank CASCADE;

CREATE VIEW waitlist_with_rank
WITH (security_invoker = true) AS
SELECT
  -- Core columns from initial meetings_waitlist table
  id,
  email,
  full_name,
  company_name,
  dialer_tool,
  dialer_other,
  meeting_recorder_tool,
  meeting_recorder_other,
  crm_tool,
  crm_other,
  referral_code,
  referred_by_code,
  referral_count,
  signup_position,
  effective_position,
  status,
  released_at,
  released_by,
  admin_notes,
  utm_source,
  utm_campaign,
  utm_medium,
  registration_url, -- Added: tracks which access link user registered from
  created_at,
  updated_at,
  -- User access columns (from 20251130000003_enhance_waitlist_for_access.sql)
  user_id,
  converted_at,
  magic_link_sent_at,
  magic_link_expires_at,
  access_granted_by,
  -- Gamification columns (from 20251202000003_add_waitlist_gamification.sql)
  total_points,
  linkedin_boost_claimed,
  twitter_boost_claimed,
  linkedin_share_claimed,
  linkedin_first_share_at,
  -- Additional columns that may exist
  task_manager_tool,
  task_manager_other,
  is_seeded,
  -- Calculate display rank: rank by effective_position, then by created_at
  -- This ensures unique ranks even when multiple users have same effective_position
  ROW_NUMBER() OVER (
    ORDER BY
      COALESCE(effective_position, 999999) ASC,
      created_at ASC
  ) AS display_rank
FROM meetings_waitlist
WHERE status != 'declined';

COMMENT ON VIEW waitlist_with_rank IS 'Waitlist entries with display_rank that breaks ties by signup time (includes registration_url)';

-- Grant access to the view (needs anon for public waitlist access)
GRANT SELECT ON waitlist_with_rank TO anon;
GRANT SELECT ON waitlist_with_rank TO authenticated;
GRANT SELECT ON waitlist_with_rank TO service_role;


