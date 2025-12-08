-- ============================================================================
-- External Project - Clerk Authentication Functions
-- ============================================================================
-- Purpose: Create helper functions for Clerk JWT authentication
-- Both internal and external projects share Clerk auth via shared JWTs
-- ============================================================================

-- ============================================================================
-- SECTION 1: Core Authentication Functions
-- ============================================================================

-- Main function: current_user_id() - Returns the authenticated user's profile UUID
-- This function extracts the Clerk user ID from the JWT and maps it to the profile UUID
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
DECLARE
    v_clerk_id TEXT;
    v_mapped_id UUID;
BEGIN
    -- Extract Clerk user ID from JWT 'sub' claim
    BEGIN
        v_clerk_id := current_setting('request.jwt.claims', true)::json->>'sub';
    EXCEPTION WHEN OTHERS THEN
        v_clerk_id := NULL;
    END;

    -- If we have a Clerk ID, look up the mapped profile UUID
    IF v_clerk_id IS NOT NULL THEN
        SELECT supabase_user_id INTO v_mapped_id
        FROM clerk_user_mapping
        WHERE clerk_user_id = v_clerk_id;

        IF v_mapped_id IS NOT NULL THEN
            RETURN v_mapped_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION current_user_id() IS
    'Returns the current user profile UUID by mapping Clerk JWT sub claim to profiles.id';

-- Helper function: get_clerk_user_id() - Returns the raw Clerk user ID from JWT
CREATE OR REPLACE FUNCTION get_clerk_user_id()
RETURNS TEXT AS $$
DECLARE
    clerk_id TEXT;
BEGIN
    BEGIN
        clerk_id := current_setting('request.jwt.claims', true)::json->>'sub';
    EXCEPTION WHEN OTHERS THEN
        clerk_id := NULL;
    END;
    RETURN clerk_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_clerk_user_id() IS
    'Returns the Clerk user ID from JWT sub claim';

-- Helper function: get_user_email() - Returns the user's email from JWT
CREATE OR REPLACE FUNCTION get_user_email()
RETURNS TEXT AS $$
DECLARE
    user_email TEXT;
BEGIN
    BEGIN
        user_email := current_setting('request.jwt.claims', true)::json->>'email';
    EXCEPTION WHEN OTHERS THEN
        user_email := NULL;
    END;
    RETURN user_email;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_user_email() IS
    'Returns the user email from JWT claims';

-- ============================================================================
-- SECTION 2: Authorization Helper Functions
-- ============================================================================

-- Check if current user is admin
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_id UUID;
    admin_status BOOLEAN;
BEGIN
    user_id := current_user_id();
    IF user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT is_admin INTO admin_status
    FROM profiles
    WHERE id = user_id;

    RETURN COALESCE(admin_status, FALSE);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION is_current_user_admin() IS
    'Returns true if the current user is an admin';

-- Get user's organization IDs
CREATE OR REPLACE FUNCTION get_user_organization_ids()
RETURNS UUID[] AS $$
DECLARE
    user_id UUID;
    org_ids UUID[];
BEGIN
    user_id := current_user_id();
    IF user_id IS NULL THEN
        RETURN ARRAY[]::UUID[];
    END IF;

    SELECT ARRAY_AGG(organization_id) INTO org_ids
    FROM organization_memberships
    WHERE user_id = user_id;

    RETURN COALESCE(org_ids, ARRAY[]::UUID[]);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_user_organization_ids() IS
    'Returns array of organization IDs the current user belongs to';

-- Check if user is member of specific organization
CREATE OR REPLACE FUNCTION is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_id UUID;
BEGIN
    user_id := current_user_id();
    IF user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM organization_memberships
        WHERE user_id = user_id AND organization_id = org_id
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION is_org_member(UUID) IS
    'Returns true if current user is member of the specified organization';

-- Check if user has admin role in organization
CREATE OR REPLACE FUNCTION is_org_admin(org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_id UUID;
BEGIN
    user_id := current_user_id();
    IF user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM organization_memberships
        WHERE user_id = user_id
          AND organization_id = org_id
          AND role IN ('owner', 'admin')
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION is_org_admin(UUID) IS
    'Returns true if current user is owner or admin of the specified organization';

-- ============================================================================
-- SECTION 3: User Provisioning Function
-- ============================================================================

-- Auto-provision user on first login (creates profile and mapping)
CREATE OR REPLACE FUNCTION provision_clerk_user(
    p_clerk_user_id TEXT,
    p_email TEXT,
    p_first_name TEXT DEFAULT NULL,
    p_last_name TEXT DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_profile_id UUID;
    v_existing_mapping UUID;
BEGIN
    -- Check if mapping already exists
    SELECT supabase_user_id INTO v_existing_mapping
    FROM clerk_user_mapping
    WHERE clerk_user_id = p_clerk_user_id;

    IF v_existing_mapping IS NOT NULL THEN
        -- Update existing profile with latest info
        UPDATE profiles
        SET
            email = COALESCE(p_email, email),
            first_name = COALESCE(p_first_name, first_name),
            last_name = COALESCE(p_last_name, last_name),
            avatar_url = COALESCE(p_avatar_url, avatar_url),
            full_name = CASE
                WHEN p_first_name IS NOT NULL AND p_last_name IS NOT NULL
                THEN p_first_name || ' ' || p_last_name
                ELSE full_name
            END,
            updated_at = NOW()
        WHERE id = v_existing_mapping;

        RETURN v_existing_mapping;
    END IF;

    -- Check if profile exists by email
    SELECT id INTO v_profile_id
    FROM profiles
    WHERE LOWER(email) = LOWER(p_email);

    IF v_profile_id IS NULL THEN
        -- Create new profile
        INSERT INTO profiles (email, first_name, last_name, full_name, avatar_url)
        VALUES (
            p_email,
            p_first_name,
            p_last_name,
            CASE
                WHEN p_first_name IS NOT NULL AND p_last_name IS NOT NULL
                THEN p_first_name || ' ' || p_last_name
                WHEN p_first_name IS NOT NULL THEN p_first_name
                WHEN p_last_name IS NOT NULL THEN p_last_name
                ELSE NULL
            END,
            p_avatar_url
        )
        RETURNING id INTO v_profile_id;
    END IF;

    -- Create clerk user mapping
    INSERT INTO clerk_user_mapping (supabase_user_id, clerk_user_id, email)
    VALUES (v_profile_id, p_clerk_user_id, p_email)
    ON CONFLICT (clerk_user_id) DO UPDATE
    SET
        supabase_user_id = v_profile_id,
        email = p_email,
        updated_at = NOW();

    RETURN v_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION provision_clerk_user(TEXT, TEXT, TEXT, TEXT, TEXT) IS
    'Auto-provisions a user profile and mapping on first Clerk login';

-- ============================================================================
-- SECTION 4: Grant Permissions
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON clerk_user_mapping TO anon, authenticated;
GRANT EXECUTE ON FUNCTION current_user_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_clerk_user_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_email() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_current_user_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_organization_ids() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_org_member(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_org_admin(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION provision_clerk_user(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
    -- Verify functions exist
    PERFORM current_user_id();
    PERFORM get_clerk_user_id();
    PERFORM is_current_user_admin();

    RAISE NOTICE 'Clerk authentication functions created successfully';
END;
$$;
