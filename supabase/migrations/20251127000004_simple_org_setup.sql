-- Simple Organization Setup for Meeting Intelligence
-- Creates a default organization and adds all users as members

DO $$
DECLARE
  default_org_id UUID;
  user_record RECORD;
BEGIN
  -- Create default organization
  INSERT INTO organizations (name, created_by, is_active)
  VALUES ('Default Organization', NULL, true)
  ON CONFLICT DO NOTHING
  RETURNING id INTO default_org_id;

  -- If organization already exists, get its ID
  IF default_org_id IS NULL THEN
    SELECT id INTO default_org_id FROM organizations WHERE name = 'Default Organization' LIMIT 1;
  END IF;

  -- Add all existing users as owners of the default organization
  FOR user_record IN
    SELECT id FROM auth.users
  LOOP
    INSERT INTO organization_memberships (org_id, user_id, role)
    VALUES (default_org_id, user_record.id, 'owner')
    ON CONFLICT (org_id, user_id) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Created default organization with ID: %', default_org_id;
END $$;
