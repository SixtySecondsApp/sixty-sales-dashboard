-- Fix team_meeting_analytics view to work with organization-based data
--
-- Problem: Meetings synced from Fathom have owner_user_id set to the Fathom account owner,
-- which may be different from the app user who triggered the sync.
--
-- Solution: Aggregate meetings by org_id, showing combined org metrics per user.
-- Each org member sees the same totals since meetings belong to the org, not individuals.

DROP VIEW IF EXISTS team_meeting_analytics;

-- Create the view that shows org-level meeting aggregates for each member
-- All members of the same org will see the same meeting totals
CREATE OR REPLACE VIEW team_meeting_analytics AS
SELECT
  p.id as user_id,
  COALESCE(
    NULLIF(TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))), ''),
    p.email
  ) as full_name,
  p.email,
  om.org_id,
  -- Aggregate all meetings in the organization (shared across all org members)
  COUNT(m.id) as total_meetings,
  AVG(m.sentiment_score) as avg_sentiment,
  AVG(m.talk_time_rep_pct) as avg_talk_time,
  AVG(m.coach_rating) as avg_coach_rating,
  COUNT(CASE WHEN m.sentiment_score > 0.2 THEN 1 END) as positive_meetings,
  COUNT(CASE WHEN m.sentiment_score < -0.2 THEN 1 END) as negative_meetings,
  SUM(m.duration_minutes) as total_duration_minutes,
  MAX(m.meeting_start) as last_meeting_date,
  MIN(m.meeting_start) as first_meeting_date
FROM profiles p
-- Join to get the user's organization membership
INNER JOIN organization_memberships om ON om.user_id = p.id
-- Join meetings that belong to the same organization (via org_id)
LEFT JOIN meetings m ON m.org_id = om.org_id
  AND (m.meeting_start >= NOW() - INTERVAL '30 days' OR m.meeting_start IS NULL)
GROUP BY p.id, p.first_name, p.last_name, p.email, om.org_id;

COMMENT ON VIEW team_meeting_analytics IS 'Org-level meeting metrics for each team member - aggregates all meetings in the organization';
