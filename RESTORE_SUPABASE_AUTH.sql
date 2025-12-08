-- ============================================================================
-- RESTORE SUPABASE AUTH - Run this in Supabase SQL Editor
-- ============================================================================
-- This restores RLS policies to use auth.uid() for standard Supabase Auth
-- Go to: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/sql
-- ============================================================================

-- ============================================================================
-- STEP 1: Create helper function for admin check (if not exists)
-- ============================================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND is_admin = true
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- STEP 2: Update RLS Policies on PROFILES table
-- ============================================================================

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (id = auth.uid() OR is_admin());

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (id = auth.uid());

-- ============================================================================
-- STEP 3: Update RLS Policies on DEALS table (uses owner_id)
-- ============================================================================

DROP POLICY IF EXISTS "deals_select_own" ON deals;
DROP POLICY IF EXISTS "deals_insert_own" ON deals;
DROP POLICY IF EXISTS "deals_update_own" ON deals;
DROP POLICY IF EXISTS "deals_delete_own" ON deals;
DROP POLICY IF EXISTS "Users can view their own deals" ON deals;
DROP POLICY IF EXISTS "Users can insert their own deals" ON deals;
DROP POLICY IF EXISTS "Users can update their own deals" ON deals;
DROP POLICY IF EXISTS "Users can delete their own deals" ON deals;

CREATE POLICY "Users can view their own deals" ON deals
    FOR SELECT USING (owner_id = auth.uid() OR is_admin());

CREATE POLICY "Users can insert their own deals" ON deals
    FOR INSERT WITH CHECK (owner_id = auth.uid() OR is_admin());

CREATE POLICY "Users can update their own deals" ON deals
    FOR UPDATE USING (owner_id = auth.uid() OR is_admin());

CREATE POLICY "Users can delete their own deals" ON deals
    FOR DELETE USING (owner_id = auth.uid() OR is_admin());

-- ============================================================================
-- STEP 4: Update RLS Policies on CONTACTS table (uses owner_id)
-- ============================================================================

DROP POLICY IF EXISTS "contacts_select_own" ON contacts;
DROP POLICY IF EXISTS "contacts_insert_own" ON contacts;
DROP POLICY IF EXISTS "contacts_update_own" ON contacts;
DROP POLICY IF EXISTS "contacts_delete_own" ON contacts;
DROP POLICY IF EXISTS "Users can view their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can insert their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON contacts;

CREATE POLICY "Users can view their own contacts" ON contacts
    FOR SELECT USING (owner_id = auth.uid() OR is_admin());

CREATE POLICY "Users can insert their own contacts" ON contacts
    FOR INSERT WITH CHECK (owner_id = auth.uid() OR is_admin());

CREATE POLICY "Users can update their own contacts" ON contacts
    FOR UPDATE USING (owner_id = auth.uid() OR is_admin());

CREATE POLICY "Users can delete their own contacts" ON contacts
    FOR DELETE USING (owner_id = auth.uid() OR is_admin());

-- ============================================================================
-- STEP 5: Update RLS Policies on ACTIVITIES table (uses user_id)
-- ============================================================================

DROP POLICY IF EXISTS "activities_select_own" ON activities;
DROP POLICY IF EXISTS "activities_insert_own" ON activities;
DROP POLICY IF EXISTS "activities_update_own" ON activities;
DROP POLICY IF EXISTS "activities_delete_own" ON activities;
DROP POLICY IF EXISTS "Users can view their own activities" ON activities;
DROP POLICY IF EXISTS "Users can insert their own activities" ON activities;
DROP POLICY IF EXISTS "Users can update their own activities" ON activities;
DROP POLICY IF EXISTS "Users can delete their own activities" ON activities;

CREATE POLICY "Users can view their own activities" ON activities
    FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Users can insert their own activities" ON activities
    FOR INSERT WITH CHECK (user_id = auth.uid() OR is_admin());

CREATE POLICY "Users can update their own activities" ON activities
    FOR UPDATE USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Users can delete their own activities" ON activities
    FOR DELETE USING (user_id = auth.uid() OR is_admin());

-- ============================================================================
-- STEP 6: Update RLS Policies on TASKS table (uses owner_id)
-- ============================================================================

DROP POLICY IF EXISTS "tasks_select_own" ON tasks;
DROP POLICY IF EXISTS "tasks_insert_own" ON tasks;
DROP POLICY IF EXISTS "tasks_update_own" ON tasks;
DROP POLICY IF EXISTS "tasks_delete_own" ON tasks;
DROP POLICY IF EXISTS "Users can view their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON tasks;

CREATE POLICY "Users can view their own tasks" ON tasks
    FOR SELECT USING (owner_id = auth.uid() OR is_admin());

CREATE POLICY "Users can insert their own tasks" ON tasks
    FOR INSERT WITH CHECK (owner_id = auth.uid() OR is_admin());

CREATE POLICY "Users can update their own tasks" ON tasks
    FOR UPDATE USING (owner_id = auth.uid() OR is_admin());

CREATE POLICY "Users can delete their own tasks" ON tasks
    FOR DELETE USING (owner_id = auth.uid() OR is_admin());

-- ============================================================================
-- STEP 7: Update RLS Policies on MEETINGS table (uses owner_user_id)
-- ============================================================================

DROP POLICY IF EXISTS "meetings_select_own" ON meetings;
DROP POLICY IF EXISTS "meetings_insert_own" ON meetings;
DROP POLICY IF EXISTS "meetings_update_own" ON meetings;
DROP POLICY IF EXISTS "meetings_delete_own" ON meetings;
DROP POLICY IF EXISTS "Users can view their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can insert their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can update their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can delete their own meetings" ON meetings;

CREATE POLICY "Users can view their own meetings" ON meetings
    FOR SELECT USING (owner_user_id = auth.uid() OR is_admin());

CREATE POLICY "Users can insert their own meetings" ON meetings
    FOR INSERT WITH CHECK (owner_user_id = auth.uid() OR is_admin());

CREATE POLICY "Users can update their own meetings" ON meetings
    FOR UPDATE USING (owner_user_id = auth.uid() OR is_admin());

CREATE POLICY "Users can delete their own meetings" ON meetings
    FOR DELETE USING (owner_user_id = auth.uid() OR is_admin());

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    v_policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE schemaname = 'public';

    RAISE NOTICE '✅ Supabase Auth RLS policies restored! Total policies: %', v_policy_count;
END;
$$;

-- Show current policies
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'deals', 'contacts', 'activities', 'tasks', 'meetings')
ORDER BY tablename, policyname;
