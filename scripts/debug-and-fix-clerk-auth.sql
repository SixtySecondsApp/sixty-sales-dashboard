-- ============================================================================
-- DEBUG AND FIX CLERK AUTHENTICATION
-- ============================================================================
-- Run this script in Supabase SQL Editor to diagnose and fix Clerk auth issues
-- ============================================================================

-- STEP 1: Check if clerk_user_mapping table exists and has data
SELECT 'STEP 1: Checking clerk_user_mapping table' as step;
SELECT * FROM clerk_user_mapping;

-- STEP 2: Check current_user_id() function definition
SELECT 'STEP 2: Checking current_user_id() function' as step;
SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'current_user_id';

-- STEP 3: Verify the function uses correct table name (clerk_user_mapping, not clerk_user_mappings)
-- If the function shows wrong table name, the following will fix it:

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
DECLARE
  v_supabase_id UUID;
  v_clerk_id TEXT;
  v_mapped_id UUID;
BEGIN
  -- Try Supabase native auth first (fastest path for existing users)
  v_supabase_id := auth.uid();
  IF v_supabase_id IS NOT NULL THEN
    RETURN v_supabase_id;
  END IF;

  -- Fall back to Clerk JWT 'sub' claim
  v_clerk_id := auth.jwt()->>'sub';
  IF v_clerk_id IS NOT NULL THEN
    -- Look up the mapped Supabase UUID
    SELECT supabase_user_id INTO v_mapped_id
    FROM clerk_user_mapping
    WHERE clerk_user_id = v_clerk_id;

    IF v_mapped_id IS NOT NULL THEN
      RETURN v_mapped_id;
    END IF;

    RETURN NULL;
  END IF;

  RETURN NULL;
END;
$function$;

-- STEP 4: Also fix is_admin() to use current_user_id()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = current_user_id()
    AND is_admin = true
  );
END;
$function$;

-- STEP 5: Create/fix debug_clerk_auth function
CREATE OR REPLACE FUNCTION public.debug_clerk_auth()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_jwt jsonb;
  v_sub text;
  v_mapped uuid;
  v_auth_uid uuid;
  v_current_user uuid;
BEGIN
  -- Get auth.uid() (will be NULL for Clerk JWT)
  v_auth_uid := auth.uid();

  -- Get the full JWT
  v_jwt := auth.jwt()::jsonb;

  -- Get the 'sub' claim from JWT (Clerk user ID)
  v_sub := v_jwt->>'sub';

  -- Look up the mapping
  IF v_sub IS NOT NULL THEN
    SELECT supabase_user_id INTO v_mapped
    FROM clerk_user_mapping
    WHERE clerk_user_id = v_sub;
  END IF;

  -- Get current_user_id() result
  v_current_user := current_user_id();

  RETURN jsonb_build_object(
    'auth_uid', v_auth_uid,
    'jwt_sub', v_sub,
    'jwt_role', v_jwt->>'role',
    'jwt_aud', v_jwt->>'aud',
    'jwt_iss', v_jwt->>'iss',
    'jwt_exp', v_jwt->>'exp',
    'mapped_uuid', v_mapped,
    'current_user_id_result', v_current_user,
    'mapping_found', (v_mapped IS NOT NULL),
    'has_jwt', (v_jwt IS NOT NULL AND v_jwt != 'null'::jsonb)
  );
END;
$function$;

-- STEP 6: Grant execute permissions on debug function
GRANT EXECUTE ON FUNCTION public.debug_clerk_auth() TO anon;
GRANT EXECUTE ON FUNCTION public.debug_clerk_auth() TO authenticated;

-- STEP 7: Now let's update the critical RLS policies for data loading
-- These are the tables that typically load on the dashboard

-- PROFILES (most important - user info)
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;

CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (id = current_user_id() OR is_admin());

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (id = current_user_id() OR is_admin());

-- DEALS (pipeline data)
DROP POLICY IF EXISTS "Users can view their own deals" ON deals;
DROP POLICY IF EXISTS "Users can insert their own deals" ON deals;
DROP POLICY IF EXISTS "Users can update their own deals" ON deals;
DROP POLICY IF EXISTS "Users can delete their own deals" ON deals;
DROP POLICY IF EXISTS "deals_full_access" ON deals;

CREATE POLICY "Users can view their own deals" ON deals
  FOR SELECT USING (owner_id = current_user_id() OR is_admin());

CREATE POLICY "Users can insert their own deals" ON deals
  FOR INSERT WITH CHECK (owner_id = current_user_id() OR is_admin());

CREATE POLICY "Users can update their own deals" ON deals
  FOR UPDATE USING (owner_id = current_user_id() OR is_admin());

CREATE POLICY "Users can delete their own deals" ON deals
  FOR DELETE USING (owner_id = current_user_id() OR is_admin());

-- ACTIVITIES (activity tracking)
DROP POLICY IF EXISTS "Users can view their own activities" ON activities;
DROP POLICY IF EXISTS "Users can insert their own activities" ON activities;
DROP POLICY IF EXISTS "Users can update their own activities" ON activities;
DROP POLICY IF EXISTS "Users can delete their own activities" ON activities;
DROP POLICY IF EXISTS "activities_full_access" ON activities;

CREATE POLICY "Users can view their own activities" ON activities
  FOR SELECT USING (user_id = current_user_id() OR is_admin());

CREATE POLICY "Users can insert their own activities" ON activities
  FOR INSERT WITH CHECK (user_id = current_user_id() OR is_admin());

CREATE POLICY "Users can update their own activities" ON activities
  FOR UPDATE USING (user_id = current_user_id() OR is_admin());

CREATE POLICY "Users can delete their own activities" ON activities
  FOR DELETE USING (user_id = current_user_id() OR is_admin());

-- CONTACTS (contact data)
DROP POLICY IF EXISTS "Users can view their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can insert their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON contacts;
DROP POLICY IF EXISTS "contacts_full_access" ON contacts;

CREATE POLICY "Users can view their own contacts" ON contacts
  FOR SELECT USING (owner_id = current_user_id() OR is_admin());

CREATE POLICY "Users can insert their own contacts" ON contacts
  FOR INSERT WITH CHECK (owner_id = current_user_id() OR is_admin());

CREATE POLICY "Users can update their own contacts" ON contacts
  FOR UPDATE USING (owner_id = current_user_id() OR is_admin());

CREATE POLICY "Users can delete their own contacts" ON contacts
  FOR DELETE USING (owner_id = current_user_id() OR is_admin());

-- COMPANIES (company data)
DROP POLICY IF EXISTS "Users can view their own companies" ON companies;
DROP POLICY IF EXISTS "Users can insert their own companies" ON companies;
DROP POLICY IF EXISTS "Users can update their own companies" ON companies;
DROP POLICY IF EXISTS "Users can delete their own companies" ON companies;
DROP POLICY IF EXISTS "companies_full_access" ON companies;

CREATE POLICY "Users can view their own companies" ON companies
  FOR SELECT USING (owner_id = current_user_id() OR is_admin());

CREATE POLICY "Users can insert their own companies" ON companies
  FOR INSERT WITH CHECK (owner_id = current_user_id() OR is_admin());

CREATE POLICY "Users can update their own companies" ON companies
  FOR UPDATE USING (owner_id = current_user_id() OR is_admin());

CREATE POLICY "Users can delete their own companies" ON companies
  FOR DELETE USING (owner_id = current_user_id() OR is_admin());

-- TASKS (task management) - Note: tasks uses owner_id, not user_id
DROP POLICY IF EXISTS "Users can view their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON tasks;
DROP POLICY IF EXISTS "tasks_full_access" ON tasks;

CREATE POLICY "Users can view their own tasks" ON tasks
  FOR SELECT USING (owner_id = current_user_id() OR assigned_to = current_user_id() OR is_admin());

CREATE POLICY "Users can insert their own tasks" ON tasks
  FOR INSERT WITH CHECK (owner_id = current_user_id() OR is_admin());

CREATE POLICY "Users can update their own tasks" ON tasks
  FOR UPDATE USING (owner_id = current_user_id() OR assigned_to = current_user_id() OR is_admin());

CREATE POLICY "Users can delete their own tasks" ON tasks
  FOR DELETE USING (owner_id = current_user_id() OR is_admin());

-- MEETINGS (meeting data)
DROP POLICY IF EXISTS "Users can view their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can insert their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can update their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can delete their own meetings" ON meetings;
DROP POLICY IF EXISTS "meetings_full_access" ON meetings;

-- Note: meetings table uses owner_user_id NOT user_id
CREATE POLICY "Users can view their own meetings" ON meetings
  FOR SELECT USING (owner_user_id = current_user_id() OR is_admin());

CREATE POLICY "Users can insert their own meetings" ON meetings
  FOR INSERT WITH CHECK (owner_user_id = current_user_id() OR is_admin());

CREATE POLICY "Users can update their own meetings" ON meetings
  FOR UPDATE USING (owner_user_id = current_user_id() OR is_admin());

CREATE POLICY "Users can delete their own meetings" ON meetings
  FOR DELETE USING (owner_user_id = current_user_id() OR is_admin());

-- STEP 8: Verify the mapping exists
SELECT 'STEP 8: Final mapping check' as step;
SELECT
  clerk_user_id,
  supabase_user_id,
  email,
  created_at
FROM clerk_user_mapping
WHERE clerk_user_id = 'user_36O6nfBSBdXFOGG89D2Q6qb3j3u';

-- STEP 9: Verify profile exists for mapped user
SELECT 'STEP 9: Checking profile for mapped user' as step;
SELECT id, email, is_admin
FROM profiles
WHERE id = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459';

SELECT 'DONE! Now test the debug_clerk_auth function from the browser.' as status;
