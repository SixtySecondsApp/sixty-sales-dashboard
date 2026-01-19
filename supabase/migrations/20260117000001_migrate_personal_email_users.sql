-- Migration utilities for affected personal email users
-- Helps identify and migrate users who were incorrectly placed in shared personal email organizations
--
-- Views and functions for:
-- 1. Identifying affected users in shared personal email orgs
-- 2. Monitoring users without organizations
-- 3. Migrating users with their data to new organizations

-- ============================================================================
-- 1. Create view: affected_personal_email_users
-- ============================================================================
-- Identifies users in shared personal email organizations
-- (e.g., multiple Gmail users in one "Gmail" organization)

CREATE OR REPLACE VIEW "public"."affected_personal_email_users" AS
SELECT
  p.id as user_id,
  p.email,
  p.first_name,
  p.last_name,
  LOWER(SPLIT_PART(p.email, '@', 2)) as email_domain,
  o.id as shared_org_id,
  o.name as shared_org_name,
  (SELECT COUNT(*) FROM organization_memberships WHERE org_id = o.id) as members_in_org,
  p.created_at,
  om.created_at as membership_created_at
FROM profiles p
JOIN organization_memberships om ON om.user_id = p.id
JOIN organizations o ON o.id = om.org_id
WHERE
  -- Email is a personal email domain
  LOWER(SPLIT_PART(p.email, '@', 2)) IN (
    SELECT domain FROM personal_email_domains
  )
  -- Organization name is the domain name (matches the domain extraction pattern)
  AND LOWER(o.name) = LOWER(SPLIT_PART(SPLIT_PART(p.email, '@', 2), '.', 1))
  -- Organization has multiple members (indicates shared org issue)
  AND (SELECT COUNT(*) FROM organization_memberships WHERE org_id = o.id) > 1
ORDER BY p.created_at DESC, o.name;

ALTER VIEW "public"."affected_personal_email_users" OWNER TO "postgres";

COMMENT ON VIEW "public"."affected_personal_email_users" IS
'Identifies users incorrectly placed in shared personal email organizations.
Shows users in multi-member orgs named after their email domain (e.g., "Gmail" org).
Used to prioritize migration efforts for users with data.';

-- ============================================================================
-- 2. Create view: users_without_organizations
-- ============================================================================
-- Monitors users who have no organization (expected during onboarding)
-- Helps identify if personal email trigger is working correctly

CREATE OR REPLACE VIEW "public"."users_without_organizations" AS
SELECT
  p.id as user_id,
  p.email,
  p.first_name,
  p.last_name,
  LOWER(SPLIT_PART(p.email, '@', 2)) as email_domain,
  CASE
    WHEN LOWER(SPLIT_PART(p.email, '@', 2)) IN (SELECT domain FROM personal_email_domains)
      THEN 'personal_email'
    ELSE 'corporate_email'
  END as email_type,
  p.created_at,
  NOW() - p.created_at as time_without_org
FROM profiles p
LEFT JOIN organization_memberships om ON om.user_id = p.id
WHERE om.org_id IS NULL -- No organization membership
ORDER BY p.created_at DESC;

ALTER VIEW "public"."users_without_organizations" OWNER TO "postgres";

COMMENT ON VIEW "public"."users_without_organizations" IS
'Monitors users without any organization membership.
Personal email users are expected to lack orgs during onboarding.
Corporate email users should ALWAYS have orgs - investigate if they don''t.
Use to verify trigger fix is working correctly.';

-- ============================================================================
-- 3. Create migrate_personal_email_user() function
-- ============================================================================
-- Migrates a user from a shared org to a new individual organization
-- IMPORTANT: This is a manual migration function - call it per user, not in bulk
--
-- What it does:
-- 1. Creates a new organization with the user's email domain as name
-- 2. Creates a new org membership for the user as owner
-- 3. Removes user from old org membership
-- 4. Returns migration summary
--
-- Note: Data migration (contacts, deals, meetings) must be handled separately
-- after understanding the complete data model and relationships.

CREATE OR REPLACE FUNCTION "public"."migrate_personal_email_user"(p_user_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  old_org_id UUID,
  old_org_name TEXT,
  new_org_id UUID,
  new_org_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_email TEXT;
  v_user_org_id UUID;
  v_user_org_name TEXT;
  v_new_org_id UUID;
  v_new_org_name TEXT;
  v_error_msg TEXT;
BEGIN
  -- Only admins can run this function
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RETURN QUERY SELECT
      false,
      'Unauthorized: only admins can migrate users'::TEXT,
      NULL::UUID,
      NULL::TEXT,
      NULL::UUID,
      NULL::TEXT;
    RETURN;
  END IF;

  -- Get user's email and current org
  SELECT p.email INTO v_user_email FROM profiles p WHERE p.id = p_user_id;

  IF v_user_email IS NULL THEN
    RETURN QUERY SELECT
      false,
      'User not found'::TEXT,
      NULL::UUID,
      NULL::TEXT,
      NULL::UUID,
      NULL::TEXT;
    RETURN;
  END IF;

  -- Get user's current organization
  SELECT om.org_id, o.name INTO v_user_org_id, v_user_org_name
  FROM organization_memberships om
  JOIN organizations o ON o.id = om.org_id
  WHERE om.user_id = p_user_id
  LIMIT 1;

  IF v_user_org_id IS NULL THEN
    RETURN QUERY SELECT
      false,
      'User has no organization'::TEXT,
      NULL::UUID,
      NULL::TEXT,
      NULL::UUID,
      NULL::TEXT;
    RETURN;
  END IF;

  -- Create new organization with user's email domain and username
  -- Extract username (part before @) and domain (part after @)
  v_new_org_name := INITCAP(SPLIT_PART(SPLIT_PART(v_user_email, '@', 2), '.', 1)) || ' (' || SPLIT_PART(v_user_email, '@', 1) || ')';

  BEGIN
    INSERT INTO organizations (name, created_by, is_active, created_at, updated_at)
    VALUES (v_new_org_name, p_user_id, true, NOW(), NOW())
    RETURNING id INTO v_new_org_id;
  EXCEPTION WHEN OTHERS THEN
    v_error_msg := SQLERRM;
    RETURN QUERY SELECT
      false,
      'Failed to create new organization: ' || v_error_msg::TEXT,
      v_user_org_id,
      v_user_org_name,
      NULL::UUID,
      NULL::TEXT;
    RETURN;
  END;

  -- Add user as owner of new organization
  INSERT INTO organization_memberships (org_id, user_id, role, created_at, updated_at)
  VALUES (v_new_org_id, p_user_id, 'owner', NOW(), NOW());

  -- Remove user from old organization
  DELETE FROM organization_memberships
  WHERE org_id = v_user_org_id AND user_id = p_user_id;

  -- Return success
  RETURN QUERY SELECT
    true,
    'Migration completed successfully - user moved to new organization'::TEXT,
    v_user_org_id,
    v_user_org_name,
    v_new_org_id,
    v_new_org_name;

EXCEPTION WHEN OTHERS THEN
  v_error_msg := SQLERRM;
  RETURN QUERY SELECT
    false,
    'Migration failed: ' || v_error_msg::TEXT,
    v_user_org_id,
    v_user_org_name,
    NULL::UUID,
    NULL::TEXT;
END;
$$;

ALTER FUNCTION "public"."migrate_personal_email_user"(UUID) OWNER TO "postgres";

COMMENT ON FUNCTION "public"."migrate_personal_email_user"(UUID) IS
'Migrate a user from a shared personal email org to their own individual organization.
IMPORTANT: This is a MANUAL migration - call per user, not in bulk.

What it does:
1. Creates new org named "[domain] (username)"
2. Removes user from old shared org
3. Adds user as owner of new org
4. Returns migration summary

Note: Data relationships (contacts, deals, etc.) are tied to company_id/owner_id, not org_id.
Users retain access to their existing data through those relationships.

Usage:
  SELECT migrate_personal_email_user(''<user-uuid>'');

Only admins can call this function.';

-- ============================================================================
-- 4. Create single_member_personal_email_orgs view
-- ============================================================================
-- Identifies organizations that were auto-created for personal emails
-- but only have a single member (safe to leave as-is or delete)

CREATE OR REPLACE VIEW "public"."single_member_personal_email_orgs" AS
SELECT
  o.id as org_id,
  o.name as org_name,
  LOWER(SPLIT_PART(o.name, '.', 1)) as inferred_domain,
  p.id as only_member_user_id,
  p.email as only_member_email,
  o.created_at,
  om.created_at as membership_created_at
FROM organizations o
JOIN organization_memberships om ON om.org_id = o.id
JOIN profiles p ON p.id = om.user_id
WHERE
  -- Org name matches a personal email domain
  LOWER(o.name) IN (
    SELECT LOWER(domain) FROM personal_email_domains
  )
  -- Organization has exactly one member
  AND (SELECT COUNT(*) FROM organization_memberships WHERE org_id = o.id) = 1
ORDER BY o.created_at DESC;

ALTER VIEW "public"."single_member_personal_email_orgs" OWNER TO "postgres";

COMMENT ON VIEW "public"."single_member_personal_email_orgs" IS
'Shows single-member organizations that were auto-created for personal email domains.
These are NOT problematic (only one user) but can be cleaned up if desired.
Good baseline to compare against affected_personal_email_users.';
