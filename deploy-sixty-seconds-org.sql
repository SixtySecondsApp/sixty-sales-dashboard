-- Deploy Sixty Seconds Organization Setup
-- Run this entire script in your Supabase SQL Editor

-- ============================================================================
-- PART 1: Create Organization and Backfill Existing Users
-- ============================================================================

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

-- ============================================================================
-- PART 2: Set Up Auto-Assignment for Future Users
-- ============================================================================

-- Function to auto-assign users to Sixty Seconds org based on email domain
CREATE OR REPLACE FUNCTION auto_assign_to_sixty_seconds_org()
RETURNS TRIGGER AS $$
DECLARE
  sixty_seconds_org_id UUID;
BEGIN
  -- Only process @sixtyseconds.video email addresses
  IF NEW.email LIKE '%@sixtyseconds.video' THEN
    -- Get the Sixty Seconds organization ID
    SELECT id INTO sixty_seconds_org_id
    FROM organizations
    WHERE name = 'Sixty Seconds'
    LIMIT 1;

    -- If organization exists, add the user as an owner
    IF sixty_seconds_org_id IS NOT NULL THEN
      INSERT INTO organization_memberships (org_id, user_id, role)
      VALUES (sixty_seconds_org_id, NEW.id, 'owner')
      ON CONFLICT (org_id, user_id) DO NOTHING;

      RAISE NOTICE 'Auto-assigned user % to Sixty Seconds organization', NEW.email;
    ELSE
      RAISE WARNING 'Sixty Seconds organization not found for user %', NEW.email;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users for new signups
DROP TRIGGER IF EXISTS auto_assign_sixty_seconds_org_trigger ON auth.users;
CREATE TRIGGER auto_assign_sixty_seconds_org_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_to_sixty_seconds_org();

-- Also create trigger on profiles table in case email is updated there
DROP TRIGGER IF EXISTS auto_assign_sixty_seconds_org_profiles_trigger ON profiles;
CREATE TRIGGER auto_assign_sixty_seconds_org_profiles_trigger
  AFTER INSERT OR UPDATE OF email ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_to_sixty_seconds_org();

COMMENT ON FUNCTION auto_assign_to_sixty_seconds_org() IS
  'Automatically assigns users with @sixtyseconds.video email addresses to the Sixty Seconds organization';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show results
SELECT
  'Organization Created' as status,
  id,
  name,
  is_active,
  created_at
FROM organizations
WHERE name = 'Sixty Seconds';

SELECT
  'Users Assigned' as status,
  COUNT(*) as member_count
FROM organization_memberships om
JOIN organizations o ON o.id = om.org_id
WHERE o.name = 'Sixty Seconds';

SELECT
  'Triggers Created' as status,
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as enabled
FROM pg_trigger
WHERE tgname LIKE '%sixty_seconds%'
ORDER BY tgname;
