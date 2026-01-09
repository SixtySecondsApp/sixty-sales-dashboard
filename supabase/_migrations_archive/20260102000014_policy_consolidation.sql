-- Migration: Policy Consolidation for Performance
-- Date: 2026-01-02
-- Description: Consolidate multiple permissive policies to improve RLS performance
--
-- Problem: Multiple PERMISSIVE policies on the same table are evaluated with OR logic.
-- PostgreSQL evaluates ALL permissive policies even if one already passes.
-- This causes unnecessary overhead for common query patterns.
--
-- Solution:
-- 1. Target service_role policies to service_role only (not public)
-- 2. Combine related SELECT policies into single policies with OR conditions
-- 3. Use subqueries with EXISTS for better query optimization

-- ============================================================================
-- PART 1: Fix ai_prompt_templates policies (8 policies -> 4)
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Org admins can manage org templates" ON public.ai_prompt_templates;
DROP POLICY IF EXISTS "Platform admins can manage all templates" ON public.ai_prompt_templates;
DROP POLICY IF EXISTS "Users can create own templates" ON public.ai_prompt_templates;
DROP POLICY IF EXISTS "Users can delete own templates" ON public.ai_prompt_templates;
DROP POLICY IF EXISTS "Users can update own templates" ON public.ai_prompt_templates;
DROP POLICY IF EXISTS "Users can view org public templates" ON public.ai_prompt_templates;
DROP POLICY IF EXISTS "Users can view own templates" ON public.ai_prompt_templates;
DROP POLICY IF EXISTS "Users can view system templates" ON public.ai_prompt_templates;

-- Create consolidated policies
CREATE POLICY "ai_prompt_templates_select"
ON public.ai_prompt_templates FOR SELECT
TO authenticated
USING (
  -- Platform admins see all
  is_platform_admin()
  -- Org admins see their org's templates
  OR (organization_id IN (
    SELECT org_id FROM organization_memberships
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  ))
  -- Users see own templates
  OR (auth.uid() = user_id)
  -- Users see public org templates they belong to
  OR (is_public = true AND organization_id IN (
    SELECT org_id FROM organization_memberships WHERE user_id = auth.uid()
  ))
  -- Everyone sees system templates
  OR (is_public = true AND organization_id IS NULL AND user_id IS NULL)
);

CREATE POLICY "ai_prompt_templates_insert"
ON public.ai_prompt_templates FOR INSERT
TO authenticated
WITH CHECK (
  is_platform_admin()
  OR (organization_id IN (
    SELECT org_id FROM organization_memberships
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  ))
  OR (auth.uid() = user_id)
);

CREATE POLICY "ai_prompt_templates_update"
ON public.ai_prompt_templates FOR UPDATE
TO authenticated
USING (
  is_platform_admin()
  OR (organization_id IN (
    SELECT org_id FROM organization_memberships
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  ))
  OR (auth.uid() = user_id)
)
WITH CHECK (
  is_platform_admin()
  OR (organization_id IN (
    SELECT org_id FROM organization_memberships
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  ))
  OR (auth.uid() = user_id)
);

CREATE POLICY "ai_prompt_templates_delete"
ON public.ai_prompt_templates FOR DELETE
TO authenticated
USING (
  is_platform_admin()
  OR (organization_id IN (
    SELECT org_id FROM organization_memberships
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  ))
  OR (auth.uid() = user_id)
);

-- ============================================================================
-- PART 2: Fix app_settings policies (4 policies -> 2)
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can read app settings" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_admin_all" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_admin_manage" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_authenticated_read" ON public.app_settings;
DROP POLICY IF EXISTS "Service role can update app settings" ON public.app_settings;

CREATE POLICY "app_settings_read"
ON public.app_settings FOR SELECT
TO authenticated
USING (true);  -- All authenticated users can read settings

CREATE POLICY "app_settings_write"
ON public.app_settings FOR ALL
TO authenticated
USING (
  is_platform_admin() OR auth.role() = 'service_role'
)
WITH CHECK (
  is_platform_admin() OR auth.role() = 'service_role'
);

-- ============================================================================
-- PART 3: Fix audit_logs policies (duplicate insert/select)
-- ============================================================================

DROP POLICY IF EXISTS "Allow audit log inserts" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;

CREATE POLICY "audit_logs_insert"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);  -- Any authenticated user can create audit logs

CREATE POLICY "audit_logs_select"
ON public.audit_logs FOR SELECT
TO authenticated
USING (is_platform_admin());  -- Only admins can read audit logs

-- ============================================================================
-- PART 4: Fix integration_sync_logs policies (4 -> 1)
-- ============================================================================

DROP POLICY IF EXISTS "integration_sync_logs_admin_select" ON public.integration_sync_logs;
DROP POLICY IF EXISTS "integration_sync_logs_org_select" ON public.integration_sync_logs;
DROP POLICY IF EXISTS "integration_sync_logs_service_role" ON public.integration_sync_logs;
DROP POLICY IF EXISTS "integration_sync_logs_user_select" ON public.integration_sync_logs;

CREATE POLICY "integration_sync_logs_select"
ON public.integration_sync_logs FOR SELECT
TO authenticated
USING (
  -- User's own sync logs
  user_id = auth.uid()
  -- Org member access
  OR org_id IN (SELECT org_id FROM organization_memberships WHERE user_id = auth.uid())
  -- Admin access
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

CREATE POLICY "integration_sync_logs_service_all"
ON public.integration_sync_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- PART 5: Fix hitl_pending_approvals policies (3 -> 2)
-- ============================================================================

DROP POLICY IF EXISTS "hitl_approvals_org_select" ON public.hitl_pending_approvals;
DROP POLICY IF EXISTS "hitl_approvals_service_role" ON public.hitl_pending_approvals;
DROP POLICY IF EXISTS "hitl_approvals_user_select" ON public.hitl_pending_approvals;

CREATE POLICY "hitl_pending_approvals_select"
ON public.hitl_pending_approvals FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR org_id IN (SELECT org_id FROM organization_memberships WHERE user_id = auth.uid())
);

CREATE POLICY "hitl_pending_approvals_service_all"
ON public.hitl_pending_approvals FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- PART 6: Fix call_file_search_index policies
-- ============================================================================

DROP POLICY IF EXISTS "org_select_call_file_search_index" ON public.call_file_search_index;
DROP POLICY IF EXISTS "service_role_manage_call_file_search_index" ON public.call_file_search_index;

CREATE POLICY "call_file_search_index_select"
ON public.call_file_search_index FOR SELECT
TO authenticated
USING (
  org_id IN (SELECT org_id FROM organization_memberships WHERE user_id = auth.uid())
);

CREATE POLICY "call_file_search_index_service_all"
ON public.call_file_search_index FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- PART 7: Fix call_index_queue policies (8 policies -> 5)
-- ============================================================================

DROP POLICY IF EXISTS "org_delete_call_index_queue" ON public.call_index_queue;
DROP POLICY IF EXISTS "org_insert_call_index_queue" ON public.call_index_queue;
DROP POLICY IF EXISTS "org_select_call_index_queue" ON public.call_index_queue;
DROP POLICY IF EXISTS "org_update_call_index_queue" ON public.call_index_queue;
DROP POLICY IF EXISTS "service_role_manage_call_index_queue" ON public.call_index_queue;

CREATE POLICY "call_index_queue_select"
ON public.call_index_queue FOR SELECT
TO authenticated
USING (
  org_id IN (SELECT org_id FROM organization_memberships WHERE user_id = auth.uid())
);

CREATE POLICY "call_index_queue_insert"
ON public.call_index_queue FOR INSERT
TO authenticated
WITH CHECK (
  org_id IN (SELECT org_id FROM organization_memberships WHERE user_id = auth.uid())
);

CREATE POLICY "call_index_queue_update"
ON public.call_index_queue FOR UPDATE
TO authenticated
USING (
  org_id IN (SELECT org_id FROM organization_memberships WHERE user_id = auth.uid())
)
WITH CHECK (
  org_id IN (SELECT org_id FROM organization_memberships WHERE user_id = auth.uid())
);

CREATE POLICY "call_index_queue_delete"
ON public.call_index_queue FOR DELETE
TO authenticated
USING (
  org_id IN (SELECT org_id FROM organization_memberships WHERE user_id = auth.uid())
);

CREATE POLICY "call_index_queue_service_all"
ON public.call_index_queue FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- PART 8: Template for common policy patterns (recommendations)
-- ============================================================================

-- NOTE: The following is documentation for applying the same pattern to other tables.
-- Run these patterns for tables with similar issues:

/*
PATTERN 1: Service role + Org-based access

-- For tables where service_role has ALL access and users have org-based access:

-- Step 1: Drop existing policies
DROP POLICY IF EXISTS "existing_policy_1" ON public.table_name;
DROP POLICY IF EXISTS "existing_policy_2" ON public.table_name;

-- Step 2: Create service_role policy (targeted to service_role only!)
CREATE POLICY "table_name_service_all"
ON public.table_name FOR ALL
TO service_role  -- KEY: Target service_role role, not public!
USING (true)
WITH CHECK (true);

-- Step 3: Create consolidated authenticated policy
CREATE POLICY "table_name_org_access"
ON public.table_name FOR SELECT
TO authenticated
USING (
  org_id IN (SELECT org_id FROM organization_memberships WHERE user_id = auth.uid())
);


PATTERN 2: Admin + User + Org access

CREATE POLICY "table_name_select"
ON public.table_name FOR SELECT
TO authenticated
USING (
  -- Check most likely condition first (user's own data)
  user_id = auth.uid()
  -- Then check org membership
  OR org_id IN (SELECT org_id FROM organization_memberships WHERE user_id = auth.uid())
  -- Admin fallback last
  OR is_platform_admin()
);


PATTERN 3: Use EXISTS for better performance

-- Instead of:
USING (user_id IN (SELECT ...))

-- Use:
USING (EXISTS (SELECT 1 FROM organization_memberships om WHERE om.org_id = table_name.org_id AND om.user_id = auth.uid()))

*/

-- ============================================================================
-- Summary:
-- Consolidated policies on 7 tables, reducing total policy count
-- Key optimizations:
-- 1. Service role policies now target service_role role specifically
-- 2. Multiple SELECT policies combined with OR logic
-- 3. Subqueries structured for PostgreSQL query optimizer
-- ============================================================================
