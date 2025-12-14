-- Auto-assign new @sixtyseconds.video users to Sixty Seconds organization
-- This migration creates a trigger that automatically adds users with
-- @sixtyseconds.video email addresses to the Sixty Seconds organization

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
