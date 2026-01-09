-- Test Scenarios & Coverage System
-- Stores auto-generated test scenarios and coverage analysis for process maps

-- ============================================================================
-- 1. Test Scenarios Table
-- ============================================================================
-- Stores generated test scenarios for process maps

CREATE TABLE IF NOT EXISTS public.process_map_test_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    workflow_id UUID REFERENCES public.process_map_workflows(id) ON DELETE CASCADE,
    process_map_id UUID REFERENCES public.process_maps(id) ON DELETE CASCADE,
    org_id UUID NOT NULL,

    -- Scenario identification
    name TEXT NOT NULL,
    description TEXT,

    -- Scenario type classification
    scenario_type TEXT NOT NULL CHECK (scenario_type IN ('happy_path', 'branch_path', 'failure_mode')),

    -- Path information (JSONB for flexibility)
    path JSONB NOT NULL,
    -- Structure: { stepIds: string[], decisions: DecisionPoint[], totalSteps: number, pathHash: string }

    -- Mock overrides for this scenario
    mock_overrides JSONB DEFAULT '[]',
    -- Structure: [{ integration, stepId?, mockType, priority, errorResponse?, delayMs? }]

    -- Expected outcome
    expected_result TEXT NOT NULL CHECK (expected_result IN ('pass', 'fail')),
    expected_failure_step TEXT,
    expected_failure_type TEXT CHECK (expected_failure_type IS NULL OR expected_failure_type IN ('error', 'timeout', 'rate_limit', 'auth_failure')),

    -- Prioritization
    priority INTEGER DEFAULT 1,
    tags TEXT[] DEFAULT '{}',

    -- Last run result (denormalized for quick access)
    last_run_result JSONB,
    -- Structure: { result: 'pass'|'fail'|'partial'|'error', runAt: string, durationMs: number, testRunId: string }

    -- Version tracking
    version INTEGER DEFAULT 1,
    process_structure_hash TEXT,
    -- Hash of ProcessStructure used to detect when scenarios need regeneration

    -- Timestamps
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. Coverage Snapshots Table
-- ============================================================================
-- Stores coverage analysis snapshots for versioning and comparison

CREATE TABLE IF NOT EXISTS public.process_map_coverage_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    workflow_id UUID REFERENCES public.process_map_workflows(id) ON DELETE CASCADE,
    process_map_id UUID REFERENCES public.process_maps(id) ON DELETE CASCADE,
    org_id UUID NOT NULL,

    -- Coverage metrics
    total_paths INTEGER NOT NULL DEFAULT 0,
    covered_paths INTEGER NOT NULL DEFAULT 0,
    path_coverage_percent NUMERIC(5,2) NOT NULL DEFAULT 0,

    total_branches INTEGER NOT NULL DEFAULT 0,
    covered_branches INTEGER NOT NULL DEFAULT 0,
    branch_coverage_percent NUMERIC(5,2) NOT NULL DEFAULT 0,

    -- Failure mode coverage (JSONB for detailed breakdown)
    failure_mode_coverage JSONB DEFAULT '{}',
    -- Structure: { [integration]: { totalModes: n, coveredModes: n, modes: { [mode]: covered } } }

    -- Integration coverage summary
    integrations_with_full_coverage TEXT[] DEFAULT '{}',
    integrations_with_partial_coverage TEXT[] DEFAULT '{}',

    -- Uncovered paths (for identifying gaps)
    uncovered_paths JSONB DEFAULT '[]',
    -- Structure: [{ pathHash, stepIds, reason }]

    -- Overall score (0-100)
    overall_score NUMERIC(5,2) NOT NULL DEFAULT 0,

    -- Scenario counts at time of snapshot
    total_scenarios INTEGER NOT NULL DEFAULT 0,
    happy_path_scenarios INTEGER DEFAULT 0,
    branch_path_scenarios INTEGER DEFAULT 0,
    failure_mode_scenarios INTEGER DEFAULT 0,

    -- Version tracking
    version INTEGER DEFAULT 1,
    process_structure_hash TEXT,

    -- Timestamps
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. Scenario Run History
-- ============================================================================
-- Links scenarios to specific test runs for historical tracking

CREATE TABLE IF NOT EXISTS public.process_map_scenario_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    scenario_id UUID NOT NULL REFERENCES public.process_map_test_scenarios(id) ON DELETE CASCADE,
    test_run_id UUID NOT NULL REFERENCES public.process_map_test_runs(id) ON DELETE CASCADE,

    -- Result
    result TEXT NOT NULL CHECK (result IN ('pass', 'fail', 'partial', 'error')),
    matched_expectation BOOLEAN NOT NULL DEFAULT false,
    mismatch_details TEXT,

    -- Metrics
    duration_ms INTEGER,
    steps_executed INTEGER DEFAULT 0,
    steps_passed INTEGER DEFAULT 0,
    steps_failed INTEGER DEFAULT 0,

    -- Error details
    error_message TEXT,
    failure_step_id TEXT,
    failure_type TEXT,

    -- Timestamp
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Test scenarios
CREATE INDEX IF NOT EXISTS idx_pm_scenarios_workflow ON public.process_map_test_scenarios(workflow_id);
CREATE INDEX IF NOT EXISTS idx_pm_scenarios_process_map ON public.process_map_test_scenarios(process_map_id);
CREATE INDEX IF NOT EXISTS idx_pm_scenarios_org ON public.process_map_test_scenarios(org_id);
CREATE INDEX IF NOT EXISTS idx_pm_scenarios_type ON public.process_map_test_scenarios(scenario_type);
CREATE INDEX IF NOT EXISTS idx_pm_scenarios_hash ON public.process_map_test_scenarios(process_structure_hash);

-- Coverage snapshots
CREATE INDEX IF NOT EXISTS idx_pm_coverage_workflow ON public.process_map_coverage_snapshots(workflow_id);
CREATE INDEX IF NOT EXISTS idx_pm_coverage_process_map ON public.process_map_coverage_snapshots(process_map_id);
CREATE INDEX IF NOT EXISTS idx_pm_coverage_org ON public.process_map_coverage_snapshots(org_id);
CREATE INDEX IF NOT EXISTS idx_pm_coverage_calculated ON public.process_map_coverage_snapshots(calculated_at DESC);

-- Scenario runs
CREATE INDEX IF NOT EXISTS idx_pm_scenario_runs_scenario ON public.process_map_scenario_runs(scenario_id);
CREATE INDEX IF NOT EXISTS idx_pm_scenario_runs_test_run ON public.process_map_scenario_runs(test_run_id);
CREATE INDEX IF NOT EXISTS idx_pm_scenario_runs_executed ON public.process_map_scenario_runs(executed_at DESC);

-- ============================================================================
-- Row Level Security
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.process_map_test_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_map_coverage_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_map_scenario_runs ENABLE ROW LEVEL SECURITY;

-- Test scenarios policies
DROP POLICY IF EXISTS "platform_admins_view_scenarios" ON public.process_map_test_scenarios;
CREATE POLICY "platform_admins_view_scenarios" ON public.process_map_test_scenarios
    FOR SELECT TO authenticated
    USING (is_platform_admin_for_testing() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "platform_admins_manage_scenarios" ON public.process_map_test_scenarios;
CREATE POLICY "platform_admins_manage_scenarios" ON public.process_map_test_scenarios
    FOR ALL TO authenticated
    USING (is_platform_admin_for_testing() OR auth.role() = 'service_role')
    WITH CHECK (is_platform_admin_for_testing() OR auth.role() = 'service_role');

-- Coverage snapshots policies
DROP POLICY IF EXISTS "platform_admins_view_coverage" ON public.process_map_coverage_snapshots;
CREATE POLICY "platform_admins_view_coverage" ON public.process_map_coverage_snapshots
    FOR SELECT TO authenticated
    USING (is_platform_admin_for_testing() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "platform_admins_manage_coverage" ON public.process_map_coverage_snapshots;
CREATE POLICY "platform_admins_manage_coverage" ON public.process_map_coverage_snapshots
    FOR ALL TO authenticated
    USING (is_platform_admin_for_testing() OR auth.role() = 'service_role')
    WITH CHECK (is_platform_admin_for_testing() OR auth.role() = 'service_role');

-- Scenario runs policies
DROP POLICY IF EXISTS "platform_admins_view_scenario_runs" ON public.process_map_scenario_runs;
CREATE POLICY "platform_admins_view_scenario_runs" ON public.process_map_scenario_runs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.process_map_test_scenarios s
            WHERE s.id = scenario_id
            AND (is_platform_admin_for_testing() OR auth.role() = 'service_role')
        )
    );

DROP POLICY IF EXISTS "platform_admins_manage_scenario_runs" ON public.process_map_scenario_runs;
CREATE POLICY "platform_admins_manage_scenario_runs" ON public.process_map_scenario_runs
    FOR ALL TO authenticated
    USING (is_platform_admin_for_testing() OR auth.role() = 'service_role')
    WITH CHECK (is_platform_admin_for_testing() OR auth.role() = 'service_role');

-- ============================================================================
-- Updated_at Trigger
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_update_pm_scenarios_updated_at ON public.process_map_test_scenarios;
CREATE TRIGGER trigger_update_pm_scenarios_updated_at
    BEFORE UPDATE ON public.process_map_test_scenarios
    FOR EACH ROW
    EXECUTE FUNCTION public.update_pm_workflows_updated_at();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.process_map_test_scenarios IS 'Auto-generated test scenarios for process map workflows';
COMMENT ON TABLE public.process_map_coverage_snapshots IS 'Coverage analysis snapshots for versioning and comparison';
COMMENT ON TABLE public.process_map_scenario_runs IS 'History of scenario executions linked to test runs';

COMMENT ON COLUMN public.process_map_test_scenarios.scenario_type IS 'Type: happy_path (main flow), branch_path (alternative route), failure_mode (error simulation)';
COMMENT ON COLUMN public.process_map_test_scenarios.path IS 'JSONB containing stepIds array, decisions, totalSteps, and pathHash';
COMMENT ON COLUMN public.process_map_test_scenarios.mock_overrides IS 'Array of mock configurations to apply for this scenario';
COMMENT ON COLUMN public.process_map_test_scenarios.process_structure_hash IS 'Hash of ProcessStructure to detect when scenarios need regeneration';

COMMENT ON COLUMN public.process_map_coverage_snapshots.overall_score IS 'Weighted coverage score (0-100) combining path, branch, and failure mode coverage';
COMMENT ON COLUMN public.process_map_coverage_snapshots.uncovered_paths IS 'Array of paths that lack test coverage';
