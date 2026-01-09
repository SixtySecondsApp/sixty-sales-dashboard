-- ============================================================================
-- Migration: Fix Clerk Authentication - Complete Setup
-- Purpose: Ensure all Clerk auth components are properly configured
-- ============================================================================
-- This migration:
-- 1. Creates clerk_user_mapping table if not exists (with both singular and plural)
-- 2. Creates helper functions for Clerk auth
-- 3. Updates RLS policies to use current_user_id() instead of auth.uid()
-- ============================================================================

-- ============================================================================
-- STEP 1: Ensure clerk_user_mapping table exists
-- ============================================================================

-- Create the singular version (used by the application)
CREATE TABLE IF NOT EXISTS clerk_user_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supabase_user_id UUID NOT NULL,
    clerk_user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    migrated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clerk_user_id),
    UNIQUE(email)
);

-- Create a view for the plural version (used by migration functions)
CREATE OR REPLACE VIEW clerk_user_mappings AS
SELECT
    id,
    supabase_user_id,
    clerk_user_id,
    email,
    migrated_at,
    created_at,
    updated_at
FROM clerk_user_mapping;

-- ============================================================================
-- STEP 2: Create/Replace Helper Functions
-- ============================================================================

-- Drop existing functions if they exist with wrong return types
DROP FUNCTION IF EXISTS get_clerk_user_id() CASCADE;
DROP FUNCTION IF EXISTS is_current_user_admin() CASCADE;
DROP FUNCTION IF EXISTS current_user_id() CASCADE;

-- Main function: current_user_id() - returns the authenticated user's Supabase UUID
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
DECLARE
    v_supabase_id UUID;
    v_clerk_id TEXT;
    v_mapped_id UUID;
BEGIN
    -- Try Supabase native auth first (fastest path)
    v_supabase_id := auth.uid();
    IF v_supabase_id IS NOT NULL THEN
        RETURN v_supabase_id;
    END IF;

    -- Fall back to Clerk JWT
    BEGIN
        v_clerk_id := current_setting('request.jwt.claims', true)::json->>'sub';
    EXCEPTION WHEN OTHERS THEN
        v_clerk_id := NULL;
    END;

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
    'Returns the current user UUID, supporting both Supabase Auth and Clerk JWTs';

-- Helper function: get_clerk_user_id() - returns the Clerk user ID from JWT
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

-- Helper function: is_current_user_admin() - checks if current user is admin
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

-- ============================================================================
-- STEP 3: Update RLS Policies on Core Tables
-- ============================================================================

-- ------------ PROFILES TABLE ------------
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;

CREATE POLICY "profiles_select_own" ON profiles
    FOR SELECT USING (id = current_user_id() OR is_current_user_admin());

CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE USING (id = current_user_id());

-- ------------ DEALS TABLE ------------
DROP POLICY IF EXISTS "Users can view their own deals" ON deals;
DROP POLICY IF EXISTS "Users can insert their own deals" ON deals;
DROP POLICY IF EXISTS "Users can update their own deals" ON deals;
DROP POLICY IF EXISTS "Users can delete their own deals" ON deals;
DROP POLICY IF EXISTS "Admins can view all deals" ON deals;
DROP POLICY IF EXISTS "deals_select_own" ON deals;
DROP POLICY IF EXISTS "deals_insert_own" ON deals;
DROP POLICY IF EXISTS "deals_update_own" ON deals;
DROP POLICY IF EXISTS "deals_delete_own" ON deals;

CREATE POLICY "deals_select_own" ON deals
    FOR SELECT USING (owner_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "deals_insert_own" ON deals
    FOR INSERT WITH CHECK (owner_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "deals_update_own" ON deals
    FOR UPDATE USING (owner_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "deals_delete_own" ON deals
    FOR DELETE USING (owner_id = current_user_id() OR is_current_user_admin());

-- ------------ CONTACTS TABLE ------------
DROP POLICY IF EXISTS "Users can view their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can insert their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON contacts;
DROP POLICY IF EXISTS "contacts_select_own" ON contacts;
DROP POLICY IF EXISTS "contacts_insert_own" ON contacts;
DROP POLICY IF EXISTS "contacts_update_own" ON contacts;
DROP POLICY IF EXISTS "contacts_delete_own" ON contacts;

CREATE POLICY "contacts_select_own" ON contacts
    FOR SELECT USING (user_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "contacts_insert_own" ON contacts
    FOR INSERT WITH CHECK (user_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "contacts_update_own" ON contacts
    FOR UPDATE USING (user_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "contacts_delete_own" ON contacts
    FOR DELETE USING (user_id = current_user_id() OR is_current_user_admin());

-- ------------ ACTIVITIES TABLE ------------
DROP POLICY IF EXISTS "Users can view their own activities" ON activities;
DROP POLICY IF EXISTS "Users can insert their own activities" ON activities;
DROP POLICY IF EXISTS "Users can update their own activities" ON activities;
DROP POLICY IF EXISTS "Users can delete their own activities" ON activities;
DROP POLICY IF EXISTS "activities_select_own" ON activities;
DROP POLICY IF EXISTS "activities_insert_own" ON activities;
DROP POLICY IF EXISTS "activities_update_own" ON activities;
DROP POLICY IF EXISTS "activities_delete_own" ON activities;

CREATE POLICY "activities_select_own" ON activities
    FOR SELECT USING (user_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "activities_insert_own" ON activities
    FOR INSERT WITH CHECK (user_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "activities_update_own" ON activities
    FOR UPDATE USING (user_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "activities_delete_own" ON activities
    FOR DELETE USING (user_id = current_user_id() OR is_current_user_admin());

-- ------------ TASKS TABLE ------------
DROP POLICY IF EXISTS "Users can view their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON tasks;
DROP POLICY IF EXISTS "tasks_select_own" ON tasks;
DROP POLICY IF EXISTS "tasks_insert_own" ON tasks;
DROP POLICY IF EXISTS "tasks_update_own" ON tasks;
DROP POLICY IF EXISTS "tasks_delete_own" ON tasks;

CREATE POLICY "tasks_select_own" ON tasks
    FOR SELECT USING (user_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "tasks_insert_own" ON tasks
    FOR INSERT WITH CHECK (user_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "tasks_update_own" ON tasks
    FOR UPDATE USING (user_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "tasks_delete_own" ON tasks
    FOR DELETE USING (user_id = current_user_id() OR is_current_user_admin());

-- ------------ MEETINGS TABLE ------------
DROP POLICY IF EXISTS "Users can view their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can insert their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can update their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can delete their own meetings" ON meetings;
DROP POLICY IF EXISTS "meetings_select_own" ON meetings;
DROP POLICY IF EXISTS "meetings_insert_own" ON meetings;
DROP POLICY IF EXISTS "meetings_update_own" ON meetings;
DROP POLICY IF EXISTS "meetings_delete_own" ON meetings;

-- Note: meetings table uses owner_user_id, NOT user_id
CREATE POLICY "meetings_select_own" ON meetings
    FOR SELECT USING (owner_user_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "meetings_insert_own" ON meetings
    FOR INSERT WITH CHECK (owner_user_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "meetings_update_own" ON meetings
    FOR UPDATE USING (owner_user_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "meetings_delete_own" ON meetings
    FOR DELETE USING (owner_user_id = current_user_id() OR is_current_user_admin());

-- ============================================================================
-- STEP 4: Grant necessary permissions
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON clerk_user_mapping TO anon, authenticated;
GRANT SELECT ON clerk_user_mappings TO anon, authenticated;
GRANT EXECUTE ON FUNCTION current_user_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_clerk_user_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_current_user_admin() TO anon, authenticated;

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Verify clerk_user_mapping table exists
    SELECT COUNT(*) INTO v_count FROM information_schema.tables
    WHERE table_name = 'clerk_user_mapping';
    IF v_count = 0 THEN
        RAISE EXCEPTION 'clerk_user_mapping table was not created';
    END IF;

    -- Verify functions exist
    PERFORM current_user_id();
    PERFORM get_clerk_user_id();
    PERFORM is_current_user_admin();

    RAISE NOTICE 'Clerk auth migration completed successfully';
END;
$$;
