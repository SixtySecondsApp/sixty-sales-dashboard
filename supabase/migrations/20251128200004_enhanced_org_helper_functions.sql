-- =====================================================
-- Multi-Tenant: Enhanced Organization Helper Functions
-- =====================================================
-- These functions support strict org-based data isolation
-- and are used by RLS policies for tenant data security.

-- =====================================================
-- 1. Get User's Primary Organization
-- =====================================================
-- Returns the first organization a user joined (by created_at)
-- Used as fallback when no active org is set

CREATE OR REPLACE FUNCTION get_user_primary_org()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT org_id
    FROM organization_memberships
    WHERE user_id = auth.uid()
    ORDER BY created_at ASC
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_user_primary_org() IS 'Returns the primary (first joined) organization ID for the current user';

-- =====================================================
-- 2. Get User's Active Organization
-- =====================================================
-- Returns the user's currently active organization
-- Supports session-level org override via: SET app.current_org_id = 'uuid'
-- Falls back to primary org if no session override

CREATE OR REPLACE FUNCTION get_user_active_org()
RETURNS UUID AS $$
DECLARE
  v_session_org UUID;
  v_primary_org UUID;
BEGIN
  -- Try to get session-specific org (set by app: SET app.current_org_id = 'uuid')
  BEGIN
    v_session_org := current_setting('app.current_org_id', true)::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_session_org := NULL;
  END;

  -- Validate user has access to session org
  IF v_session_org IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE user_id = auth.uid() AND org_id = v_session_org
    ) THEN
      RETURN v_session_org;
    END IF;
    -- If session org is invalid, fall through to primary
  END IF;

  -- Fallback to primary org
  RETURN get_user_primary_org();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_user_active_org() IS 'Returns the active organization ID for current user (session override or primary)';

-- =====================================================
-- 3. Check Read Access to Organization Data
-- =====================================================
-- UPDATED: Removed NULL bypass for strict tenant isolation
-- Returns true if user can READ data from the given organization

CREATE OR REPLACE FUNCTION can_access_org_data(p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- NULL org_id should NEVER pass after migration
  -- This enforces strict tenant isolation
  IF p_org_id IS NULL THEN
    RETURN false;
  END IF;

  -- Super admins can access all organizations
  IF is_super_admin(auth.uid()) THEN
    RETURN true;
  END IF;

  -- Check if user is a member of this organization
  RETURN EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE user_id = auth.uid() AND org_id = p_org_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION can_access_org_data(UUID) IS 'Checks if current user can READ data from the specified organization';

-- =====================================================
-- 4. Check Write Access to Organization
-- =====================================================
-- Returns true if user can INSERT/UPDATE/DELETE in the organization
-- Excludes 'readonly' role members

CREATE OR REPLACE FUNCTION can_write_to_org(p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- NULL org_id should NEVER pass
  IF p_org_id IS NULL THEN
    RETURN false;
  END IF;

  -- Super admins can write anywhere
  IF is_super_admin(auth.uid()) THEN
    RETURN true;
  END IF;

  -- Check for write-capable role (not 'readonly')
  RETURN EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE user_id = auth.uid()
      AND org_id = p_org_id
      AND role IN ('owner', 'admin', 'member')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION can_write_to_org(UUID) IS 'Checks if current user can WRITE to the specified organization (owner, admin, or member)';

-- =====================================================
-- 5. Check Admin Access to Organization
-- =====================================================
-- Returns true if user is owner or admin of the organization
-- Used for team management, settings, etc.

CREATE OR REPLACE FUNCTION can_admin_org(p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_org_id IS NULL THEN
    RETURN false;
  END IF;

  IF is_super_admin(auth.uid()) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE user_id = auth.uid()
      AND org_id = p_org_id
      AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION can_admin_org(UUID) IS 'Checks if current user has admin rights in the organization (owner or admin)';

-- =====================================================
-- 6. Check Owner Access to Organization
-- =====================================================
-- Returns true if user is the owner of the organization
-- Used for critical operations like org deletion, ownership transfer

CREATE OR REPLACE FUNCTION is_org_owner(p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_org_id IS NULL THEN
    RETURN false;
  END IF;

  IF is_super_admin(auth.uid()) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE user_id = auth.uid()
      AND org_id = p_org_id
      AND role = 'owner'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_org_owner(UUID) IS 'Checks if current user is an owner of the organization';

-- =====================================================
-- 7. Get User's Organizations with Roles
-- =====================================================
-- Returns all organizations the user belongs to with their role

CREATE OR REPLACE FUNCTION get_user_orgs_with_roles()
RETURNS TABLE(
  org_id UUID,
  org_name TEXT,
  role TEXT,
  member_since TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.name,
    om.role,
    om.created_at
  FROM organization_memberships om
  JOIN organizations o ON o.id = om.org_id
  WHERE om.user_id = auth.uid()
    AND o.is_active = true
  ORDER BY om.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_user_orgs_with_roles() IS 'Returns all organizations the current user belongs to with their roles';

-- =====================================================
-- 8. Count Organization Members
-- =====================================================
-- Returns count of members in an organization by role

CREATE OR REPLACE FUNCTION get_org_member_counts(p_org_id UUID)
RETURNS TABLE(
  total_members INTEGER,
  owners INTEGER,
  admins INTEGER,
  members INTEGER,
  readonly_members INTEGER
) AS $$
BEGIN
  IF NOT can_access_org_data(p_org_id) THEN
    RAISE EXCEPTION 'Access denied to organization';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_members,
    COUNT(*) FILTER (WHERE role = 'owner')::INTEGER as owners,
    COUNT(*) FILTER (WHERE role = 'admin')::INTEGER as admins,
    COUNT(*) FILTER (WHERE role = 'member')::INTEGER as members,
    COUNT(*) FILTER (WHERE role = 'readonly')::INTEGER as readonly_members
  FROM organization_memberships
  WHERE org_id = p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_org_member_counts(UUID) IS 'Returns member counts by role for an organization';

-- =====================================================
-- 9. Validate Organization Access (throws exception)
-- =====================================================
-- Use in triggers/functions that need to enforce org access

CREATE OR REPLACE FUNCTION validate_org_access(p_org_id UUID, p_require_write BOOLEAN DEFAULT false)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'Organization ID is required';
  END IF;

  IF p_require_write THEN
    IF NOT can_write_to_org(p_org_id) THEN
      RAISE EXCEPTION 'Write access denied to organization %', p_org_id;
    END IF;
  ELSE
    IF NOT can_access_org_data(p_org_id) THEN
      RAISE EXCEPTION 'Read access denied to organization %', p_org_id;
    END IF;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION validate_org_access(UUID, BOOLEAN) IS 'Validates user has access to organization, throws exception if not';

-- =====================================================
-- 10. Create Organization for New User
-- =====================================================
-- Called during signup to create a new organization

CREATE OR REPLACE FUNCTION create_org_for_new_user(
  p_user_id UUID,
  p_org_name TEXT,
  p_user_email TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_org_id UUID;
  v_clean_name TEXT;
BEGIN
  -- Clean and validate org name
  v_clean_name := TRIM(p_org_name);
  IF v_clean_name IS NULL OR LENGTH(v_clean_name) < 1 THEN
    -- Default to email domain or 'My Organization'
    IF p_user_email IS NOT NULL AND p_user_email LIKE '%@%' THEN
      v_clean_name := INITCAP(SPLIT_PART(p_user_email, '@', 2));
    ELSE
      v_clean_name := 'My Organization';
    END IF;
  END IF;

  -- Create the organization
  INSERT INTO organizations (name, created_by, is_active)
  VALUES (v_clean_name, p_user_id, true)
  RETURNING id INTO v_org_id;

  -- Add user as owner
  INSERT INTO organization_memberships (org_id, user_id, role)
  VALUES (v_org_id, p_user_id, 'owner');

  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_org_for_new_user(UUID, TEXT, TEXT) IS 'Creates a new organization for a user during signup';

-- =====================================================
-- 11. Accept Organization Invitation
-- =====================================================
-- Processes invitation acceptance, creates membership

CREATE OR REPLACE FUNCTION accept_org_invitation(p_token TEXT)
RETURNS TABLE(
  success BOOLEAN,
  org_id UUID,
  org_name TEXT,
  role TEXT,
  error_message TEXT
) AS $$
DECLARE
  v_invitation RECORD;
  v_user_email TEXT;
BEGIN
  -- Get current user's email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = auth.uid();

  -- Find the invitation
  SELECT i.*, o.name as org_name
  INTO v_invitation
  FROM organization_invitations i
  JOIN organizations o ON o.id = i.org_id
  WHERE i.token = p_token
    AND i.accepted_at IS NULL
    AND i.expires_at > NOW()
    AND LOWER(i.email) = LOWER(v_user_email);

  IF v_invitation IS NULL THEN
    RETURN QUERY SELECT
      false,
      NULL::UUID,
      NULL::TEXT,
      NULL::TEXT,
      'Invalid, expired, or already used invitation'::TEXT;
    RETURN;
  END IF;

  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE org_id = v_invitation.org_id AND user_id = auth.uid()
  ) THEN
    RETURN QUERY SELECT
      false,
      v_invitation.org_id,
      v_invitation.org_name,
      NULL::TEXT,
      'Already a member of this organization'::TEXT;
    RETURN;
  END IF;

  -- Create membership
  INSERT INTO organization_memberships (org_id, user_id, role)
  VALUES (v_invitation.org_id, auth.uid(), v_invitation.role);

  -- Mark invitation as accepted
  UPDATE organization_invitations
  SET accepted_at = NOW()
  WHERE id = v_invitation.id;

  RETURN QUERY SELECT
    true,
    v_invitation.org_id,
    v_invitation.org_name,
    v_invitation.role,
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION accept_org_invitation(TEXT) IS 'Accepts an organization invitation and creates membership';
