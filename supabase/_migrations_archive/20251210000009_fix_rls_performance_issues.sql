-- Migration: Fix RLS Performance Issues
-- Addresses 993 Supabase performance warnings:
--   - 454 auth_rls_initplan issues (auth.uid() re-evaluated per row)
--   - 539 multiple_permissive_policies issues (duplicate policies)
-- Applied: 2025-12-10
--
-- Fix Strategy:
-- 1. Drop ALL existing RLS policies on affected tables
-- 2. Recreate consolidated policies with (SELECT auth.uid()) optimization
-- 3. Each table gets at most ONE policy per operation (SELECT/INSERT/UPDATE/DELETE)
--
-- Performance Impact:
-- - auth.uid() evaluated ONCE per query instead of per row
-- - Single policy evaluation instead of OR-ing multiple permissive policies

-- ============================================================================
-- HELPER: Create optimized check functions
-- ============================================================================

-- Optimized function to check if user is admin (cached per statement)
CREATE OR REPLACE FUNCTION public.is_admin_optimized()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE id = (SELECT auth.uid())),
    false
  )
$$;

-- Optimized function to check service role
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (SELECT auth.role()) = 'service_role'
$$;

-- Optimized function to get current user's org_id (from organization_memberships)
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT org_id FROM organization_memberships WHERE user_id = (SELECT auth.uid()) LIMIT 1
$$;

-- ============================================================================
-- TABLE: profiles
-- ============================================================================

-- Drop ALL existing policies (including ones from previous migration attempts)
DROP POLICY IF EXISTS "Enable profile creation" ON profiles;
DROP POLICY IF EXISTS "Enable profile updates" ON profiles;
DROP POLICY IF EXISTS "Service role can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "profiles_full_access" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_service_role_all" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_view_own_profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;
DROP POLICY IF EXISTS "profiles_access" ON profiles;
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
DROP POLICY IF EXISTS "allow_trigger_insert_profiles" ON profiles;

-- Create optimized consolidated policies
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (
    is_service_role()
    OR id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (
    is_service_role()
    OR id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (
    is_service_role()
    OR id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "profiles_delete" ON profiles;
CREATE POLICY "profiles_delete" ON profiles FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: user_onboarding_progress
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert own onboarding" ON user_onboarding_progress;
DROP POLICY IF EXISTS "Users can insert their own onboarding progress" ON user_onboarding_progress;
DROP POLICY IF EXISTS "Users can update own onboarding" ON user_onboarding_progress;
DROP POLICY IF EXISTS "Users can update their own onboarding progress" ON user_onboarding_progress;
DROP POLICY IF EXISTS "Users can view own onboarding" ON user_onboarding_progress;
DROP POLICY IF EXISTS "Users can view their own onboarding progress" ON user_onboarding_progress;
DROP POLICY IF EXISTS "users_insert_own_onboarding" ON user_onboarding_progress;
DROP POLICY IF EXISTS "users_update_own_onboarding" ON user_onboarding_progress;
DROP POLICY IF EXISTS "users_view_own_onboarding" ON user_onboarding_progress;

DROP POLICY IF EXISTS "user_onboarding_progress_select" ON user_onboarding_progress;
CREATE POLICY "user_onboarding_progress_select" ON user_onboarding_progress FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_onboarding_progress_insert" ON user_onboarding_progress;
CREATE POLICY "user_onboarding_progress_insert" ON user_onboarding_progress FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_onboarding_progress_update" ON user_onboarding_progress;
CREATE POLICY "user_onboarding_progress_update" ON user_onboarding_progress FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_onboarding_progress_delete" ON user_onboarding_progress;
CREATE POLICY "user_onboarding_progress_delete" ON user_onboarding_progress FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

-- ============================================================================
-- TABLE: clients (uses owner_id, not user_id)
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view all clients" ON clients;
DROP POLICY IF EXISTS "Users can delete their own clients" ON clients;
DROP POLICY IF EXISTS "Users can insert their own clients" ON clients;
DROP POLICY IF EXISTS "Users can update their own clients" ON clients;
DROP POLICY IF EXISTS "Users can view their own clients" ON clients;
DROP POLICY IF EXISTS "clients_admin_select" ON clients;
DROP POLICY IF EXISTS "clients_select" ON clients;
DROP POLICY IF EXISTS "clients_insert" ON clients;
DROP POLICY IF EXISTS "clients_update" ON clients;
DROP POLICY IF EXISTS "clients_delete" ON clients;

DROP POLICY IF EXISTS "clients_select" ON clients;
CREATE POLICY "clients_select" ON clients FOR SELECT
  USING (
    is_service_role()
    OR owner_id = (SELECT auth.uid())

    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "clients_insert" ON clients;
CREATE POLICY "clients_insert" ON clients FOR INSERT
  WITH CHECK (is_service_role() OR owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "clients_update" ON clients;
CREATE POLICY "clients_update" ON clients FOR UPDATE
  USING (
    is_service_role()
    OR owner_id = (SELECT auth.uid())

    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "clients_delete" ON clients;
CREATE POLICY "clients_delete" ON clients FOR DELETE
  USING (
    is_service_role()
    OR owner_id = (SELECT auth.uid())

    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: companies (uses owner_id, not user_id)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view companies in their org" ON companies;
DROP POLICY IF EXISTS "Users can view their own companies" ON companies;
DROP POLICY IF EXISTS "Users can insert companies" ON companies;
DROP POLICY IF EXISTS "Users can insert their own companies" ON companies;
DROP POLICY IF EXISTS "Users can update companies in their org" ON companies;
DROP POLICY IF EXISTS "Users can update their own companies" ON companies;
DROP POLICY IF EXISTS "Users can delete companies in their org" ON companies;
DROP POLICY IF EXISTS "Users can delete their own companies" ON companies;
DROP POLICY IF EXISTS "Admins can view all companies" ON companies;
DROP POLICY IF EXISTS "companies_select" ON companies;
DROP POLICY IF EXISTS "companies_insert" ON companies;
DROP POLICY IF EXISTS "companies_update" ON companies;
DROP POLICY IF EXISTS "companies_delete" ON companies;
DROP POLICY IF EXISTS "companies_admin_all" ON companies;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON companies;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON companies;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON companies;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON companies;

DROP POLICY IF EXISTS "companies_select" ON companies;
CREATE POLICY "companies_select" ON companies FOR SELECT
  USING (
    is_service_role()
    OR owner_id = (SELECT auth.uid())

    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "companies_insert" ON companies;
CREATE POLICY "companies_insert" ON companies FOR INSERT
  WITH CHECK (is_service_role() OR owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "companies_update" ON companies;
CREATE POLICY "companies_update" ON companies FOR UPDATE
  USING (
    is_service_role()
    OR owner_id = (SELECT auth.uid())

    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "companies_delete" ON companies;
CREATE POLICY "companies_delete" ON companies FOR DELETE
  USING (
    is_service_role()
    OR owner_id = (SELECT auth.uid())

    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: contacts (uses owner_id, not user_id)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view contacts" ON contacts;
DROP POLICY IF EXISTS "Users can view their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can insert contacts" ON contacts;
DROP POLICY IF EXISTS "Users can insert their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON contacts;
DROP POLICY IF EXISTS "contacts_select" ON contacts;
DROP POLICY IF EXISTS "contacts_insert" ON contacts;
DROP POLICY IF EXISTS "contacts_update" ON contacts;
DROP POLICY IF EXISTS "contacts_delete" ON contacts;
DROP POLICY IF EXISTS "Admins can view all contacts" ON contacts;

DROP POLICY IF EXISTS "contacts_select" ON contacts;
CREATE POLICY "contacts_select" ON contacts FOR SELECT
  USING (
    is_service_role()
    OR owner_id = (SELECT auth.uid())

    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "contacts_insert" ON contacts;
CREATE POLICY "contacts_insert" ON contacts FOR INSERT
  WITH CHECK (is_service_role() OR owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "contacts_update" ON contacts;
CREATE POLICY "contacts_update" ON contacts FOR UPDATE
  USING (
    is_service_role()
    OR owner_id = (SELECT auth.uid())

    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "contacts_delete" ON contacts;
CREATE POLICY "contacts_delete" ON contacts FOR DELETE
  USING (
    is_service_role()
    OR owner_id = (SELECT auth.uid())

    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: deals (uses owner_id, not user_id)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own deals" ON deals;
DROP POLICY IF EXISTS "Users can insert their own deals" ON deals;
DROP POLICY IF EXISTS "Users can update their own deals" ON deals;
DROP POLICY IF EXISTS "Users can delete their own deals" ON deals;
DROP POLICY IF EXISTS "Admins can view all deals" ON deals;
DROP POLICY IF EXISTS "deals_select" ON deals;
DROP POLICY IF EXISTS "deals_insert" ON deals;
DROP POLICY IF EXISTS "deals_update" ON deals;
DROP POLICY IF EXISTS "deals_delete" ON deals;
DROP POLICY IF EXISTS "deals_full_access" ON deals;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON deals;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON deals;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON deals;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON deals;

DROP POLICY IF EXISTS "deals_select" ON deals;
CREATE POLICY "deals_select" ON deals FOR SELECT
  USING (
    is_service_role()
    OR owner_id = (SELECT auth.uid())

    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "deals_insert" ON deals;
CREATE POLICY "deals_insert" ON deals FOR INSERT
  WITH CHECK (is_service_role() OR owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "deals_update" ON deals;
CREATE POLICY "deals_update" ON deals FOR UPDATE
  USING (
    is_service_role()
    OR owner_id = (SELECT auth.uid())

    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "deals_delete" ON deals;
CREATE POLICY "deals_delete" ON deals FOR DELETE
  USING (
    is_service_role()
    OR owner_id = (SELECT auth.uid())

    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: activities
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own activities" ON activities;
DROP POLICY IF EXISTS "Users can insert their own activities" ON activities;
DROP POLICY IF EXISTS "Users can update their own activities" ON activities;
DROP POLICY IF EXISTS "Users can delete their own activities" ON activities;
DROP POLICY IF EXISTS "Admins can view all activities" ON activities;
DROP POLICY IF EXISTS "activities_select" ON activities;
DROP POLICY IF EXISTS "activities_insert" ON activities;
DROP POLICY IF EXISTS "activities_update" ON activities;
DROP POLICY IF EXISTS "activities_delete" ON activities;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON activities;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON activities;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON activities;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON activities;

DROP POLICY IF EXISTS "activities_select" ON activities;
CREATE POLICY "activities_select" ON activities FOR SELECT
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "activities_insert" ON activities;
CREATE POLICY "activities_insert" ON activities FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "activities_update" ON activities;
CREATE POLICY "activities_update" ON activities FOR UPDATE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "activities_delete" ON activities;
CREATE POLICY "activities_delete" ON activities FOR DELETE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: tasks
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON tasks;
DROP POLICY IF EXISTS "Admins can view all tasks" ON tasks;
DROP POLICY IF EXISTS "tasks_select" ON tasks;
DROP POLICY IF EXISTS "tasks_insert" ON tasks;
DROP POLICY IF EXISTS "tasks_update" ON tasks;
DROP POLICY IF EXISTS "tasks_delete" ON tasks;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON tasks;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON tasks;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON tasks;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON tasks;

DROP POLICY IF EXISTS "tasks_select" ON tasks;
CREATE POLICY "tasks_select" ON tasks FOR SELECT
  USING (
    is_service_role()
    OR owner_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "tasks_insert" ON tasks;
CREATE POLICY "tasks_insert" ON tasks FOR INSERT
  WITH CHECK (is_service_role() OR owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY "tasks_update" ON tasks FOR UPDATE
  USING (
    is_service_role()
    OR owner_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "tasks_delete" ON tasks;
CREATE POLICY "tasks_delete" ON tasks FOR DELETE
  USING (
    is_service_role()
    OR owner_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: meetings
-- ============================================================================

DROP POLICY IF EXISTS "meetings_select_policy" ON meetings;
DROP POLICY IF EXISTS "meetings_insert_policy" ON meetings;
DROP POLICY IF EXISTS "meetings_update_policy" ON meetings;
DROP POLICY IF EXISTS "meetings_delete_policy" ON meetings;
DROP POLICY IF EXISTS "meetings_full_access" ON meetings;
DROP POLICY IF EXISTS "meetings_service_role_all" ON meetings;
DROP POLICY IF EXISTS "Users can view their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can insert their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can update their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can delete their own meetings" ON meetings;
DROP POLICY IF EXISTS "Org members can view org meetings" ON meetings;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON meetings;

DROP POLICY IF EXISTS "meetings_select" ON meetings;
CREATE POLICY "meetings_select" ON meetings FOR SELECT
  USING (
    is_service_role()
    OR owner_user_id = (SELECT auth.uid())

    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "meetings_insert" ON meetings;
CREATE POLICY "meetings_insert" ON meetings FOR INSERT
  WITH CHECK (is_service_role() OR owner_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "meetings_update" ON meetings;
CREATE POLICY "meetings_update" ON meetings FOR UPDATE
  USING (
    is_service_role()
    OR owner_user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "meetings_delete" ON meetings;
CREATE POLICY "meetings_delete" ON meetings FOR DELETE
  USING (
    is_service_role()
    OR owner_user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: meeting_action_items
-- ============================================================================

DROP POLICY IF EXISTS "meeting_action_items_select" ON meeting_action_items;
DROP POLICY IF EXISTS "meeting_action_items_insert" ON meeting_action_items;
DROP POLICY IF EXISTS "meeting_action_items_update" ON meeting_action_items;
DROP POLICY IF EXISTS "meeting_action_items_delete" ON meeting_action_items;
DROP POLICY IF EXISTS "meeting_action_items_service_role" ON meeting_action_items;
DROP POLICY IF EXISTS "meeting_action_items_backup_admin_only" ON meeting_action_items;
DROP POLICY IF EXISTS "Users can view meeting action items" ON meeting_action_items;
DROP POLICY IF EXISTS "Users can insert meeting action items" ON meeting_action_items;
DROP POLICY IF EXISTS "Users can update meeting action items" ON meeting_action_items;
DROP POLICY IF EXISTS "Users can delete meeting action items" ON meeting_action_items;

DROP POLICY IF EXISTS "meeting_action_items_select" ON meeting_action_items;
CREATE POLICY "meeting_action_items_select" ON meeting_action_items FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_action_items.meeting_id
      AND m.owner_user_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "meeting_action_items_insert" ON meeting_action_items;
CREATE POLICY "meeting_action_items_insert" ON meeting_action_items FOR INSERT
  WITH CHECK (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_action_items.meeting_id
      AND m.owner_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "meeting_action_items_update" ON meeting_action_items;
CREATE POLICY "meeting_action_items_update" ON meeting_action_items FOR UPDATE
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_action_items.meeting_id
      AND m.owner_user_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "meeting_action_items_delete" ON meeting_action_items;
CREATE POLICY "meeting_action_items_delete" ON meeting_action_items FOR DELETE
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_action_items.meeting_id
      AND m.owner_user_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: meeting_index_queue
-- ============================================================================

DROP POLICY IF EXISTS "meeting_index_queue_select" ON meeting_index_queue;
DROP POLICY IF EXISTS "meeting_index_queue_insert" ON meeting_index_queue;
DROP POLICY IF EXISTS "meeting_index_queue_update" ON meeting_index_queue;
DROP POLICY IF EXISTS "meeting_index_queue_delete" ON meeting_index_queue;
DROP POLICY IF EXISTS "Users can view their queue items" ON meeting_index_queue;
DROP POLICY IF EXISTS "Users can insert queue items" ON meeting_index_queue;
DROP POLICY IF EXISTS "Users can update their queue items" ON meeting_index_queue;
DROP POLICY IF EXISTS "Users can delete their queue items" ON meeting_index_queue;
DROP POLICY IF EXISTS "Org members can view queue" ON meeting_index_queue;

DROP POLICY IF EXISTS "meeting_index_queue_select" ON meeting_index_queue;
CREATE POLICY "meeting_index_queue_select" ON meeting_index_queue FOR SELECT
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "meeting_index_queue_insert" ON meeting_index_queue;
CREATE POLICY "meeting_index_queue_insert" ON meeting_index_queue FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "meeting_index_queue_update" ON meeting_index_queue;
CREATE POLICY "meeting_index_queue_update" ON meeting_index_queue FOR UPDATE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "meeting_index_queue_delete" ON meeting_index_queue;
CREATE POLICY "meeting_index_queue_delete" ON meeting_index_queue FOR DELETE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: api_keys
-- ============================================================================

DROP POLICY IF EXISTS "api_keys_select" ON api_keys;
DROP POLICY IF EXISTS "api_keys_insert" ON api_keys;
DROP POLICY IF EXISTS "api_keys_update" ON api_keys;
DROP POLICY IF EXISTS "api_keys_delete" ON api_keys;
DROP POLICY IF EXISTS "Users can view their own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can create their own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can update their own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can delete their own API keys" ON api_keys;
DROP POLICY IF EXISTS "Allow admin full access" ON api_keys;

DROP POLICY IF EXISTS "api_keys_select" ON api_keys;
CREATE POLICY "api_keys_select" ON api_keys FOR SELECT
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "api_keys_insert" ON api_keys;
CREATE POLICY "api_keys_insert" ON api_keys FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "api_keys_update" ON api_keys;
CREATE POLICY "api_keys_update" ON api_keys FOR UPDATE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "api_keys_delete" ON api_keys;
CREATE POLICY "api_keys_delete" ON api_keys FOR DELETE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: slack_integrations
-- ============================================================================

DROP POLICY IF EXISTS "slack_integrations_select" ON slack_integrations;
DROP POLICY IF EXISTS "slack_integrations_insert" ON slack_integrations;
DROP POLICY IF EXISTS "slack_integrations_update" ON slack_integrations;
DROP POLICY IF EXISTS "slack_integrations_delete" ON slack_integrations;
DROP POLICY IF EXISTS "Users can view slack integrations" ON slack_integrations;
DROP POLICY IF EXISTS "Users can create slack integrations" ON slack_integrations;
DROP POLICY IF EXISTS "Users can update slack integrations" ON slack_integrations;
DROP POLICY IF EXISTS "Users can delete slack integrations" ON slack_integrations;
DROP POLICY IF EXISTS "Org admins manage slack integrations" ON slack_integrations;

DROP POLICY IF EXISTS "slack_integrations_select" ON slack_integrations;
CREATE POLICY "slack_integrations_select" ON slack_integrations FOR SELECT
  USING (
    is_service_role()

    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "slack_integrations_insert" ON slack_integrations;
CREATE POLICY "slack_integrations_insert" ON slack_integrations FOR INSERT
  WITH CHECK (
    is_service_role()

  );

DROP POLICY IF EXISTS "slack_integrations_update" ON slack_integrations;
CREATE POLICY "slack_integrations_update" ON slack_integrations FOR UPDATE
  USING (
    is_service_role()

    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "slack_integrations_delete" ON slack_integrations;
CREATE POLICY "slack_integrations_delete" ON slack_integrations FOR DELETE
  USING (
    is_service_role()

    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: slack_channels
-- ============================================================================

DROP POLICY IF EXISTS "slack_channels_select" ON slack_channels;
DROP POLICY IF EXISTS "slack_channels_insert" ON slack_channels;
DROP POLICY IF EXISTS "slack_channels_update" ON slack_channels;
DROP POLICY IF EXISTS "slack_channels_delete" ON slack_channels;
DROP POLICY IF EXISTS "Users can view slack channels" ON slack_channels;
DROP POLICY IF EXISTS "Users can create slack channels" ON slack_channels;
DROP POLICY IF EXISTS "Users can update slack channels" ON slack_channels;
DROP POLICY IF EXISTS "Users can delete slack channels" ON slack_channels;

DROP POLICY IF EXISTS "slack_channels_select" ON slack_channels;
CREATE POLICY "slack_channels_select" ON slack_channels FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM slack_integrations si
      WHERE si.id = slack_channels.integration_id
      AND si.user_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "slack_channels_insert" ON slack_channels;
CREATE POLICY "slack_channels_insert" ON slack_channels FOR INSERT
  WITH CHECK (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM slack_integrations si
      WHERE si.id = slack_channels.integration_id
      AND si.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "slack_channels_update" ON slack_channels;
CREATE POLICY "slack_channels_update" ON slack_channels FOR UPDATE
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM slack_integrations si
      WHERE si.id = slack_channels.integration_id
      AND si.user_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "slack_channels_delete" ON slack_channels;
CREATE POLICY "slack_channels_delete" ON slack_channels FOR DELETE
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM slack_integrations si
      WHERE si.id = slack_channels.integration_id
      AND si.user_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: meeting_file_search_index
-- ============================================================================

DROP POLICY IF EXISTS "meeting_file_search_index_select" ON meeting_file_search_index;
DROP POLICY IF EXISTS "meeting_file_search_index_insert" ON meeting_file_search_index;
DROP POLICY IF EXISTS "meeting_file_search_index_update" ON meeting_file_search_index;
DROP POLICY IF EXISTS "meeting_file_search_index_delete" ON meeting_file_search_index;
DROP POLICY IF EXISTS "Users can view file search index" ON meeting_file_search_index;
DROP POLICY IF EXISTS "Users can insert file search index" ON meeting_file_search_index;
DROP POLICY IF EXISTS "Users can update file search index" ON meeting_file_search_index;
DROP POLICY IF EXISTS "Users can delete file search index" ON meeting_file_search_index;

DROP POLICY IF EXISTS "meeting_file_search_index_select" ON meeting_file_search_index;
CREATE POLICY "meeting_file_search_index_select" ON meeting_file_search_index FOR SELECT
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())

    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "meeting_file_search_index_insert" ON meeting_file_search_index;
CREATE POLICY "meeting_file_search_index_insert" ON meeting_file_search_index FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "meeting_file_search_index_update" ON meeting_file_search_index;
CREATE POLICY "meeting_file_search_index_update" ON meeting_file_search_index FOR UPDATE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "meeting_file_search_index_delete" ON meeting_file_search_index;
CREATE POLICY "meeting_file_search_index_delete" ON meeting_file_search_index FOR DELETE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: fathom_integrations
-- ============================================================================

DROP POLICY IF EXISTS "fathom_integrations_select" ON fathom_integrations;
DROP POLICY IF EXISTS "fathom_integrations_insert" ON fathom_integrations;
DROP POLICY IF EXISTS "fathom_integrations_update" ON fathom_integrations;
DROP POLICY IF EXISTS "fathom_integrations_delete" ON fathom_integrations;
DROP POLICY IF EXISTS "Users can view their fathom integrations" ON fathom_integrations;
DROP POLICY IF EXISTS "Users can create fathom integrations" ON fathom_integrations;
DROP POLICY IF EXISTS "Users can update their fathom integrations" ON fathom_integrations;
DROP POLICY IF EXISTS "Users can delete their fathom integrations" ON fathom_integrations;

DROP POLICY IF EXISTS "fathom_integrations_select" ON fathom_integrations;
CREATE POLICY "fathom_integrations_select" ON fathom_integrations FOR SELECT
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "fathom_integrations_insert" ON fathom_integrations;
CREATE POLICY "fathom_integrations_insert" ON fathom_integrations FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "fathom_integrations_update" ON fathom_integrations;
CREATE POLICY "fathom_integrations_update" ON fathom_integrations FOR UPDATE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "fathom_integrations_delete" ON fathom_integrations;
CREATE POLICY "fathom_integrations_delete" ON fathom_integrations FOR DELETE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: fathom_sync_state
-- ============================================================================

DROP POLICY IF EXISTS "fathom_sync_state_select" ON fathom_sync_state;
DROP POLICY IF EXISTS "fathom_sync_state_insert" ON fathom_sync_state;
DROP POLICY IF EXISTS "fathom_sync_state_update" ON fathom_sync_state;
DROP POLICY IF EXISTS "fathom_sync_state_delete" ON fathom_sync_state;
DROP POLICY IF EXISTS "Users can view their sync state" ON fathom_sync_state;
DROP POLICY IF EXISTS "Users can create sync state" ON fathom_sync_state;
DROP POLICY IF EXISTS "Users can update their sync state" ON fathom_sync_state;
DROP POLICY IF EXISTS "Users can delete their sync state" ON fathom_sync_state;

DROP POLICY IF EXISTS "fathom_sync_state_select" ON fathom_sync_state;
CREATE POLICY "fathom_sync_state_select" ON fathom_sync_state FOR SELECT
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "fathom_sync_state_insert" ON fathom_sync_state;
CREATE POLICY "fathom_sync_state_insert" ON fathom_sync_state FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "fathom_sync_state_update" ON fathom_sync_state;
CREATE POLICY "fathom_sync_state_update" ON fathom_sync_state FOR UPDATE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "fathom_sync_state_delete" ON fathom_sync_state;
CREATE POLICY "fathom_sync_state_delete" ON fathom_sync_state FOR DELETE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: roadmap_comments
-- ============================================================================

DROP POLICY IF EXISTS "roadmap_comments_select" ON roadmap_comments;
DROP POLICY IF EXISTS "roadmap_comments_insert" ON roadmap_comments;
DROP POLICY IF EXISTS "roadmap_comments_update" ON roadmap_comments;
DROP POLICY IF EXISTS "roadmap_comments_delete" ON roadmap_comments;
DROP POLICY IF EXISTS "Users can view comments" ON roadmap_comments;
DROP POLICY IF EXISTS "Users can create comments" ON roadmap_comments;
DROP POLICY IF EXISTS "Users can update their comments" ON roadmap_comments;
DROP POLICY IF EXISTS "Users can delete their comments" ON roadmap_comments;
DROP POLICY IF EXISTS "Anyone can view comments" ON roadmap_comments;
DROP POLICY IF EXISTS "Authenticated users can insert comments" ON roadmap_comments;

DROP POLICY IF EXISTS "roadmap_comments_select" ON roadmap_comments;
CREATE POLICY "roadmap_comments_select" ON roadmap_comments FOR SELECT
  USING (true);  -- Public read for roadmap comments

DROP POLICY IF EXISTS "roadmap_comments_insert" ON roadmap_comments;
CREATE POLICY "roadmap_comments_insert" ON roadmap_comments FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "roadmap_comments_update" ON roadmap_comments;
CREATE POLICY "roadmap_comments_update" ON roadmap_comments FOR UPDATE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "roadmap_comments_delete" ON roadmap_comments;
CREATE POLICY "roadmap_comments_delete" ON roadmap_comments FOR DELETE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: user_file_search_stores
-- ============================================================================

DROP POLICY IF EXISTS "user_file_search_stores_select" ON user_file_search_stores;
DROP POLICY IF EXISTS "user_file_search_stores_insert" ON user_file_search_stores;
DROP POLICY IF EXISTS "user_file_search_stores_update" ON user_file_search_stores;
DROP POLICY IF EXISTS "user_file_search_stores_delete" ON user_file_search_stores;
DROP POLICY IF EXISTS "Users can view their file stores" ON user_file_search_stores;
DROP POLICY IF EXISTS "Users can create file stores" ON user_file_search_stores;
DROP POLICY IF EXISTS "Users can update their file stores" ON user_file_search_stores;
DROP POLICY IF EXISTS "Users can delete their file stores" ON user_file_search_stores;

DROP POLICY IF EXISTS "user_file_search_stores_select" ON user_file_search_stores;
CREATE POLICY "user_file_search_stores_select" ON user_file_search_stores FOR SELECT
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "user_file_search_stores_insert" ON user_file_search_stores;
CREATE POLICY "user_file_search_stores_insert" ON user_file_search_stores FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_file_search_stores_update" ON user_file_search_stores;
CREATE POLICY "user_file_search_stores_update" ON user_file_search_stores FOR UPDATE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "user_file_search_stores_delete" ON user_file_search_stores;
CREATE POLICY "user_file_search_stores_delete" ON user_file_search_stores FOR DELETE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: user_notifications
-- ============================================================================

DROP POLICY IF EXISTS "user_notifications_select" ON user_notifications;
DROP POLICY IF EXISTS "user_notifications_insert" ON user_notifications;
DROP POLICY IF EXISTS "user_notifications_update" ON user_notifications;
DROP POLICY IF EXISTS "user_notifications_delete" ON user_notifications;
DROP POLICY IF EXISTS "Users can view their notifications" ON user_notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON user_notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON user_notifications;
DROP POLICY IF EXISTS "Users can delete their notifications" ON user_notifications;
DROP POLICY IF EXISTS "service_role_insert_notifications" ON user_notifications;

DROP POLICY IF EXISTS "user_notifications_select" ON user_notifications;
CREATE POLICY "user_notifications_select" ON user_notifications FOR SELECT
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "user_notifications_insert" ON user_notifications;
CREATE POLICY "user_notifications_insert" ON user_notifications FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_notifications_update" ON user_notifications;
CREATE POLICY "user_notifications_update" ON user_notifications FOR UPDATE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "user_notifications_delete" ON user_notifications;
CREATE POLICY "user_notifications_delete" ON user_notifications FOR DELETE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: slack_deal_rooms
-- ============================================================================

DROP POLICY IF EXISTS "slack_deal_rooms_select" ON slack_deal_rooms;
DROP POLICY IF EXISTS "slack_deal_rooms_insert" ON slack_deal_rooms;
DROP POLICY IF EXISTS "slack_deal_rooms_update" ON slack_deal_rooms;
DROP POLICY IF EXISTS "slack_deal_rooms_delete" ON slack_deal_rooms;
DROP POLICY IF EXISTS "org_members_view_deal_rooms" ON slack_deal_rooms;
DROP POLICY IF EXISTS "service_role_manage_deal_rooms" ON slack_deal_rooms;

DROP POLICY IF EXISTS "slack_deal_rooms_select" ON slack_deal_rooms;
CREATE POLICY "slack_deal_rooms_select" ON slack_deal_rooms FOR SELECT
  USING (
    is_service_role()

    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "slack_deal_rooms_insert" ON slack_deal_rooms;
CREATE POLICY "slack_deal_rooms_insert" ON slack_deal_rooms FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "slack_deal_rooms_update" ON slack_deal_rooms;
CREATE POLICY "slack_deal_rooms_update" ON slack_deal_rooms FOR UPDATE
  USING (
    is_service_role()

    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "slack_deal_rooms_delete" ON slack_deal_rooms;
CREATE POLICY "slack_deal_rooms_delete" ON slack_deal_rooms FOR DELETE
  USING (
    is_service_role()

    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: rate_limit
-- ============================================================================

DROP POLICY IF EXISTS "rate_limit_select" ON rate_limit;
DROP POLICY IF EXISTS "rate_limit_insert" ON rate_limit;
DROP POLICY IF EXISTS "rate_limit_update" ON rate_limit;
DROP POLICY IF EXISTS "rate_limit_delete" ON rate_limit;
DROP POLICY IF EXISTS "Users can view their rate limits" ON rate_limit;
DROP POLICY IF EXISTS "Users can create rate limits" ON rate_limit;
DROP POLICY IF EXISTS "Users can update their rate limits" ON rate_limit;
DROP POLICY IF EXISTS "Users can delete their rate limits" ON rate_limit;

DROP POLICY IF EXISTS "rate_limit_select" ON rate_limit;
CREATE POLICY "rate_limit_select" ON rate_limit FOR SELECT
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "rate_limit_insert" ON rate_limit;
CREATE POLICY "rate_limit_insert" ON rate_limit FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "rate_limit_update" ON rate_limit;
CREATE POLICY "rate_limit_update" ON rate_limit FOR UPDATE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "rate_limit_delete" ON rate_limit;
CREATE POLICY "rate_limit_delete" ON rate_limit FOR DELETE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: meeting_intelligence_queries
-- ============================================================================

DROP POLICY IF EXISTS "meeting_intelligence_queries_select" ON meeting_intelligence_queries;
DROP POLICY IF EXISTS "meeting_intelligence_queries_insert" ON meeting_intelligence_queries;
DROP POLICY IF EXISTS "meeting_intelligence_queries_update" ON meeting_intelligence_queries;
DROP POLICY IF EXISTS "meeting_intelligence_queries_delete" ON meeting_intelligence_queries;
DROP POLICY IF EXISTS "Users can view their queries" ON meeting_intelligence_queries;
DROP POLICY IF EXISTS "Users can create queries" ON meeting_intelligence_queries;
DROP POLICY IF EXISTS "Users can update their queries" ON meeting_intelligence_queries;
DROP POLICY IF EXISTS "Users can delete their queries" ON meeting_intelligence_queries;

DROP POLICY IF EXISTS "meeting_intelligence_queries_select" ON meeting_intelligence_queries;
CREATE POLICY "meeting_intelligence_queries_select" ON meeting_intelligence_queries FOR SELECT
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "meeting_intelligence_queries_insert" ON meeting_intelligence_queries;
CREATE POLICY "meeting_intelligence_queries_insert" ON meeting_intelligence_queries FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "meeting_intelligence_queries_update" ON meeting_intelligence_queries;
CREATE POLICY "meeting_intelligence_queries_update" ON meeting_intelligence_queries FOR UPDATE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "meeting_intelligence_queries_delete" ON meeting_intelligence_queries;
CREATE POLICY "meeting_intelligence_queries_delete" ON meeting_intelligence_queries FOR DELETE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: deal_splits
-- ============================================================================

DROP POLICY IF EXISTS "deal_splits_select" ON deal_splits;
DROP POLICY IF EXISTS "deal_splits_insert" ON deal_splits;
DROP POLICY IF EXISTS "deal_splits_update" ON deal_splits;
DROP POLICY IF EXISTS "deal_splits_delete" ON deal_splits;
DROP POLICY IF EXISTS "Users can view deal splits" ON deal_splits;
DROP POLICY IF EXISTS "Admins can insert deal splits" ON deal_splits;
DROP POLICY IF EXISTS "Admins can update deal splits" ON deal_splits;
DROP POLICY IF EXISTS "Admins can delete deal splits" ON deal_splits;

DROP POLICY IF EXISTS "deal_splits_select" ON deal_splits;
CREATE POLICY "deal_splits_select" ON deal_splits FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = deal_splits.deal_id
      AND d.owner_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "deal_splits_insert" ON deal_splits;
CREATE POLICY "deal_splits_insert" ON deal_splits FOR INSERT
  WITH CHECK (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "deal_splits_update" ON deal_splits;
CREATE POLICY "deal_splits_update" ON deal_splits FOR UPDATE
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "deal_splits_delete" ON deal_splits;
CREATE POLICY "deal_splits_delete" ON deal_splits FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: roadmap_suggestions
-- ============================================================================

DROP POLICY IF EXISTS "roadmap_suggestions_select" ON roadmap_suggestions;
DROP POLICY IF EXISTS "roadmap_suggestions_insert" ON roadmap_suggestions;
DROP POLICY IF EXISTS "roadmap_suggestions_update" ON roadmap_suggestions;
DROP POLICY IF EXISTS "roadmap_suggestions_delete" ON roadmap_suggestions;
DROP POLICY IF EXISTS "Users can view roadmap suggestions" ON roadmap_suggestions;
DROP POLICY IF EXISTS "Users can create roadmap suggestions" ON roadmap_suggestions;
DROP POLICY IF EXISTS "Users can update their roadmap suggestions" ON roadmap_suggestions;
DROP POLICY IF EXISTS "Users can delete their roadmap suggestions" ON roadmap_suggestions;
DROP POLICY IF EXISTS "Anyone can view suggestions" ON roadmap_suggestions;

DROP POLICY IF EXISTS "roadmap_suggestions_select" ON roadmap_suggestions;
CREATE POLICY "roadmap_suggestions_select" ON roadmap_suggestions FOR SELECT
  USING (true);  -- Public read for roadmap

DROP POLICY IF EXISTS "roadmap_suggestions_insert" ON roadmap_suggestions;
CREATE POLICY "roadmap_suggestions_insert" ON roadmap_suggestions FOR INSERT
  WITH CHECK (is_service_role() OR submitted_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "roadmap_suggestions_update" ON roadmap_suggestions;
CREATE POLICY "roadmap_suggestions_update" ON roadmap_suggestions FOR UPDATE
  USING (
    is_service_role()
    OR submitted_by = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "roadmap_suggestions_delete" ON roadmap_suggestions;
CREATE POLICY "roadmap_suggestions_delete" ON roadmap_suggestions FOR DELETE
  USING (
    is_service_role()
    OR submitted_by = (SELECT auth.uid())
    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: meeting_generated_content
-- ============================================================================

DROP POLICY IF EXISTS "meeting_generated_content_select" ON meeting_generated_content;
DROP POLICY IF EXISTS "meeting_generated_content_insert" ON meeting_generated_content;
DROP POLICY IF EXISTS "meeting_generated_content_update" ON meeting_generated_content;
DROP POLICY IF EXISTS "meeting_generated_content_delete" ON meeting_generated_content;
DROP POLICY IF EXISTS "Users can view generated content" ON meeting_generated_content;
DROP POLICY IF EXISTS "Users can create generated content" ON meeting_generated_content;
DROP POLICY IF EXISTS "Users can update generated content" ON meeting_generated_content;
DROP POLICY IF EXISTS "Users can delete generated content" ON meeting_generated_content;

DROP POLICY IF EXISTS "meeting_generated_content_select" ON meeting_generated_content;
CREATE POLICY "meeting_generated_content_select" ON meeting_generated_content FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM meetings m WHERE m.id = meeting_generated_content.meeting_id
      AND m.owner_user_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "meeting_generated_content_insert" ON meeting_generated_content;
CREATE POLICY "meeting_generated_content_insert" ON meeting_generated_content FOR INSERT
  WITH CHECK (is_service_role() OR created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "meeting_generated_content_update" ON meeting_generated_content;
CREATE POLICY "meeting_generated_content_update" ON meeting_generated_content FOR UPDATE
  USING (
    is_service_role()
    OR created_by = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "meeting_generated_content_delete" ON meeting_generated_content;
CREATE POLICY "meeting_generated_content_delete" ON meeting_generated_content FOR DELETE
  USING (
    is_service_role()
    OR created_by = (SELECT auth.uid())
    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: meeting_content_topics
-- ============================================================================

DROP POLICY IF EXISTS "meeting_content_topics_select" ON meeting_content_topics;
DROP POLICY IF EXISTS "meeting_content_topics_insert" ON meeting_content_topics;
DROP POLICY IF EXISTS "meeting_content_topics_update" ON meeting_content_topics;
DROP POLICY IF EXISTS "meeting_content_topics_delete" ON meeting_content_topics;
DROP POLICY IF EXISTS "Users can view content topics" ON meeting_content_topics;
DROP POLICY IF EXISTS "Users can create content topics" ON meeting_content_topics;
DROP POLICY IF EXISTS "Users can update content topics" ON meeting_content_topics;
DROP POLICY IF EXISTS "Users can delete content topics" ON meeting_content_topics;

DROP POLICY IF EXISTS "meeting_content_topics_select" ON meeting_content_topics;
CREATE POLICY "meeting_content_topics_select" ON meeting_content_topics FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_content_topics.meeting_id
      AND m.owner_user_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "meeting_content_topics_insert" ON meeting_content_topics;
CREATE POLICY "meeting_content_topics_insert" ON meeting_content_topics FOR INSERT
  WITH CHECK (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_content_topics.meeting_id
      AND m.owner_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "meeting_content_topics_update" ON meeting_content_topics;
CREATE POLICY "meeting_content_topics_update" ON meeting_content_topics FOR UPDATE
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_content_topics.meeting_id
      AND m.owner_user_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "meeting_content_topics_delete" ON meeting_content_topics;
CREATE POLICY "meeting_content_topics_delete" ON meeting_content_topics FOR DELETE
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_content_topics.meeting_id
      AND m.owner_user_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: waitlist_shares
-- ============================================================================

DROP POLICY IF EXISTS "waitlist_shares_select" ON waitlist_shares;
DROP POLICY IF EXISTS "waitlist_shares_insert" ON waitlist_shares;
DROP POLICY IF EXISTS "waitlist_shares_update" ON waitlist_shares;
DROP POLICY IF EXISTS "waitlist_shares_delete" ON waitlist_shares;
DROP POLICY IF EXISTS "Users can view their shares" ON waitlist_shares;
DROP POLICY IF EXISTS "Users can create shares" ON waitlist_shares;
DROP POLICY IF EXISTS "Users can update their shares" ON waitlist_shares;

DROP POLICY IF EXISTS "waitlist_shares_select" ON waitlist_shares;
CREATE POLICY "waitlist_shares_select" ON waitlist_shares FOR SELECT
  USING (
    is_service_role()
    OR is_admin_optimized()
    OR (SELECT auth.uid()) IS NOT NULL  -- Authenticated users can view
  );

DROP POLICY IF EXISTS "waitlist_shares_insert" ON waitlist_shares;
CREATE POLICY "waitlist_shares_insert" ON waitlist_shares FOR INSERT
  WITH CHECK (is_service_role() OR (SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "waitlist_shares_update" ON waitlist_shares;
CREATE POLICY "waitlist_shares_update" ON waitlist_shares FOR UPDATE
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "waitlist_shares_delete" ON waitlist_shares;
CREATE POLICY "waitlist_shares_delete" ON waitlist_shares FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: organization_memberships
-- ============================================================================

DROP POLICY IF EXISTS "organization_memberships_select" ON organization_memberships;
DROP POLICY IF EXISTS "organization_memberships_insert" ON organization_memberships;
DROP POLICY IF EXISTS "organization_memberships_update" ON organization_memberships;
DROP POLICY IF EXISTS "organization_memberships_delete" ON organization_memberships;
DROP POLICY IF EXISTS "memberships_select_own" ON organization_memberships;
DROP POLICY IF EXISTS "memberships_insert_allowed" ON organization_memberships;
DROP POLICY IF EXISTS "memberships_update_by_admins" ON organization_memberships;
DROP POLICY IF EXISTS "memberships_delete_by_admins" ON organization_memberships;

DROP POLICY IF EXISTS "organization_memberships_select" ON organization_memberships;
CREATE POLICY "organization_memberships_select" ON organization_memberships FOR SELECT
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())

    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "organization_memberships_insert" ON organization_memberships;
CREATE POLICY "organization_memberships_insert" ON organization_memberships FOR INSERT
  WITH CHECK (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "organization_memberships_update" ON organization_memberships;
CREATE POLICY "organization_memberships_update" ON organization_memberships FOR UPDATE
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "organization_memberships_delete" ON organization_memberships;
CREATE POLICY "organization_memberships_delete" ON organization_memberships FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: branding_settings
-- ============================================================================

DROP POLICY IF EXISTS "branding_settings_select" ON branding_settings;
DROP POLICY IF EXISTS "branding_settings_insert" ON branding_settings;
DROP POLICY IF EXISTS "branding_settings_update" ON branding_settings;
DROP POLICY IF EXISTS "branding_settings_delete" ON branding_settings;
DROP POLICY IF EXISTS "Users can view branding settings" ON branding_settings;
DROP POLICY IF EXISTS "Users can create branding settings" ON branding_settings;
DROP POLICY IF EXISTS "Users can update branding settings" ON branding_settings;

DROP POLICY IF EXISTS "branding_settings_select" ON branding_settings;
CREATE POLICY "branding_settings_select" ON branding_settings FOR SELECT
  USING (
    is_service_role()
    OR is_admin_optimized()
    OR (SELECT auth.uid()) IS NOT NULL  -- Authenticated users can view branding
  );

DROP POLICY IF EXISTS "branding_settings_insert" ON branding_settings;
CREATE POLICY "branding_settings_insert" ON branding_settings FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "branding_settings_update" ON branding_settings;
CREATE POLICY "branding_settings_update" ON branding_settings FOR UPDATE
  USING (
    is_service_role()

    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "branding_settings_delete" ON branding_settings;
CREATE POLICY "branding_settings_delete" ON branding_settings FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: waitlist_email_invites
-- ============================================================================

DROP POLICY IF EXISTS "waitlist_email_invites_select" ON waitlist_email_invites;
DROP POLICY IF EXISTS "waitlist_email_invites_insert" ON waitlist_email_invites;
DROP POLICY IF EXISTS "waitlist_email_invites_update" ON waitlist_email_invites;
DROP POLICY IF EXISTS "waitlist_email_invites_delete" ON waitlist_email_invites;
DROP POLICY IF EXISTS "Users can view their invites" ON waitlist_email_invites;
DROP POLICY IF EXISTS "Users can create invites" ON waitlist_email_invites;

DROP POLICY IF EXISTS "waitlist_email_invites_select" ON waitlist_email_invites;
CREATE POLICY "waitlist_email_invites_select" ON waitlist_email_invites FOR SELECT
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "waitlist_email_invites_insert" ON waitlist_email_invites;
CREATE POLICY "waitlist_email_invites_insert" ON waitlist_email_invites FOR INSERT
  WITH CHECK (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "waitlist_email_invites_update" ON waitlist_email_invites;
CREATE POLICY "waitlist_email_invites_update" ON waitlist_email_invites FOR UPDATE
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "waitlist_email_invites_delete" ON waitlist_email_invites;
CREATE POLICY "waitlist_email_invites_delete" ON waitlist_email_invites FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: usage_events
-- ============================================================================

DROP POLICY IF EXISTS "usage_events_select" ON usage_events;
DROP POLICY IF EXISTS "usage_events_insert" ON usage_events;
DROP POLICY IF EXISTS "usage_events_update" ON usage_events;
DROP POLICY IF EXISTS "usage_events_delete" ON usage_events;
DROP POLICY IF EXISTS "Users can view their usage events" ON usage_events;
DROP POLICY IF EXISTS "Users can create usage events" ON usage_events;

DROP POLICY IF EXISTS "usage_events_select" ON usage_events;
CREATE POLICY "usage_events_select" ON usage_events FOR SELECT
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())

    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "usage_events_insert" ON usage_events;
CREATE POLICY "usage_events_insert" ON usage_events FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "usage_events_update" ON usage_events;
CREATE POLICY "usage_events_update" ON usage_events FOR UPDATE
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "usage_events_delete" ON usage_events;
CREATE POLICY "usage_events_delete" ON usage_events FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: teams
-- ============================================================================

DROP POLICY IF EXISTS "teams_select" ON teams;
DROP POLICY IF EXISTS "teams_insert" ON teams;
DROP POLICY IF EXISTS "teams_update" ON teams;
DROP POLICY IF EXISTS "teams_delete" ON teams;
DROP POLICY IF EXISTS "Enable read access for team members" ON teams;
DROP POLICY IF EXISTS "Users can view their teams" ON teams;
DROP POLICY IF EXISTS "Users can create teams" ON teams;
DROP POLICY IF EXISTS "Users can update their teams" ON teams;

DROP POLICY IF EXISTS "teams_select" ON teams;
CREATE POLICY "teams_select" ON teams FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = teams.id
      AND tm.user_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "teams_insert" ON teams;
CREATE POLICY "teams_insert" ON teams FOR INSERT
  WITH CHECK (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "teams_update" ON teams;
CREATE POLICY "teams_update" ON teams FOR UPDATE
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "teams_delete" ON teams;
CREATE POLICY "teams_delete" ON teams FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: subscription_seat_usage
-- ============================================================================

DROP POLICY IF EXISTS "subscription_seat_usage_select" ON subscription_seat_usage;
DROP POLICY IF EXISTS "subscription_seat_usage_insert" ON subscription_seat_usage;
DROP POLICY IF EXISTS "subscription_seat_usage_update" ON subscription_seat_usage;
DROP POLICY IF EXISTS "subscription_seat_usage_delete" ON subscription_seat_usage;

DROP POLICY IF EXISTS "subscription_seat_usage_select" ON subscription_seat_usage;
CREATE POLICY "subscription_seat_usage_select" ON subscription_seat_usage FOR SELECT
  USING (
    is_service_role()

    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "subscription_seat_usage_insert" ON subscription_seat_usage;
CREATE POLICY "subscription_seat_usage_insert" ON subscription_seat_usage FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "subscription_seat_usage_update" ON subscription_seat_usage;
CREATE POLICY "subscription_seat_usage_update" ON subscription_seat_usage FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "subscription_seat_usage_delete" ON subscription_seat_usage;
CREATE POLICY "subscription_seat_usage_delete" ON subscription_seat_usage FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: subscription_plans
-- ============================================================================

DROP POLICY IF EXISTS "subscription_plans_select" ON subscription_plans;
DROP POLICY IF EXISTS "subscription_plans_insert" ON subscription_plans;
DROP POLICY IF EXISTS "subscription_plans_update" ON subscription_plans;
DROP POLICY IF EXISTS "subscription_plans_delete" ON subscription_plans;
DROP POLICY IF EXISTS "Anyone can view subscription plans" ON subscription_plans;

DROP POLICY IF EXISTS "subscription_plans_select" ON subscription_plans;
CREATE POLICY "subscription_plans_select" ON subscription_plans FOR SELECT
  USING (true);  -- Public read for pricing page

DROP POLICY IF EXISTS "subscription_plans_insert" ON subscription_plans;
CREATE POLICY "subscription_plans_insert" ON subscription_plans FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "subscription_plans_update" ON subscription_plans;
CREATE POLICY "subscription_plans_update" ON subscription_plans FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "subscription_plans_delete" ON subscription_plans;
CREATE POLICY "subscription_plans_delete" ON subscription_plans FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: smart_task_templates
-- ============================================================================

DROP POLICY IF EXISTS "smart_task_templates_select" ON smart_task_templates;
DROP POLICY IF EXISTS "smart_task_templates_insert" ON smart_task_templates;
DROP POLICY IF EXISTS "smart_task_templates_update" ON smart_task_templates;
DROP POLICY IF EXISTS "smart_task_templates_delete" ON smart_task_templates;

DROP POLICY IF EXISTS "smart_task_templates_select" ON smart_task_templates;
CREATE POLICY "smart_task_templates_select" ON smart_task_templates FOR SELECT
  USING (
    is_service_role()
    OR created_by = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "smart_task_templates_insert" ON smart_task_templates;
CREATE POLICY "smart_task_templates_insert" ON smart_task_templates FOR INSERT
  WITH CHECK (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "smart_task_templates_update" ON smart_task_templates;
CREATE POLICY "smart_task_templates_update" ON smart_task_templates FOR UPDATE
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "smart_task_templates_delete" ON smart_task_templates;
CREATE POLICY "smart_task_templates_delete" ON smart_task_templates FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: organization_usage
-- ============================================================================

DROP POLICY IF EXISTS "organization_usage_select" ON organization_usage;
DROP POLICY IF EXISTS "organization_usage_insert" ON organization_usage;
DROP POLICY IF EXISTS "organization_usage_update" ON organization_usage;
DROP POLICY IF EXISTS "organization_usage_delete" ON organization_usage;

DROP POLICY IF EXISTS "organization_usage_select" ON organization_usage;
CREATE POLICY "organization_usage_select" ON organization_usage FOR SELECT
  USING (
    is_service_role()

    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "organization_usage_insert" ON organization_usage;
CREATE POLICY "organization_usage_insert" ON organization_usage FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "organization_usage_update" ON organization_usage;
CREATE POLICY "organization_usage_update" ON organization_usage FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "organization_usage_delete" ON organization_usage;
CREATE POLICY "organization_usage_delete" ON organization_usage FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: organization_subscriptions
-- ============================================================================

DROP POLICY IF EXISTS "organization_subscriptions_select" ON organization_subscriptions;
DROP POLICY IF EXISTS "organization_subscriptions_insert" ON organization_subscriptions;
DROP POLICY IF EXISTS "organization_subscriptions_update" ON organization_subscriptions;
DROP POLICY IF EXISTS "organization_subscriptions_delete" ON organization_subscriptions;

DROP POLICY IF EXISTS "organization_subscriptions_select" ON organization_subscriptions;
CREATE POLICY "organization_subscriptions_select" ON organization_subscriptions FOR SELECT
  USING (
    is_service_role()

    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "organization_subscriptions_insert" ON organization_subscriptions;
CREATE POLICY "organization_subscriptions_insert" ON organization_subscriptions FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "organization_subscriptions_update" ON organization_subscriptions;
CREATE POLICY "organization_subscriptions_update" ON organization_subscriptions FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "organization_subscriptions_delete" ON organization_subscriptions;
CREATE POLICY "organization_subscriptions_delete" ON organization_subscriptions FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: organization_feature_flags
-- ============================================================================

DROP POLICY IF EXISTS "organization_feature_flags_select" ON organization_feature_flags;
DROP POLICY IF EXISTS "organization_feature_flags_insert" ON organization_feature_flags;
DROP POLICY IF EXISTS "organization_feature_flags_update" ON organization_feature_flags;
DROP POLICY IF EXISTS "organization_feature_flags_delete" ON organization_feature_flags;

DROP POLICY IF EXISTS "organization_feature_flags_select" ON organization_feature_flags;
CREATE POLICY "organization_feature_flags_select" ON organization_feature_flags FOR SELECT
  USING (
    is_service_role()

    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "organization_feature_flags_insert" ON organization_feature_flags;
CREATE POLICY "organization_feature_flags_insert" ON organization_feature_flags FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "organization_feature_flags_update" ON organization_feature_flags;
CREATE POLICY "organization_feature_flags_update" ON organization_feature_flags FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "organization_feature_flags_delete" ON organization_feature_flags;
CREATE POLICY "organization_feature_flags_delete" ON organization_feature_flags FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: org_file_search_stores
-- ============================================================================

DROP POLICY IF EXISTS "org_file_search_stores_select" ON org_file_search_stores;
DROP POLICY IF EXISTS "org_file_search_stores_insert" ON org_file_search_stores;
DROP POLICY IF EXISTS "org_file_search_stores_update" ON org_file_search_stores;
DROP POLICY IF EXISTS "org_file_search_stores_delete" ON org_file_search_stores;

DROP POLICY IF EXISTS "org_file_search_stores_select" ON org_file_search_stores;
CREATE POLICY "org_file_search_stores_select" ON org_file_search_stores FOR SELECT
  USING (
    is_service_role()

    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "org_file_search_stores_insert" ON org_file_search_stores;
CREATE POLICY "org_file_search_stores_insert" ON org_file_search_stores FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "org_file_search_stores_update" ON org_file_search_stores;
CREATE POLICY "org_file_search_stores_update" ON org_file_search_stores FOR UPDATE
  USING (
    is_service_role()

    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "org_file_search_stores_delete" ON org_file_search_stores;
CREATE POLICY "org_file_search_stores_delete" ON org_file_search_stores FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: meeting_topics
-- ============================================================================

DROP POLICY IF EXISTS "meeting_topics_select" ON meeting_topics;
DROP POLICY IF EXISTS "meeting_topics_insert" ON meeting_topics;
DROP POLICY IF EXISTS "meeting_topics_update" ON meeting_topics;
DROP POLICY IF EXISTS "meeting_topics_delete" ON meeting_topics;

DROP POLICY IF EXISTS "meeting_topics_select" ON meeting_topics;
CREATE POLICY "meeting_topics_select" ON meeting_topics FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_topics.meeting_id
      AND m.owner_user_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "meeting_topics_insert" ON meeting_topics;
CREATE POLICY "meeting_topics_insert" ON meeting_topics FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "meeting_topics_update" ON meeting_topics;
CREATE POLICY "meeting_topics_update" ON meeting_topics FOR UPDATE
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "meeting_topics_delete" ON meeting_topics;
CREATE POLICY "meeting_topics_delete" ON meeting_topics FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: meeting_metrics
-- ============================================================================

DROP POLICY IF EXISTS "meeting_metrics_select" ON meeting_metrics;
DROP POLICY IF EXISTS "meeting_metrics_insert" ON meeting_metrics;
DROP POLICY IF EXISTS "meeting_metrics_update" ON meeting_metrics;
DROP POLICY IF EXISTS "meeting_metrics_delete" ON meeting_metrics;

DROP POLICY IF EXISTS "meeting_metrics_select" ON meeting_metrics;
CREATE POLICY "meeting_metrics_select" ON meeting_metrics FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_metrics.meeting_id
      AND m.owner_user_id = (SELECT auth.uid())
    )
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "meeting_metrics_insert" ON meeting_metrics;
CREATE POLICY "meeting_metrics_insert" ON meeting_metrics FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "meeting_metrics_update" ON meeting_metrics;
CREATE POLICY "meeting_metrics_update" ON meeting_metrics FOR UPDATE
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "meeting_metrics_delete" ON meeting_metrics;
CREATE POLICY "meeting_metrics_delete" ON meeting_metrics FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: organizations
-- ============================================================================

DROP POLICY IF EXISTS "organizations_select" ON organizations;
DROP POLICY IF EXISTS "organizations_insert" ON organizations;
DROP POLICY IF EXISTS "organizations_update" ON organizations;
DROP POLICY IF EXISTS "organizations_delete" ON organizations;
DROP POLICY IF EXISTS "orgs_select_for_members" ON organizations;
DROP POLICY IF EXISTS "orgs_insert_authenticated" ON organizations;
DROP POLICY IF EXISTS "orgs_update_by_admins" ON organizations;
DROP POLICY IF EXISTS "orgs_delete_by_owner" ON organizations;

DROP POLICY IF EXISTS "organizations_select" ON organizations;
CREATE POLICY "organizations_select" ON organizations FOR SELECT
  USING (
    is_service_role()

    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "organizations_insert" ON organizations;
CREATE POLICY "organizations_insert" ON organizations FOR INSERT
  WITH CHECK (is_service_role() OR (SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "organizations_update" ON organizations;
CREATE POLICY "organizations_update" ON organizations FOR UPDATE
  USING (
    is_service_role()

    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "organizations_delete" ON organizations;
CREATE POLICY "organizations_delete" ON organizations FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: organization_invitations
-- ============================================================================

DROP POLICY IF EXISTS "organization_invitations_select" ON organization_invitations;
DROP POLICY IF EXISTS "organization_invitations_insert" ON organization_invitations;
DROP POLICY IF EXISTS "organization_invitations_update" ON organization_invitations;
DROP POLICY IF EXISTS "organization_invitations_delete" ON organization_invitations;
DROP POLICY IF EXISTS "invitation_select" ON organization_invitations;
DROP POLICY IF EXISTS "invitation_insert" ON organization_invitations;
DROP POLICY IF EXISTS "invitation_update" ON organization_invitations;
DROP POLICY IF EXISTS "invitation_delete" ON organization_invitations;

DROP POLICY IF EXISTS "organization_invitations_select" ON organization_invitations;
CREATE POLICY "organization_invitations_select" ON organization_invitations FOR SELECT
  USING (
    is_service_role()

    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "organization_invitations_insert" ON organization_invitations;
CREATE POLICY "organization_invitations_insert" ON organization_invitations FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "organization_invitations_update" ON organization_invitations;
CREATE POLICY "organization_invitations_update" ON organization_invitations FOR UPDATE
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "organization_invitations_delete" ON organization_invitations;
CREATE POLICY "organization_invitations_delete" ON organization_invitations FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: google_integrations
-- ============================================================================

DROP POLICY IF EXISTS "google_integrations_select" ON google_integrations;
DROP POLICY IF EXISTS "google_integrations_insert" ON google_integrations;
DROP POLICY IF EXISTS "google_integrations_update" ON google_integrations;
DROP POLICY IF EXISTS "google_integrations_delete" ON google_integrations;

DROP POLICY IF EXISTS "google_integrations_select" ON google_integrations;
CREATE POLICY "google_integrations_select" ON google_integrations FOR SELECT
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "google_integrations_insert" ON google_integrations;
CREATE POLICY "google_integrations_insert" ON google_integrations FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "google_integrations_update" ON google_integrations;
CREATE POLICY "google_integrations_update" ON google_integrations FOR UPDATE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "google_integrations_delete" ON google_integrations;
CREATE POLICY "google_integrations_delete" ON google_integrations FOR DELETE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: calendar_events
-- ============================================================================

DROP POLICY IF EXISTS "calendar_events_select" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_insert" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_update" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_delete" ON calendar_events;

DROP POLICY IF EXISTS "calendar_events_select" ON calendar_events;
CREATE POLICY "calendar_events_select" ON calendar_events FOR SELECT
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "calendar_events_insert" ON calendar_events;
CREATE POLICY "calendar_events_insert" ON calendar_events FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "calendar_events_update" ON calendar_events;
CREATE POLICY "calendar_events_update" ON calendar_events FOR UPDATE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "calendar_events_delete" ON calendar_events;
CREATE POLICY "calendar_events_delete" ON calendar_events FOR DELETE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: emails
-- ============================================================================

DROP POLICY IF EXISTS "emails_select" ON emails;
DROP POLICY IF EXISTS "emails_insert" ON emails;
DROP POLICY IF EXISTS "emails_update" ON emails;
DROP POLICY IF EXISTS "emails_delete" ON emails;

DROP POLICY IF EXISTS "emails_select" ON emails;
CREATE POLICY "emails_select" ON emails FOR SELECT
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "emails_insert" ON emails;
CREATE POLICY "emails_insert" ON emails FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "emails_update" ON emails;
CREATE POLICY "emails_update" ON emails FOR UPDATE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "emails_delete" ON emails;
CREATE POLICY "emails_delete" ON emails FOR DELETE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: email_threads
-- ============================================================================

DROP POLICY IF EXISTS "email_threads_select" ON email_threads;
DROP POLICY IF EXISTS "email_threads_insert" ON email_threads;
DROP POLICY IF EXISTS "email_threads_update" ON email_threads;
DROP POLICY IF EXISTS "email_threads_delete" ON email_threads;

DROP POLICY IF EXISTS "email_threads_select" ON email_threads;
CREATE POLICY "email_threads_select" ON email_threads FOR SELECT
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "email_threads_insert" ON email_threads;
CREATE POLICY "email_threads_insert" ON email_threads FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "email_threads_update" ON email_threads;
CREATE POLICY "email_threads_update" ON email_threads FOR UPDATE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "email_threads_delete" ON email_threads;
CREATE POLICY "email_threads_delete" ON email_threads FOR DELETE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: workflow_executions
-- ============================================================================

DROP POLICY IF EXISTS "workflow_executions_select" ON workflow_executions;
DROP POLICY IF EXISTS "workflow_executions_insert" ON workflow_executions;
DROP POLICY IF EXISTS "workflow_executions_update" ON workflow_executions;
DROP POLICY IF EXISTS "workflow_executions_delete" ON workflow_executions;
DROP POLICY IF EXISTS "workflow_executions_own_data" ON workflow_executions;

DROP POLICY IF EXISTS "workflow_executions_select" ON workflow_executions;
CREATE POLICY "workflow_executions_select" ON workflow_executions FOR SELECT
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "workflow_executions_insert" ON workflow_executions;
CREATE POLICY "workflow_executions_insert" ON workflow_executions FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "workflow_executions_update" ON workflow_executions;
CREATE POLICY "workflow_executions_update" ON workflow_executions FOR UPDATE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "workflow_executions_delete" ON workflow_executions;
CREATE POLICY "workflow_executions_delete" ON workflow_executions FOR DELETE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: user_automation_rules
-- ============================================================================

DROP POLICY IF EXISTS "user_automation_rules_select" ON user_automation_rules;
DROP POLICY IF EXISTS "user_automation_rules_insert" ON user_automation_rules;
DROP POLICY IF EXISTS "user_automation_rules_update" ON user_automation_rules;
DROP POLICY IF EXISTS "user_automation_rules_delete" ON user_automation_rules;

DROP POLICY IF EXISTS "user_automation_rules_select" ON user_automation_rules;
CREATE POLICY "user_automation_rules_select" ON user_automation_rules FOR SELECT
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "user_automation_rules_insert" ON user_automation_rules;
CREATE POLICY "user_automation_rules_insert" ON user_automation_rules FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_automation_rules_update" ON user_automation_rules;
CREATE POLICY "user_automation_rules_update" ON user_automation_rules FOR UPDATE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "user_automation_rules_delete" ON user_automation_rules;
CREATE POLICY "user_automation_rules_delete" ON user_automation_rules FOR DELETE
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

-- ============================================================================
-- TABLE: audit_logs
-- ============================================================================

DROP POLICY IF EXISTS "audit_logs_select" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_update" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_delete" ON audit_logs;

DROP POLICY IF EXISTS "audit_logs_select" ON audit_logs;
CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "audit_logs_update" ON audit_logs;
CREATE POLICY "audit_logs_update" ON audit_logs FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "audit_logs_delete" ON audit_logs;
CREATE POLICY "audit_logs_delete" ON audit_logs FOR DELETE
  USING (is_service_role());

-- ============================================================================
-- TABLE: targets
-- ============================================================================

DROP POLICY IF EXISTS "targets_select" ON targets;
DROP POLICY IF EXISTS "targets_insert" ON targets;
DROP POLICY IF EXISTS "targets_update" ON targets;
DROP POLICY IF EXISTS "targets_delete" ON targets;

DROP POLICY IF EXISTS "targets_select" ON targets;
CREATE POLICY "targets_select" ON targets FOR SELECT
  USING (
    is_service_role()
    OR user_id = (SELECT auth.uid())
    OR is_admin_optimized()
  );

DROP POLICY IF EXISTS "targets_insert" ON targets;
CREATE POLICY "targets_insert" ON targets FOR INSERT
  WITH CHECK (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "targets_update" ON targets;
CREATE POLICY "targets_update" ON targets FOR UPDATE
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "targets_delete" ON targets;
CREATE POLICY "targets_delete" ON targets FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: stages
-- ============================================================================

DROP POLICY IF EXISTS "stages_select" ON stages;
DROP POLICY IF EXISTS "stages_insert" ON stages;
DROP POLICY IF EXISTS "stages_update" ON stages;
DROP POLICY IF EXISTS "stages_delete" ON stages;
DROP POLICY IF EXISTS "stages_admin_write" ON stages;
DROP POLICY IF EXISTS "stages_admin_update" ON stages;
DROP POLICY IF EXISTS "stages_admin_delete" ON stages;

DROP POLICY IF EXISTS "stages_select" ON stages;
CREATE POLICY "stages_select" ON stages FOR SELECT
  USING (true);  -- Public read for pipeline stages

DROP POLICY IF EXISTS "stages_insert" ON stages;
CREATE POLICY "stages_insert" ON stages FOR INSERT
  WITH CHECK (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "stages_update" ON stages;
CREATE POLICY "stages_update" ON stages FOR UPDATE
  USING (is_service_role() OR is_admin_optimized());

DROP POLICY IF EXISTS "stages_delete" ON stages;
CREATE POLICY "stages_delete" ON stages FOR DELETE
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- TABLE: clerk_sync_log (admin only)
-- ============================================================================

DROP POLICY IF EXISTS "clerk_sync_log_admin_only" ON clerk_sync_log;
DROP POLICY IF EXISTS "clerk_sync_log_select" ON clerk_sync_log;
DROP POLICY IF EXISTS "clerk_sync_log_insert" ON clerk_sync_log;
DROP POLICY IF EXISTS "clerk_sync_log_update" ON clerk_sync_log;
DROP POLICY IF EXISTS "clerk_sync_log_delete" ON clerk_sync_log;

DROP POLICY IF EXISTS "clerk_sync_log_all" ON clerk_sync_log;
CREATE POLICY "clerk_sync_log_all" ON clerk_sync_log FOR ALL
  USING (is_service_role() OR is_admin_optimized());

-- ============================================================================
-- ADDITIONAL TABLES - Simplified policies for remaining tables
-- ============================================================================

-- TABLE: user_settings
DROP POLICY IF EXISTS "user_settings_select" ON user_settings;
DROP POLICY IF EXISTS "user_settings_insert" ON user_settings;
DROP POLICY IF EXISTS "user_settings_update" ON user_settings;
DROP POLICY IF EXISTS "user_settings_delete" ON user_settings;

DROP POLICY IF EXISTS "user_settings_select" ON user_settings;
CREATE POLICY "user_settings_select" ON user_settings FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_settings_insert" ON user_settings;
CREATE POLICY "user_settings_insert" ON user_settings FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_settings_update" ON user_settings;
CREATE POLICY "user_settings_update" ON user_settings FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_settings_delete" ON user_settings;
CREATE POLICY "user_settings_delete" ON user_settings FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

-- TABLE: user_sync_status
DROP POLICY IF EXISTS "user_sync_status_select" ON user_sync_status;
DROP POLICY IF EXISTS "user_sync_status_insert" ON user_sync_status;
DROP POLICY IF EXISTS "user_sync_status_update" ON user_sync_status;
DROP POLICY IF EXISTS "user_sync_status_delete" ON user_sync_status;
DROP POLICY IF EXISTS "Users can view their own sync status" ON user_sync_status;

DROP POLICY IF EXISTS "user_sync_status_select" ON user_sync_status;
CREATE POLICY "user_sync_status_select" ON user_sync_status FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_sync_status_insert" ON user_sync_status;
CREATE POLICY "user_sync_status_insert" ON user_sync_status FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_sync_status_update" ON user_sync_status;
CREATE POLICY "user_sync_status_update" ON user_sync_status FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_sync_status_delete" ON user_sync_status;
CREATE POLICY "user_sync_status_delete" ON user_sync_status FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

-- TABLE: copilot_conversations
DROP POLICY IF EXISTS "copilot_conversations_select" ON copilot_conversations;
DROP POLICY IF EXISTS "copilot_conversations_insert" ON copilot_conversations;
DROP POLICY IF EXISTS "copilot_conversations_update" ON copilot_conversations;
DROP POLICY IF EXISTS "copilot_conversations_delete" ON copilot_conversations;

DROP POLICY IF EXISTS "copilot_conversations_select" ON copilot_conversations;
CREATE POLICY "copilot_conversations_select" ON copilot_conversations FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "copilot_conversations_insert" ON copilot_conversations;
CREATE POLICY "copilot_conversations_insert" ON copilot_conversations FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "copilot_conversations_update" ON copilot_conversations;
CREATE POLICY "copilot_conversations_update" ON copilot_conversations FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "copilot_conversations_delete" ON copilot_conversations;
CREATE POLICY "copilot_conversations_delete" ON copilot_conversations FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

-- TABLE: copilot_messages
DROP POLICY IF EXISTS "copilot_messages_select" ON copilot_messages;
DROP POLICY IF EXISTS "copilot_messages_insert" ON copilot_messages;
DROP POLICY IF EXISTS "copilot_messages_update" ON copilot_messages;
DROP POLICY IF EXISTS "copilot_messages_delete" ON copilot_messages;

DROP POLICY IF EXISTS "copilot_messages_select" ON copilot_messages;
CREATE POLICY "copilot_messages_select" ON copilot_messages FOR SELECT
  USING (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM copilot_conversations cc
      WHERE cc.id = copilot_messages.conversation_id
      AND cc.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "copilot_messages_insert" ON copilot_messages;
CREATE POLICY "copilot_messages_insert" ON copilot_messages FOR INSERT
  WITH CHECK (
    is_service_role()
    OR EXISTS (
      SELECT 1 FROM copilot_conversations cc
      WHERE cc.id = copilot_messages.conversation_id
      AND cc.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "copilot_messages_update" ON copilot_messages;
CREATE POLICY "copilot_messages_update" ON copilot_messages FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "copilot_messages_delete" ON copilot_messages;
CREATE POLICY "copilot_messages_delete" ON copilot_messages FOR DELETE
  USING (is_service_role());

-- TABLE: contact_notes
DROP POLICY IF EXISTS "contact_notes_select" ON contact_notes;
DROP POLICY IF EXISTS "contact_notes_insert" ON contact_notes;
DROP POLICY IF EXISTS "contact_notes_update" ON contact_notes;
DROP POLICY IF EXISTS "contact_notes_delete" ON contact_notes;

DROP POLICY IF EXISTS "contact_notes_select" ON contact_notes;
CREATE POLICY "contact_notes_select" ON contact_notes FOR SELECT
  USING (is_service_role() OR created_by = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "contact_notes_insert" ON contact_notes;
CREATE POLICY "contact_notes_insert" ON contact_notes FOR INSERT
  WITH CHECK (is_service_role() OR created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "contact_notes_update" ON contact_notes;
CREATE POLICY "contact_notes_update" ON contact_notes FOR UPDATE
  USING (is_service_role() OR created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "contact_notes_delete" ON contact_notes;
CREATE POLICY "contact_notes_delete" ON contact_notes FOR DELETE
  USING (is_service_role() OR created_by = (SELECT auth.uid()));

-- TABLE: proposals
DROP POLICY IF EXISTS "proposals_select" ON proposals;
DROP POLICY IF EXISTS "proposals_insert" ON proposals;
DROP POLICY IF EXISTS "proposals_update" ON proposals;
DROP POLICY IF EXISTS "proposals_delete" ON proposals;

DROP POLICY IF EXISTS "proposals_select" ON proposals;
CREATE POLICY "proposals_select" ON proposals FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "proposals_insert" ON proposals;
CREATE POLICY "proposals_insert" ON proposals FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "proposals_update" ON proposals;
CREATE POLICY "proposals_update" ON proposals FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "proposals_delete" ON proposals;
CREATE POLICY "proposals_delete" ON proposals FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

-- TABLE: leads
DROP POLICY IF EXISTS "leads_select" ON leads;
DROP POLICY IF EXISTS "leads_insert" ON leads;
DROP POLICY IF EXISTS "leads_update" ON leads;
DROP POLICY IF EXISTS "leads_delete" ON leads;

DROP POLICY IF EXISTS "leads_select" ON leads;
CREATE POLICY "leads_select" ON leads FOR SELECT
  USING (is_service_role() OR owner_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "leads_insert" ON leads;
CREATE POLICY "leads_insert" ON leads FOR INSERT
  WITH CHECK (is_service_role() OR owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "leads_update" ON leads;
CREATE POLICY "leads_update" ON leads FOR UPDATE
  USING (is_service_role() OR owner_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "leads_delete" ON leads;
CREATE POLICY "leads_delete" ON leads FOR DELETE
  USING (is_service_role() OR owner_id = (SELECT auth.uid()) OR is_admin_optimized());

-- TABLE: notifications
DROP POLICY IF EXISTS "notifications_select" ON notifications;
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
DROP POLICY IF EXISTS "notifications_update" ON notifications;
DROP POLICY IF EXISTS "notifications_delete" ON notifications;

DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "notifications_delete" ON notifications;
CREATE POLICY "notifications_delete" ON notifications FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

-- TABLE: csv_mapping_templates
DROP POLICY IF EXISTS "csv_mapping_templates_select" ON csv_mapping_templates;
DROP POLICY IF EXISTS "csv_mapping_templates_insert" ON csv_mapping_templates;
DROP POLICY IF EXISTS "csv_mapping_templates_update" ON csv_mapping_templates;
DROP POLICY IF EXISTS "csv_mapping_templates_delete" ON csv_mapping_templates;
DROP POLICY IF EXISTS "Users can view their own templates" ON csv_mapping_templates;
DROP POLICY IF EXISTS "Users can update their own templates" ON csv_mapping_templates;
DROP POLICY IF EXISTS "Users can update own templates" ON csv_mapping_templates;
DROP POLICY IF EXISTS "Users can delete their own templates" ON csv_mapping_templates;
DROP POLICY IF EXISTS "Users can delete own templates" ON csv_mapping_templates;

DROP POLICY IF EXISTS "csv_mapping_templates_select" ON csv_mapping_templates;
CREATE POLICY "csv_mapping_templates_select" ON csv_mapping_templates FOR SELECT
  USING (is_service_role() OR user_id = (SELECT auth.uid()) OR is_admin_optimized());

DROP POLICY IF EXISTS "csv_mapping_templates_insert" ON csv_mapping_templates;
CREATE POLICY "csv_mapping_templates_insert" ON csv_mapping_templates FOR INSERT
  WITH CHECK (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "csv_mapping_templates_update" ON csv_mapping_templates;
CREATE POLICY "csv_mapping_templates_update" ON csv_mapping_templates FOR UPDATE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "csv_mapping_templates_delete" ON csv_mapping_templates;
CREATE POLICY "csv_mapping_templates_delete" ON csv_mapping_templates FOR DELETE
  USING (is_service_role() OR user_id = (SELECT auth.uid()));

-- ============================================================================
-- Grant execute permissions on helper functions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.is_admin_optimized() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_service_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_org_id() TO authenticated;

-- ============================================================================
-- Add comment for documentation
-- ============================================================================

COMMENT ON FUNCTION public.is_admin_optimized() IS 'Optimized admin check function - cached per statement for RLS performance';
COMMENT ON FUNCTION public.is_service_role() IS 'Check if current role is service_role - optimized for RLS';
COMMENT ON FUNCTION public.get_user_org_id() IS 'Get current user org_id - cached per statement for RLS performance';
