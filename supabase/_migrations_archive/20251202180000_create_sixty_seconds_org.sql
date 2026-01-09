-- Create 'Sixty Seconds' Organization for @sixtyseconds.video email accounts
-- This migration:
-- 1. Creates a 'Sixty Seconds' organization
-- 2. Finds all users with @sixtyseconds.video email addresses
-- 3. Adds them as owners of the Sixty Seconds organization

DO $$
DECLARE
  sixty_seconds_org_id UUID;
  user_record RECORD;
  user_count INTEGER := 0;
BEGIN
  -- Create Sixty Seconds organization
  INSERT INTO organizations (name, created_by, is_active)
  VALUES ('Sixty Seconds', NULL, true)
  ON CONFLICT DO NOTHING
  RETURNING id INTO sixty_seconds_org_id;

  -- If organization already exists, get its ID
  IF sixty_seconds_org_id IS NULL THEN
    SELECT id INTO sixty_seconds_org_id FROM organizations WHERE name = 'Sixty Seconds' LIMIT 1;
  END IF;

  RAISE NOTICE 'Sixty Seconds organization ID: %', sixty_seconds_org_id;

  -- Find all users with @sixtyseconds.video email addresses
  -- Check both auth.users.email and profiles.email
  FOR user_record IN
    SELECT DISTINCT u.id, u.email
    FROM auth.users u
    LEFT JOIN profiles p ON p.id = u.id
    WHERE
      u.email LIKE '%@sixtyseconds.video'
      OR p.email LIKE '%@sixtyseconds.video'
    ORDER BY u.email
  LOOP
    -- Add user as owner of Sixty Seconds organization
    INSERT INTO organization_memberships (org_id, user_id, role)
    VALUES (sixty_seconds_org_id, user_record.id, 'owner')
    ON CONFLICT (org_id, user_id) DO UPDATE
    SET role = 'owner'; -- Ensure they have owner role even if already a member

    user_count := user_count + 1;
    RAISE NOTICE 'Added user % (%) to Sixty Seconds organization', user_record.email, user_record.id;
  END LOOP;

  RAISE NOTICE 'Added % users to Sixty Seconds organization', user_count;

  -- If no users found, create a warning
  IF user_count = 0 THEN
    RAISE WARNING 'No users with @sixtyseconds.video email addresses found!';
  END IF;
END $$;
