-- Migration: Add RLS policies for tables with RLS enabled but no policies
-- Addresses rls_enabled_no_policy INFO-level security linter issues
-- Applied: 2025-12-10
--
-- These tables are part of the workflow execution system and are primarily
-- accessed via backend services (Edge Functions) using service role.
-- The policies allow:
-- 1. Service role (Edge Functions) - full access for backend operations
-- 2. Authenticated users - access to their own workflow data via execution/workflow ownership
-- 3. Admins - full read access

-- ============================================================================
-- Helper function to check workflow ownership through execution_id
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_owns_execution(p_execution_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workflow_executions
    WHERE id = p_execution_id
    AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_owns_workflow(p_workflow_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_automation_rules
    WHERE id = p_workflow_id
    AND user_id = auth.uid()
  );
$$;

-- ============================================================================
-- 1. execution_checkpoints - links via execution_id
-- ============================================================================

CREATE POLICY "Users can view own execution checkpoints"
  ON public.execution_checkpoints
  FOR SELECT
  TO authenticated
  USING (
    public.user_owns_execution(execution_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Service role has full access to execution_checkpoints"
  ON public.execution_checkpoints
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 2. execution_snapshots - links via execution_id
-- ============================================================================

CREATE POLICY "Users can view own execution snapshots"
  ON public.execution_snapshots
  FOR SELECT
  TO authenticated
  USING (
    public.user_owns_execution(execution_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Service role has full access to execution_snapshots"
  ON public.execution_snapshots
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 3. http_request_recordings - links via execution_id
-- ============================================================================

CREATE POLICY "Users can view own http request recordings"
  ON public.http_request_recordings
  FOR SELECT
  TO authenticated
  USING (
    public.user_owns_execution(execution_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Service role has full access to http_request_recordings"
  ON public.http_request_recordings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 4. node_executions - links via execution_id
-- ============================================================================

CREATE POLICY "Users can view own node executions"
  ON public.node_executions
  FOR SELECT
  TO authenticated
  USING (
    public.user_owns_execution(execution_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Service role has full access to node_executions"
  ON public.node_executions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 5. node_fixtures - links via workflow_id
-- ============================================================================

CREATE POLICY "Users can manage own node fixtures"
  ON public.node_fixtures
  FOR ALL
  TO authenticated
  USING (
    public.user_owns_workflow(workflow_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    public.user_owns_workflow(workflow_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Service role has full access to node_fixtures"
  ON public.node_fixtures
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 6. scenario_fixtures - links via workflow_id
-- ============================================================================

CREATE POLICY "Users can manage own scenario fixtures"
  ON public.scenario_fixtures
  FOR ALL
  TO authenticated
  USING (
    public.user_owns_workflow(workflow_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    public.user_owns_workflow(workflow_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Service role has full access to scenario_fixtures"
  ON public.scenario_fixtures
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 7. user_profiles - users can only see/edit their own profile
-- ============================================================================

CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Service role has full access to user_profiles"
  ON public.user_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 8. variable_storage - links via execution_id or workflow_id
-- ============================================================================

CREATE POLICY "Users can manage own variable storage"
  ON public.variable_storage
  FOR ALL
  TO authenticated
  USING (
    (execution_id IS NOT NULL AND public.user_owns_execution(execution_id))
    OR (workflow_id IS NOT NULL AND public.user_owns_workflow(workflow_id))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    (execution_id IS NOT NULL AND public.user_owns_execution(execution_id))
    OR (workflow_id IS NOT NULL AND public.user_owns_workflow(workflow_id))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Service role has full access to variable_storage"
  ON public.variable_storage
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 9. workflow_batch_windows - links via workflow_id
-- ============================================================================

CREATE POLICY "Users can view own batch windows"
  ON public.workflow_batch_windows
  FOR SELECT
  TO authenticated
  USING (
    public.user_owns_workflow(workflow_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Service role has full access to workflow_batch_windows"
  ON public.workflow_batch_windows
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 10. workflow_circuit_breakers - links via workflow_id
-- ============================================================================

CREATE POLICY "Users can view own circuit breakers"
  ON public.workflow_circuit_breakers
  FOR SELECT
  TO authenticated
  USING (
    public.user_owns_workflow(workflow_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Service role has full access to workflow_circuit_breakers"
  ON public.workflow_circuit_breakers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 11. workflow_contracts - links via workflow_id
-- ============================================================================

CREATE POLICY "Users can manage own workflow contracts"
  ON public.workflow_contracts
  FOR ALL
  TO authenticated
  USING (
    public.user_owns_workflow(workflow_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    public.user_owns_workflow(workflow_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Service role has full access to workflow_contracts"
  ON public.workflow_contracts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 12. workflow_dead_letter_queue - links via execution_id
-- ============================================================================

CREATE POLICY "Users can view own dead letter queue"
  ON public.workflow_dead_letter_queue
  FOR SELECT
  TO authenticated
  USING (
    public.user_owns_execution(execution_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Service role has full access to workflow_dead_letter_queue"
  ON public.workflow_dead_letter_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 13. workflow_environment_promotions - links via workflow_id
-- ============================================================================

CREATE POLICY "Users can view own environment promotions"
  ON public.workflow_environment_promotions
  FOR SELECT
  TO authenticated
  USING (
    public.user_owns_workflow(workflow_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Service role has full access to workflow_environment_promotions"
  ON public.workflow_environment_promotions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 14. workflow_environments - links via workflow_id
-- ============================================================================

CREATE POLICY "Users can manage own workflow environments"
  ON public.workflow_environments
  FOR ALL
  TO authenticated
  USING (
    public.user_owns_workflow(workflow_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    public.user_owns_workflow(workflow_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Service role has full access to workflow_environments"
  ON public.workflow_environments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 15. workflow_idempotency_keys - links via execution_id
-- ============================================================================

CREATE POLICY "Users can view own idempotency keys"
  ON public.workflow_idempotency_keys
  FOR SELECT
  TO authenticated
  USING (
    public.user_owns_execution(execution_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Service role has full access to workflow_idempotency_keys"
  ON public.workflow_idempotency_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 16. workflow_rate_limits - links via workflow_id
-- ============================================================================

CREATE POLICY "Users can view own rate limits"
  ON public.workflow_rate_limits
  FOR SELECT
  TO authenticated
  USING (
    public.user_owns_workflow(workflow_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Service role has full access to workflow_rate_limits"
  ON public.workflow_rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Summary
-- ============================================================================
-- Added RLS policies for 16 tables:
-- - execution_checkpoints (via execution_id)
-- - execution_snapshots (via execution_id)
-- - http_request_recordings (via execution_id)
-- - node_executions (via execution_id)
-- - node_fixtures (via workflow_id)
-- - scenario_fixtures (via workflow_id)
-- - user_profiles (via id = auth.uid())
-- - variable_storage (via execution_id or workflow_id)
-- - workflow_batch_windows (via workflow_id)
-- - workflow_circuit_breakers (via workflow_id)
-- - workflow_contracts (via workflow_id)
-- - workflow_dead_letter_queue (via execution_id)
-- - workflow_environment_promotions (via workflow_id)
-- - workflow_environments (via workflow_id)
-- - workflow_idempotency_keys (via execution_id)
-- - workflow_rate_limits (via workflow_id)
--
-- Policy pattern:
-- - Authenticated users can access data they own (via workflow or execution ownership)
-- - Admins have read access to all data
-- - Service role has full access for backend operations
