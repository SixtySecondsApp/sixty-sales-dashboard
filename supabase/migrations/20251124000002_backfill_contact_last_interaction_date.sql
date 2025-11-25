-- Backfill last_interaction_date for existing contacts based on their meetings
-- This migration updates contacts' last_interaction_date using the most recent meeting they attended

-- Update contacts with their most recent meeting date via meeting_contacts junction table
UPDATE contacts c
SET last_interaction_date = subquery.latest_meeting_date
FROM (
  SELECT
    mc.contact_id,
    MAX(m.meeting_start) as latest_meeting_date
  FROM meeting_contacts mc
  JOIN meetings m ON m.id = mc.meeting_id
  WHERE m.meeting_start IS NOT NULL
  GROUP BY mc.contact_id
) subquery
WHERE c.id = subquery.contact_id
  AND (
    c.last_interaction_date IS NULL
    OR subquery.latest_meeting_date > c.last_interaction_date
  );

-- Also check for contacts linked as primary_contact on meetings directly
UPDATE contacts c
SET last_interaction_date = subquery.latest_meeting_date
FROM (
  SELECT
    m.primary_contact_id as contact_id,
    MAX(m.meeting_start) as latest_meeting_date
  FROM meetings m
  WHERE m.primary_contact_id IS NOT NULL
    AND m.meeting_start IS NOT NULL
  GROUP BY m.primary_contact_id
) subquery
WHERE c.id = subquery.contact_id
  AND (
    c.last_interaction_date IS NULL
    OR subquery.latest_meeting_date > c.last_interaction_date
  );

-- Log the update count
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM contacts
  WHERE last_interaction_date IS NOT NULL;

  RAISE NOTICE 'Updated % contacts with last_interaction_date', updated_count;
END $$;
