-- Process Map Workflow Testing System
-- Adds tables to support testing and validation of process map workflows

-- ============================================================================
-- 1. Parsed Workflow Definitions
-- ============================================================================
-- Stores the parsed executable workflow structure from process maps

CREATE TABLE IF NOT EXISTS public.process_map_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to source process map
    process_map_id UUID REFERENCES public.process_maps(id) ON DELETE CASCADE,
    org_id UUID NOT NULL,

    -- Parsed workflow structure
    steps JSONB NOT NULL DEFAULT '[]',
    -- Structure: [{ id, name, type, integration, inputSchema, outputSchema, dependencies, testConfig }]

    connections JSONB NOT NULL DEFAULT '[]',
    -- Structure: [{ fromStepId, toStepId, condition, label }]

    -- Execution configuration
    test_config JSONB DEFAULT '{}',
    -- Structure: { defaultRunMode, timeout, retryCount, continueOnFailure }

    mock_config JSONB DEFAULT '{}',
    -- Structure: { integrations: { hubspot: {...}, fathom: {...} } }

    -- Metadata
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    parsed_at TIMESTAMPTZ DEFAULT NOW(),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure unique version per process map
    UNIQUE(process_map_id, version)
);

-- ============================================================================
-- 2. Test Run Records
-- ============================================================================
-- Records each test execution with configuration and aggregate results

CREATE TABLE IF NOT EXISTS public.process_map_test_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    workflow_id UUID REFERENCES public.process_map_workflows(id) ON DELETE CASCADE,
    org_id UUID NOT NULL,

    -- Run configuration
    run_mode TEXT NOT NULL CHECK (run_mode IN ('schema_validation', 'mock', 'production_readonly')),
    test_data JSONB DEFAULT '{}',
    -- Initial test data provided by user

    run_config JSONB DEFAULT '{}',
    -- Structure: { timeout, continueOnFailure, selectedSteps }

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Results summary
    overall_result TEXT CHECK (overall_result IN ('pass', 'fail', 'partial', 'error')),

    -- Metrics
    duration_ms INTEGER,
    steps_total INTEGER DEFAULT 0,
    steps_passed INTEGER DEFAULT 0,
    steps_failed INTEGER DEFAULT 0,
    steps_skipped INTEGER DEFAULT 0,

    -- Error tracking
    error_message TEXT,
    error_details JSONB,

    -- User who initiated the run
    run_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. Individual Step Results
-- ============================================================================
-- Detailed results for each step in a test run

CREATE TABLE IF NOT EXISTS public.process_map_step_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    test_run_id UUID NOT NULL REFERENCES public.process_map_test_runs(id) ON DELETE CASCADE,
    step_id TEXT NOT NULL,
    step_name TEXT NOT NULL,

    -- Execution order
    sequence_number INTEGER NOT NULL,

    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,

    -- Status
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'passed', 'failed', 'skipped', 'warning')),

    -- Data flow
    input_data JSONB,
    output_data JSONB,
    expected_output JSONB,

    -- Validation results
    validation_results JSONB DEFAULT '[]',
    -- Structure: [{ rule, passed, message, severity }]

    -- Error details
    error_message TEXT,
    error_details JSONB,
    error_stack TEXT,

    -- Mock info
    was_mocked BOOLEAN DEFAULT false,
    mock_source TEXT,

    -- Logs captured during step execution
    logs JSONB DEFAULT '[]'
    -- Structure: [{ timestamp, level, message, data }]
);

-- ============================================================================
-- 4. Test Data Fixtures
-- ============================================================================
-- Reusable test data configurations

CREATE TABLE IF NOT EXISTS public.process_map_fixtures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Scope
    workflow_id UUID REFERENCES public.process_map_workflows(id) ON DELETE CASCADE,
    org_id UUID NOT NULL,

    -- Identification
    name TEXT NOT NULL,
    description TEXT,

    -- Fixture type
    fixture_type TEXT NOT NULL
        CHECK (fixture_type IN ('trigger_data', 'step_input', 'step_output', 'full_scenario', 'integration_response')),

    -- Data
    data JSONB NOT NULL,

    -- Targeting (null for workflow-level fixtures)
    target_step_id TEXT,
    target_integration TEXT,

    -- Usage
    is_default BOOLEAN DEFAULT false,
    tags TEXT[] DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. Mock Configurations
-- ============================================================================
-- Configurable mock behaviors for integrations

CREATE TABLE IF NOT EXISTS public.process_map_mocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Scope
    workflow_id UUID REFERENCES public.process_map_workflows(id) ON DELETE CASCADE,
    org_id UUID NOT NULL,

    -- What to mock
    integration TEXT NOT NULL,
    -- e.g., 'hubspot', 'fathom', 'google', 'slack'

    endpoint TEXT,
    -- Specific endpoint or null for all

    -- Mock behavior
    mock_type TEXT NOT NULL DEFAULT 'success'
        CHECK (mock_type IN ('success', 'error', 'timeout', 'rate_limit', 'auth_failure', 'custom')),

    response_data JSONB,
    -- Mock response to return

    error_response JSONB,
    -- Error response for error mock types

    delay_ms INTEGER DEFAULT 0,
    -- Simulated latency

    -- Conditions for when to use this mock
    match_conditions JSONB,
    -- Structure: { method, pathPattern, bodyContains }

    -- Priority (higher = checked first)
    priority INTEGER DEFAULT 0,

    is_active BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Workflows
CREATE INDEX IF NOT EXISTS idx_pm_workflows_process_map ON public.process_map_workflows(process_map_id);
CREATE INDEX IF NOT EXISTS idx_pm_workflows_org ON public.process_map_workflows(org_id);

-- Test runs
CREATE INDEX IF NOT EXISTS idx_pm_test_runs_workflow ON public.process_map_test_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_pm_test_runs_org ON public.process_map_test_runs(org_id);
CREATE INDEX IF NOT EXISTS idx_pm_test_runs_status ON public.process_map_test_runs(status);
CREATE INDEX IF NOT EXISTS idx_pm_test_runs_created ON public.process_map_test_runs(created_at DESC);

-- Step results
CREATE INDEX IF NOT EXISTS idx_pm_step_results_run ON public.process_map_step_results(test_run_id);
CREATE INDEX IF NOT EXISTS idx_pm_step_results_step ON public.process_map_step_results(step_id);

-- Fixtures
CREATE INDEX IF NOT EXISTS idx_pm_fixtures_workflow ON public.process_map_fixtures(workflow_id);
CREATE INDEX IF NOT EXISTS idx_pm_fixtures_org ON public.process_map_fixtures(org_id);
CREATE INDEX IF NOT EXISTS idx_pm_fixtures_type ON public.process_map_fixtures(fixture_type);

-- Mocks
CREATE INDEX IF NOT EXISTS idx_pm_mocks_workflow ON public.process_map_mocks(workflow_id);
CREATE INDEX IF NOT EXISTS idx_pm_mocks_org ON public.process_map_mocks(org_id);
CREATE INDEX IF NOT EXISTS idx_pm_mocks_integration ON public.process_map_mocks(integration);

-- ============================================================================
-- Row Level Security
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.process_map_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_map_test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_map_step_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_map_fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_map_mocks ENABLE ROW LEVEL SECURITY;

-- Helper function to check platform admin status (reuse existing if available)
CREATE OR REPLACE FUNCTION public.is_platform_admin_for_testing()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.internal_users iu ON iu.email = (SELECT email FROM auth.users WHERE id = auth.uid())
        WHERE p.id = auth.uid()
        AND p.is_admin = true
        AND iu.is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Workflows policies
DROP POLICY IF EXISTS "platform_admins_view_workflows" ON public.process_map_workflows;
CREATE POLICY "platform_admins_view_workflows" ON public.process_map_workflows
    FOR SELECT TO authenticated
    USING (is_platform_admin_for_testing() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "platform_admins_manage_workflows" ON public.process_map_workflows;
CREATE POLICY "platform_admins_manage_workflows" ON public.process_map_workflows
    FOR ALL TO authenticated
    USING (is_platform_admin_for_testing() OR auth.role() = 'service_role')
    WITH CHECK (is_platform_admin_for_testing() OR auth.role() = 'service_role');

-- Test runs policies
DROP POLICY IF EXISTS "platform_admins_view_test_runs" ON public.process_map_test_runs;
CREATE POLICY "platform_admins_view_test_runs" ON public.process_map_test_runs
    FOR SELECT TO authenticated
    USING (is_platform_admin_for_testing() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "platform_admins_manage_test_runs" ON public.process_map_test_runs;
CREATE POLICY "platform_admins_manage_test_runs" ON public.process_map_test_runs
    FOR ALL TO authenticated
    USING (is_platform_admin_for_testing() OR auth.role() = 'service_role')
    WITH CHECK (is_platform_admin_for_testing() OR auth.role() = 'service_role');

-- Step results policies
DROP POLICY IF EXISTS "platform_admins_view_step_results" ON public.process_map_step_results;
CREATE POLICY "platform_admins_view_step_results" ON public.process_map_step_results
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.process_map_test_runs tr
            WHERE tr.id = test_run_id
            AND (is_platform_admin_for_testing() OR auth.role() = 'service_role')
        )
    );

DROP POLICY IF EXISTS "platform_admins_manage_step_results" ON public.process_map_step_results;
CREATE POLICY "platform_admins_manage_step_results" ON public.process_map_step_results
    FOR ALL TO authenticated
    USING (is_platform_admin_for_testing() OR auth.role() = 'service_role')
    WITH CHECK (is_platform_admin_for_testing() OR auth.role() = 'service_role');

-- Fixtures policies
DROP POLICY IF EXISTS "platform_admins_view_fixtures" ON public.process_map_fixtures;
CREATE POLICY "platform_admins_view_fixtures" ON public.process_map_fixtures
    FOR SELECT TO authenticated
    USING (is_platform_admin_for_testing() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "platform_admins_manage_fixtures" ON public.process_map_fixtures;
CREATE POLICY "platform_admins_manage_fixtures" ON public.process_map_fixtures
    FOR ALL TO authenticated
    USING (is_platform_admin_for_testing() OR auth.role() = 'service_role')
    WITH CHECK (is_platform_admin_for_testing() OR auth.role() = 'service_role');

-- Mocks policies
DROP POLICY IF EXISTS "platform_admins_view_mocks" ON public.process_map_mocks;
CREATE POLICY "platform_admins_view_mocks" ON public.process_map_mocks
    FOR SELECT TO authenticated
    USING (is_platform_admin_for_testing() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "platform_admins_manage_mocks" ON public.process_map_mocks;
CREATE POLICY "platform_admins_manage_mocks" ON public.process_map_mocks
    FOR ALL TO authenticated
    USING (is_platform_admin_for_testing() OR auth.role() = 'service_role')
    WITH CHECK (is_platform_admin_for_testing() OR auth.role() = 'service_role');

-- ============================================================================
-- Updated_at Triggers
-- ============================================================================

-- Workflows
CREATE OR REPLACE FUNCTION public.update_pm_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_pm_workflows_updated_at ON public.process_map_workflows;
CREATE TRIGGER trigger_update_pm_workflows_updated_at
    BEFORE UPDATE ON public.process_map_workflows
    FOR EACH ROW
    EXECUTE FUNCTION public.update_pm_workflows_updated_at();

-- Fixtures
DROP TRIGGER IF EXISTS trigger_update_pm_fixtures_updated_at ON public.process_map_fixtures;
CREATE TRIGGER trigger_update_pm_fixtures_updated_at
    BEFORE UPDATE ON public.process_map_fixtures
    FOR EACH ROW
    EXECUTE FUNCTION public.update_pm_workflows_updated_at();

-- Mocks
DROP TRIGGER IF EXISTS trigger_update_pm_mocks_updated_at ON public.process_map_mocks;
CREATE TRIGGER trigger_update_pm_mocks_updated_at
    BEFORE UPDATE ON public.process_map_mocks
    FOR EACH ROW
    EXECUTE FUNCTION public.update_pm_workflows_updated_at();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.process_map_workflows IS 'Parsed executable workflow definitions from process maps';
COMMENT ON TABLE public.process_map_test_runs IS 'Records of test executions with configuration and aggregate results';
COMMENT ON TABLE public.process_map_step_results IS 'Detailed results for each step in a test run';
COMMENT ON TABLE public.process_map_fixtures IS 'Reusable test data configurations';
COMMENT ON TABLE public.process_map_mocks IS 'Configurable mock behaviors for integration testing';
