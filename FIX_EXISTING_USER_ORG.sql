-- =====================================================
-- FIX: Create organization for existing user
-- =====================================================
-- If a user signed up while the trigger was broken,
-- they may not have an organization created.
--
-- Run this AFTER running FIX_ORG_TRIGGER_FINAL.sql
-- to create orgs for any users missing them.

-- 1. First, check users without organizations
SELECT
  p.id as user_id,
  p.email,
  p.first_name,
  p.last_name,
  p.created_at,
  (SELECT COUNT(*) FROM organization_memberships WHERE user_id = p.id) as membership_count
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM organization_memberships om WHERE om.user_id = p.id
)
ORDER BY p.created_at DESC;

-- 2. Create organizations for users who don't have them
-- This uses the same logic as the trigger
DO $$
DECLARE
  r RECORD;
  v_org_id UUID;
  v_org_name TEXT;
  v_full_name TEXT;
  v_created_count INT := 0;
BEGIN
  FOR r IN
    SELECT p.id, p.email, p.first_name, p.last_name
    FROM profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM organization_memberships om WHERE om.user_id = p.id
    )
  LOOP
    -- Build full name from first_name and last_name
    v_full_name := TRIM(COALESCE(r.first_name, '') || ' ' || COALESCE(r.last_name, ''));

    -- Generate org name
    IF LENGTH(v_full_name) > 1 THEN
      v_org_name := v_full_name || '''s Organization';
    ELSIF r.email IS NOT NULL AND r.email LIKE '%@%' THEN
      v_org_name := INITCAP(SPLIT_PART(SPLIT_PART(r.email, '@', 2), '.', 1));
    ELSE
      v_org_name := 'My Organization';
    END IF;

    -- Create organization
    INSERT INTO organizations (name, created_by, is_active, created_at, updated_at)
    VALUES (v_org_name, r.id, true, NOW(), NOW())
    RETURNING id INTO v_org_id;

    -- Add user as owner
    INSERT INTO organization_memberships (org_id, user_id, role, created_at, updated_at)
    VALUES (v_org_id, r.id, 'owner', NOW(), NOW());

    v_created_count := v_created_count + 1;
    RAISE NOTICE 'Created org "%" for user % (%)', v_org_name, r.id, r.email;
  END LOOP;

  RAISE NOTICE 'Created % organizations for users without orgs', v_created_count;
END;
$$;

-- 3. Verify: Check all users now have organizations
SELECT
  p.id as user_id,
  p.email,
  TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) as full_name,
  o.id as org_id,
  o.name as org_name,
  om.role
FROM profiles p
LEFT JOIN organization_memberships om ON p.id = om.user_id
LEFT JOIN organizations o ON om.org_id = o.id
ORDER BY p.created_at DESC
LIMIT 10;
