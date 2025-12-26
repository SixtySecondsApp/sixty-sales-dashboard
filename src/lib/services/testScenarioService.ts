/**
 * Test Scenario Service
 *
 * CRUD operations for managing auto-generated test scenarios
 * and coverage snapshots for process maps.
 */

import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';
import type {
  GeneratedTestScenario,
  TestCoverage,
  ScenarioType,
  ScenarioPath,
  ScenarioMockOverride,
  ExpectedScenarioResult,
  MockType,
  TestRunResult,
} from '@/lib/types/processMapTesting';

// ============================================================================
// Database Types
// ============================================================================

interface DbTestScenario {
  id: string;
  workflow_id: string | null;
  process_map_id: string | null;
  org_id: string;
  name: string;
  description: string | null;
  scenario_type: ScenarioType;
  path: ScenarioPath;
  mock_overrides: ScenarioMockOverride[];
  expected_result: ExpectedScenarioResult;
  expected_failure_step: string | null;
  expected_failure_type: MockType | null;
  priority: number;
  tags: string[];
  last_run_result: {
    result: TestRunResult;
    runAt: string;
    durationMs: number;
    testRunId?: string;
  } | null;
  version: number;
  process_structure_hash: string | null;
  generated_at: string;
  created_at: string;
  updated_at: string;
}

interface DbCoverageSnapshot {
  id: string;
  workflow_id: string | null;
  process_map_id: string | null;
  org_id: string;
  total_paths: number;
  covered_paths: number;
  path_coverage_percent: number;
  total_branches: number;
  covered_branches: number;
  branch_coverage_percent: number;
  failure_mode_coverage: Record<string, unknown>;
  integrations_with_full_coverage: string[];
  integrations_with_partial_coverage: string[];
  uncovered_paths: Array<{ pathHash: string; stepIds: string[]; reason: string }>;
  overall_score: number;
  total_scenarios: number;
  happy_path_scenarios: number;
  branch_path_scenarios: number;
  failure_mode_scenarios: number;
  version: number;
  process_structure_hash: string | null;
  calculated_at: string;
  created_at: string;
}

interface DbScenarioRun {
  id: string;
  scenario_id: string;
  test_run_id: string;
  result: TestRunResult;
  matched_expectation: boolean;
  mismatch_details: string | null;
  duration_ms: number | null;
  steps_executed: number;
  steps_passed: number;
  steps_failed: number;
  error_message: string | null;
  failure_step_id: string | null;
  failure_type: string | null;
  executed_at: string;
}

// ============================================================================
// Input Types
// ============================================================================

export interface SaveScenariosInput {
  processMapId: string;
  workflowId?: string;
  orgId: string;
  scenarios: GeneratedTestScenario[];
  processStructureHash?: string;
}

export interface SaveCoverageInput {
  processMapId: string;
  workflowId?: string;
  orgId: string;
  coverage: TestCoverage;
  scenarioCounts: {
    total: number;
    happyPath: number;
    branchPath: number;
    failureMode: number;
  };
  processStructureHash?: string;
}

export interface SaveScenarioRunInput {
  scenarioId: string;
  testRunId: string;
  result: TestRunResult;
  matchedExpectation: boolean;
  mismatchDetails?: string;
  durationMs?: number;
  stepsExecuted: number;
  stepsPassed: number;
  stepsFailed: number;
  errorMessage?: string;
  failureStepId?: string;
  failureType?: string;
}

// ============================================================================
// Conversion Functions
// ============================================================================

function dbScenarioToGenerated(db: DbTestScenario): GeneratedTestScenario {
  return {
    id: db.id,
    workflowId: db.workflow_id || db.process_map_id || '',
    orgId: db.org_id,
    name: db.name,
    description: db.description || '',
    scenarioType: db.scenario_type,
    path: db.path,
    mockOverrides: db.mock_overrides || [],
    expectedResult: db.expected_result,
    expectedFailureStep: db.expected_failure_step || undefined,
    expectedFailureType: db.expected_failure_type || undefined,
    priority: db.priority,
    tags: db.tags || [],
    generatedAt: db.generated_at,
    lastRunResult: db.last_run_result || undefined,
  };
}

function generatedToDbScenario(
  scenario: GeneratedTestScenario,
  processMapId: string,
  workflowId?: string,
  processStructureHash?: string
): Omit<DbTestScenario, 'id' | 'created_at' | 'updated_at'> {
  return {
    workflow_id: workflowId || null,
    process_map_id: processMapId,
    org_id: scenario.orgId,
    name: scenario.name,
    description: scenario.description,
    scenario_type: scenario.scenarioType,
    path: scenario.path,
    mock_overrides: scenario.mockOverrides,
    expected_result: scenario.expectedResult,
    expected_failure_step: scenario.expectedFailureStep || null,
    expected_failure_type: scenario.expectedFailureType || null,
    priority: scenario.priority,
    tags: scenario.tags,
    last_run_result: scenario.lastRunResult || null,
    version: 1,
    process_structure_hash: processStructureHash || null,
    generated_at: scenario.generatedAt,
  };
}

// ============================================================================
// Scenario CRUD Operations
// ============================================================================

/**
 * Save generated scenarios to the database
 * Replaces all existing scenarios for the process map
 */
export async function saveScenarios(input: SaveScenariosInput): Promise<GeneratedTestScenario[]> {
  try {
    const { processMapId, workflowId, orgId, scenarios, processStructureHash } = input;

    // Delete existing scenarios for this process map
    const { error: deleteError } = await supabase
      .from('process_map_test_scenarios')
      .delete()
      .eq('process_map_id', processMapId);

    if (deleteError) {
      logger.error('Error deleting existing scenarios:', deleteError);
      throw deleteError;
    }

    if (scenarios.length === 0) {
      return [];
    }

    // Insert new scenarios
    const scenarioData = scenarios.map((s) =>
      generatedToDbScenario(s, processMapId, workflowId, processStructureHash)
    );

    const { data: inserted, error: insertError } = await supabase
      .from('process_map_test_scenarios')
      .insert(scenarioData)
      .select('*');

    if (insertError) {
      logger.error('Error inserting scenarios:', insertError);
      throw insertError;
    }

    const result = (inserted as DbTestScenario[]).map(dbScenarioToGenerated);
    logger.log(`✅ Saved ${result.length} scenarios for process map ${processMapId}`);
    return result;
  } catch (error) {
    logger.error('Failed to save scenarios:', error);
    throw error;
  }
}

/**
 * Fetch all scenarios for a process map
 */
export async function fetchScenarios(processMapId: string): Promise<GeneratedTestScenario[]> {
  try {
    const { data, error } = await supabase
      .from('process_map_test_scenarios')
      .select('*')
      .eq('process_map_id', processMapId)
      .order('priority', { ascending: false })
      .order('scenario_type', { ascending: true });

    if (error) {
      logger.error('Error fetching scenarios:', error);
      throw error;
    }

    return (data as DbTestScenario[] || []).map(dbScenarioToGenerated);
  } catch (error) {
    logger.error('Failed to fetch scenarios:', error);
    throw error;
  }
}

/**
 * Fetch scenarios by type
 */
export async function fetchScenariosByType(
  processMapId: string,
  type: ScenarioType
): Promise<GeneratedTestScenario[]> {
  try {
    const { data, error } = await supabase
      .from('process_map_test_scenarios')
      .select('*')
      .eq('process_map_id', processMapId)
      .eq('scenario_type', type)
      .order('priority', { ascending: false });

    if (error) {
      logger.error('Error fetching scenarios by type:', error);
      throw error;
    }

    return (data as DbTestScenario[] || []).map(dbScenarioToGenerated);
  } catch (error) {
    logger.error('Failed to fetch scenarios by type:', error);
    throw error;
  }
}

/**
 * Update a scenario's last run result
 */
export async function updateScenarioLastRun(
  scenarioId: string,
  lastRunResult: {
    result: TestRunResult;
    runAt: string;
    durationMs: number;
    testRunId?: string;
  }
): Promise<void> {
  try {
    const { error } = await supabase
      .from('process_map_test_scenarios')
      .update({ last_run_result: lastRunResult })
      .eq('id', scenarioId);

    if (error) {
      logger.error('Error updating scenario last run:', error);
      throw error;
    }

    logger.log(`✅ Updated last run for scenario ${scenarioId}`);
  } catch (error) {
    logger.error('Failed to update scenario last run:', error);
    throw error;
  }
}

/**
 * Delete all scenarios for a process map
 */
export async function deleteScenarios(processMapId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('process_map_test_scenarios')
      .delete()
      .eq('process_map_id', processMapId);

    if (error) {
      logger.error('Error deleting scenarios:', error);
      throw error;
    }

    logger.log(`✅ Deleted scenarios for process map ${processMapId}`);
  } catch (error) {
    logger.error('Failed to delete scenarios:', error);
    throw error;
  }
}

/**
 * Check if scenarios need regeneration based on ProcessStructure hash
 */
export async function checkScenariosNeedRegeneration(
  processMapId: string,
  currentHash: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('process_map_test_scenarios')
      .select('process_structure_hash')
      .eq('process_map_id', processMapId)
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error('Error checking scenario hash:', error);
      return true; // Regenerate on error
    }

    if (!data) {
      return true; // No scenarios exist, need to generate
    }

    return data.process_structure_hash !== currentHash;
  } catch (error) {
    logger.error('Failed to check scenario regeneration:', error);
    return true;
  }
}

// ============================================================================
// Coverage Snapshot Operations
// ============================================================================

/**
 * Save a coverage snapshot
 */
export async function saveCoverageSnapshot(input: SaveCoverageInput): Promise<string> {
  try {
    const { processMapId, workflowId, orgId, coverage, scenarioCounts, processStructureHash } = input;

    const snapshotData = {
      workflow_id: workflowId || null,
      process_map_id: processMapId,
      org_id: orgId,
      total_paths: coverage.totalPaths,
      covered_paths: coverage.coveredPaths,
      path_coverage_percent: coverage.pathCoveragePercent,
      total_branches: coverage.totalBranches,
      covered_branches: coverage.coveredBranches,
      branch_coverage_percent: coverage.branchCoveragePercent,
      failure_mode_coverage: coverage.failureModeCoverage,
      integrations_with_full_coverage: coverage.integrationsWithFullCoverage,
      integrations_with_partial_coverage: coverage.integrationsWithPartialCoverage,
      uncovered_paths: coverage.uncoveredPaths,
      overall_score: coverage.overallScore,
      total_scenarios: scenarioCounts.total,
      happy_path_scenarios: scenarioCounts.happyPath,
      branch_path_scenarios: scenarioCounts.branchPath,
      failure_mode_scenarios: scenarioCounts.failureMode,
      process_structure_hash: processStructureHash || null,
      calculated_at: coverage.calculatedAt,
    };

    const { data, error } = await supabase
      .from('process_map_coverage_snapshots')
      .insert(snapshotData)
      .select('id')
      .single();

    if (error) {
      logger.error('Error saving coverage snapshot:', error);
      throw error;
    }

    logger.log(`✅ Saved coverage snapshot ${data.id} for process map ${processMapId}`);
    return data.id;
  } catch (error) {
    logger.error('Failed to save coverage snapshot:', error);
    throw error;
  }
}

/**
 * Fetch the latest coverage snapshot for a process map
 */
export async function fetchLatestCoverage(processMapId: string): Promise<TestCoverage | null> {
  try {
    const { data, error } = await supabase
      .from('process_map_coverage_snapshots')
      .select('*')
      .eq('process_map_id', processMapId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error('Error fetching latest coverage:', error);
      throw error;
    }

    if (!data) {
      return null;
    }

    const db = data as DbCoverageSnapshot;
    return {
      totalPaths: db.total_paths,
      coveredPaths: db.covered_paths,
      pathCoveragePercent: db.path_coverage_percent,
      totalBranches: db.total_branches,
      coveredBranches: db.covered_branches,
      branchCoveragePercent: db.branch_coverage_percent,
      failureModeCoverage: db.failure_mode_coverage as TestCoverage['failureModeCoverage'],
      integrationsWithFullCoverage: db.integrations_with_full_coverage,
      integrationsWithPartialCoverage: db.integrations_with_partial_coverage,
      uncoveredPaths: db.uncovered_paths,
      overallScore: db.overall_score,
      calculatedAt: db.calculated_at,
    };
  } catch (error) {
    logger.error('Failed to fetch latest coverage:', error);
    throw error;
  }
}

/**
 * Fetch coverage history for a process map
 */
export async function fetchCoverageHistory(
  processMapId: string,
  limit: number = 10
): Promise<Array<TestCoverage & { snapshotId: string }>> {
  try {
    const { data, error } = await supabase
      .from('process_map_coverage_snapshots')
      .select('*')
      .eq('process_map_id', processMapId)
      .order('calculated_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Error fetching coverage history:', error);
      throw error;
    }

    return (data as DbCoverageSnapshot[] || []).map((db) => ({
      snapshotId: db.id,
      totalPaths: db.total_paths,
      coveredPaths: db.covered_paths,
      pathCoveragePercent: db.path_coverage_percent,
      totalBranches: db.total_branches,
      coveredBranches: db.covered_branches,
      branchCoveragePercent: db.branch_coverage_percent,
      failureModeCoverage: db.failure_mode_coverage as TestCoverage['failureModeCoverage'],
      integrationsWithFullCoverage: db.integrations_with_full_coverage,
      integrationsWithPartialCoverage: db.integrations_with_partial_coverage,
      uncoveredPaths: db.uncovered_paths,
      overallScore: db.overall_score,
      calculatedAt: db.calculated_at,
    }));
  } catch (error) {
    logger.error('Failed to fetch coverage history:', error);
    throw error;
  }
}

// ============================================================================
// Scenario Run Operations
// ============================================================================

/**
 * Save a scenario run result
 */
export async function saveScenarioRun(input: SaveScenarioRunInput): Promise<string> {
  try {
    const runData = {
      scenario_id: input.scenarioId,
      test_run_id: input.testRunId,
      result: input.result,
      matched_expectation: input.matchedExpectation,
      mismatch_details: input.mismatchDetails || null,
      duration_ms: input.durationMs || null,
      steps_executed: input.stepsExecuted,
      steps_passed: input.stepsPassed,
      steps_failed: input.stepsFailed,
      error_message: input.errorMessage || null,
      failure_step_id: input.failureStepId || null,
      failure_type: input.failureType || null,
    };

    const { data, error } = await supabase
      .from('process_map_scenario_runs')
      .insert(runData)
      .select('id')
      .single();

    if (error) {
      logger.error('Error saving scenario run:', error);
      throw error;
    }

    // Also update the scenario's last run result
    await updateScenarioLastRun(input.scenarioId, {
      result: input.result,
      runAt: new Date().toISOString(),
      durationMs: input.durationMs || 0,
      testRunId: input.testRunId,
    });

    logger.log(`✅ Saved scenario run ${data.id}`);
    return data.id;
  } catch (error) {
    logger.error('Failed to save scenario run:', error);
    throw error;
  }
}

/**
 * Fetch run history for a specific scenario
 */
export async function fetchScenarioRunHistory(
  scenarioId: string,
  limit: number = 10
): Promise<DbScenarioRun[]> {
  try {
    const { data, error } = await supabase
      .from('process_map_scenario_runs')
      .select('*')
      .eq('scenario_id', scenarioId)
      .order('executed_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Error fetching scenario run history:', error);
      throw error;
    }

    return data as DbScenarioRun[] || [];
  } catch (error) {
    logger.error('Failed to fetch scenario run history:', error);
    throw error;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a hash for ProcessStructure to detect changes
 */
export function generateProcessStructureHash(structure: unknown): string {
  const json = JSON.stringify(structure);
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    const char = json.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get scenario statistics for a process map
 */
export async function getScenarioStats(processMapId: string): Promise<{
  total: number;
  byType: Record<ScenarioType, number>;
  passed: number;
  failed: number;
  notRun: number;
}> {
  try {
    const scenarios = await fetchScenarios(processMapId);

    const stats = {
      total: scenarios.length,
      byType: {
        happy_path: 0,
        branch_path: 0,
        failure_mode: 0,
      } as Record<ScenarioType, number>,
      passed: 0,
      failed: 0,
      notRun: 0,
    };

    for (const scenario of scenarios) {
      stats.byType[scenario.scenarioType]++;
      if (!scenario.lastRunResult) {
        stats.notRun++;
      } else if (scenario.lastRunResult.result === 'pass') {
        stats.passed++;
      } else {
        stats.failed++;
      }
    }

    return stats;
  } catch (error) {
    logger.error('Failed to get scenario stats:', error);
    throw error;
  }
}
