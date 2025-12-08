-- ============================================================================
-- CLERK AUTH MIGRATION - Run this in Supabase SQL Editor
-- ============================================================================
-- Go to: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/sql
-- Paste this entire file and click "Run"
-- ============================================================================

-- ============================================================================
-- STEP 1: Create clerk_user_mapping table (if not exists)
-- ============================================================================

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

-- ============================================================================
-- STEP 2: Insert Clerk user mappings (only for profiles that exist)
-- ============================================================================

-- Clear existing mappings
TRUNCATE clerk_user_mapping;

-- Insert mappings only where the profile exists
INSERT INTO clerk_user_mapping (supabase_user_id, clerk_user_id, email)
SELECT p.id, c.clerk_user_id, c.email
FROM (VALUES
    ('user_2xPrCgZ4KJzffmIuRcVPHK2DX0u', 'andrew@sixtyseconds.video'),
    ('user_2xPrK1wdHqKwMYJVh4MUMNPrLmH', 'rosie@sixtyseconds.video'),
    ('user_2xPrKLPHk1E0SePZK86dMW2Y0wT', 'dom@sixtyseconds.video'),
    ('user_2xPrKUgMC1t0NxYK4YJx27vfJcb', 'freddie@sixtyseconds.video'),
    ('user_2xPrKk0R6BdlPSQHDPLlLcupjSp', 'joe@sixtyseconds.video'),
    ('user_2xPrL39qLOGgXJeYa85xvR1sTHL', 'harry@sixtyseconds.video'),
    ('user_2xPrLPlwBJ6C41Zz6Lq2hLCwAhm', 'fraser@sixtyseconds.video'),
    ('user_2xPrLhZXJ5yzq4YfVqgDxe6P0yC', 'callum@sixtyseconds.video'),
    ('user_2xPrM6VQ2HlqbL6H8w6EUvNUYXL', 'toby@sixtyseconds.video'),
    ('user_2xPrMYJFE0X3jFuLCdE2rNpPpK7', 'george@sixtyseconds.video'),
    ('user_2xPrMnsjQjKAzHbT20T4c1qwDIx', 'henry@sixtyseconds.video'),
    ('user_2xPrN9QwCtcz4hspgK2AECDKcZC', 'josh@sixtyseconds.video'),
    ('user_2xPrNRzHJNXdGTfzgwKQP2y4vdy', 'lara@sixtyseconds.video'),
    ('user_2xPrNsm2bZp4QALPKOd0gAtdMqU', 'tom@sixtyseconds.video'),
    ('user_2xPrOASx2IhQwFxhxI3VFJg6IWl', 'tomc@sixtyseconds.video'),
    ('user_2xPrOXy1u1ukYkFLYcUNQiLBgj5', 'will@sixtyseconds.video'),
    ('user_2xPrOqoxX6DqlVfojSN2dZcXJKP', 'alicia@sixtyseconds.video'),
    ('user_2xPrP8DuhD8HKE1wJlDl8Q59qvj', 'reece@sixtyseconds.video'),
    ('user_2xPrPNlxoLOONUlVuuHV2LPXNQa', 'drew@sixtyseconds.video')
) AS c(clerk_user_id, email)
INNER JOIN profiles p ON LOWER(p.email) = LOWER(c.email)
ON CONFLICT (clerk_user_id) DO UPDATE SET
    supabase_user_id = EXCLUDED.supabase_user_id,
    email = EXCLUDED.email,
    updated_at = NOW();

-- Show which profiles were mapped
SELECT 'Mapped profiles:' as status;
SELECT email, supabase_user_id, clerk_user_id FROM clerk_user_mapping ORDER BY email;

-- Show which Clerk users have no matching profile
SELECT 'Missing profiles (Clerk users with no Supabase profile):' as status;
SELECT c.email as clerk_email
FROM (VALUES
    ('andrew@sixtyseconds.video'),
    ('rosie@sixtyseconds.video'),
    ('dom@sixtyseconds.video'),
    ('freddie@sixtyseconds.video'),
    ('joe@sixtyseconds.video'),
    ('harry@sixtyseconds.video'),
    ('fraser@sixtyseconds.video'),
    ('callum@sixtyseconds.video'),
    ('toby@sixtyseconds.video'),
    ('george@sixtyseconds.video'),
    ('henry@sixtyseconds.video'),
    ('josh@sixtyseconds.video'),
    ('lara@sixtyseconds.video'),
    ('tom@sixtyseconds.video'),
    ('tomc@sixtyseconds.video'),
    ('will@sixtyseconds.video'),
    ('alicia@sixtyseconds.video'),
    ('reece@sixtyseconds.video'),
    ('drew@sixtyseconds.video')
) AS c(email)
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE LOWER(p.email) = LOWER(c.email));

-- ============================================================================
-- STEP 3: Create helper functions
-- ============================================================================

-- Drop and recreate to ensure clean state
DROP FUNCTION IF EXISTS current_user_id() CASCADE;
DROP FUNCTION IF EXISTS get_clerk_user_id() CASCADE;
DROP FUNCTION IF EXISTS is_current_user_admin() CASCADE;

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

-- ============================================================================
-- STEP 4: Update RLS Policies on PROFILES table
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all" ON profiles;

CREATE POLICY "profiles_select_own" ON profiles
    FOR SELECT USING (id = current_user_id() OR is_current_user_admin());

CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE USING (id = current_user_id());

-- ============================================================================
-- STEP 5: Update RLS Policies on DEALS table
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own deals" ON deals;
DROP POLICY IF EXISTS "Users can insert their own deals" ON deals;
DROP POLICY IF EXISTS "Users can update their own deals" ON deals;
DROP POLICY IF EXISTS "Users can delete their own deals" ON deals;
DROP POLICY IF EXISTS "Admins can view all deals" ON deals;
DROP POLICY IF EXISTS "deals_select_own" ON deals;
DROP POLICY IF EXISTS "deals_insert_own" ON deals;
DROP POLICY IF EXISTS "deals_update_own" ON deals;
DROP POLICY IF EXISTS "deals_delete_own" ON deals;
DROP POLICY IF EXISTS "Users can view own deals" ON deals;
DROP POLICY IF EXISTS "Users can insert own deals" ON deals;
DROP POLICY IF EXISTS "Users can update own deals" ON deals;
DROP POLICY IF EXISTS "Users can delete own deals" ON deals;

CREATE POLICY "deals_select_own" ON deals
    FOR SELECT USING (owner_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "deals_insert_own" ON deals
    FOR INSERT WITH CHECK (owner_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "deals_update_own" ON deals
    FOR UPDATE USING (owner_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "deals_delete_own" ON deals
    FOR DELETE USING (owner_id = current_user_id() OR is_current_user_admin());

-- ============================================================================
-- STEP 6: Update RLS Policies on CONTACTS table
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can insert their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON contacts;
DROP POLICY IF EXISTS "contacts_select_own" ON contacts;
DROP POLICY IF EXISTS "contacts_insert_own" ON contacts;
DROP POLICY IF EXISTS "contacts_update_own" ON contacts;
DROP POLICY IF EXISTS "contacts_delete_own" ON contacts;
DROP POLICY IF EXISTS "Users can view own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can insert own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete own contacts" ON contacts;

CREATE POLICY "contacts_select_own" ON contacts
    FOR SELECT USING (user_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "contacts_insert_own" ON contacts
    FOR INSERT WITH CHECK (user_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "contacts_update_own" ON contacts
    FOR UPDATE USING (user_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "contacts_delete_own" ON contacts
    FOR DELETE USING (user_id = current_user_id() OR is_current_user_admin());

-- ============================================================================
-- STEP 7: Update RLS Policies on ACTIVITIES table
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own activities" ON activities;
DROP POLICY IF EXISTS "Users can insert their own activities" ON activities;
DROP POLICY IF EXISTS "Users can update their own activities" ON activities;
DROP POLICY IF EXISTS "Users can delete their own activities" ON activities;
DROP POLICY IF EXISTS "activities_select_own" ON activities;
DROP POLICY IF EXISTS "activities_insert_own" ON activities;
DROP POLICY IF EXISTS "activities_update_own" ON activities;
DROP POLICY IF EXISTS "activities_delete_own" ON activities;
DROP POLICY IF EXISTS "Users can view own activities" ON activities;
DROP POLICY IF EXISTS "Users can insert own activities" ON activities;
DROP POLICY IF EXISTS "Users can update own activities" ON activities;
DROP POLICY IF EXISTS "Users can delete own activities" ON activities;

CREATE POLICY "activities_select_own" ON activities
    FOR SELECT USING (user_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "activities_insert_own" ON activities
    FOR INSERT WITH CHECK (user_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "activities_update_own" ON activities
    FOR UPDATE USING (user_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "activities_delete_own" ON activities
    FOR DELETE USING (user_id = current_user_id() OR is_current_user_admin());

-- ============================================================================
-- STEP 8: Update RLS Policies on TASKS table
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON tasks;
DROP POLICY IF EXISTS "tasks_select_own" ON tasks;
DROP POLICY IF EXISTS "tasks_insert_own" ON tasks;
DROP POLICY IF EXISTS "tasks_update_own" ON tasks;
DROP POLICY IF EXISTS "tasks_delete_own" ON tasks;
DROP POLICY IF EXISTS "Users can view own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON tasks;

CREATE POLICY "tasks_select_own" ON tasks
    FOR SELECT USING (user_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "tasks_insert_own" ON tasks
    FOR INSERT WITH CHECK (user_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "tasks_update_own" ON tasks
    FOR UPDATE USING (user_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "tasks_delete_own" ON tasks
    FOR DELETE USING (user_id = current_user_id() OR is_current_user_admin());

-- ============================================================================
-- STEP 9: Update RLS Policies on MEETINGS table
-- ============================================================================
-- Note: meetings table uses owner_user_id, NOT user_id

DROP POLICY IF EXISTS "Users can view their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can insert their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can update their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can delete their own meetings" ON meetings;
DROP POLICY IF EXISTS "meetings_select_own" ON meetings;
DROP POLICY IF EXISTS "meetings_insert_own" ON meetings;
DROP POLICY IF EXISTS "meetings_update_own" ON meetings;
DROP POLICY IF EXISTS "meetings_delete_own" ON meetings;
DROP POLICY IF EXISTS "Users can view own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can insert own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can update own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can delete own meetings" ON meetings;

CREATE POLICY "meetings_select_own" ON meetings
    FOR SELECT USING (owner_user_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "meetings_insert_own" ON meetings
    FOR INSERT WITH CHECK (owner_user_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "meetings_update_own" ON meetings
    FOR UPDATE USING (owner_user_id = current_user_id() OR is_current_user_admin());

CREATE POLICY "meetings_delete_own" ON meetings
    FOR DELETE USING (owner_user_id = current_user_id() OR is_current_user_admin());

-- ============================================================================
-- STEP 10: Grant permissions
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON clerk_user_mapping TO anon, authenticated;
GRANT EXECUTE ON FUNCTION current_user_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_clerk_user_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_current_user_admin() TO anon, authenticated;

-- ============================================================================
-- VERIFICATION: Check the migration completed successfully
-- ============================================================================

DO $$
DECLARE
    v_count INTEGER;
    v_policy_count INTEGER;
BEGIN
    -- Verify clerk_user_mapping has data
    SELECT COUNT(*) INTO v_count FROM clerk_user_mapping;
    RAISE NOTICE 'clerk_user_mapping records: %', v_count;

    -- Verify policies exist on deals
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE tablename = 'deals' AND policyname LIKE 'deals_%';
    RAISE NOTICE 'deals policies: %', v_policy_count;

    -- Verify functions work
    PERFORM current_user_id();
    PERFORM is_current_user_admin();

    RAISE NOTICE '✅ Clerk auth migration completed successfully!';
END;
$$;

-- Show final state
SELECT 'clerk_user_mapping' as table_name, COUNT(*) as count FROM clerk_user_mapping
UNION ALL
SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL
SELECT 'deals', COUNT(*) FROM deals
UNION ALL
SELECT 'contacts', COUNT(*) FROM contacts
UNION ALL
SELECT 'activities', COUNT(*) FROM activities;
