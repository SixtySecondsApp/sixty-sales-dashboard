-- Fix meetings that are missing org_id
-- This updates meetings to use the owner's organization

-- Update meetings to set org_id based on owner_user_id's organization membership
UPDATE meetings m
SET org_id = (
  SELECT om.org_id
  FROM organization_memberships om
  WHERE om.user_id = m.owner_user_id
  LIMIT 1
)
WHERE m.org_id IS NULL
  AND m.owner_user_id IS NOT NULL;

-- Log the count of updated meetings
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM meetings
  WHERE org_id IS NOT NULL;

  RAISE NOTICE 'Meetings with org_id set: %', updated_count;
END $$;
