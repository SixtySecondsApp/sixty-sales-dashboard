/**
 * Integration Test Runner
 *
 * Executes integration tests and stores results in the database
 */

import { supabase } from '@/lib/supabase/clientV2';
import type {
  IntegrationTest,
  TestResult,
  TestRunResult,
  TriggerType,
  IntegrationHealthSummary,
  IntegrationTestRecord,
  IntegrationAlert,
} from './types';

const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Run a single test with timeout
 */
async function runTestWithTimeout(
  test: IntegrationTest,
  timeout: number = DEFAULT_TIMEOUT
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Test timed out after ${timeout}ms`)), timeout);
    });

    const result = await Promise.race([test.run(), timeoutPromise]);

    return {
      ...result,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      testId: test.id,
      testName: test.name,
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      duration: Date.now() - startTime,
      errorDetails: {
        name: error instanceof Error ? error.name : 'Error',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    };
  }
}

/**
 * Run all tests in a suite
 */
export async function runTestSuite(
  integrationName: string,
  tests: IntegrationTest[],
  triggeredBy: TriggerType = 'manual',
  orgId?: string
): Promise<TestRunResult> {
  const startedAt = new Date();
  const results: TestResult[] = [];

  for (const test of tests) {
    const result = await runTestWithTimeout(test, test.timeout || DEFAULT_TIMEOUT);
    results.push(result);

    // Store result in database
    await storeTestResult(integrationName, test, result, triggeredBy, orgId);
  }

  const completedAt = new Date();

  const summary = {
    total: results.length,
    passed: results.filter((r) => r.status === 'passed').length,
    failed: results.filter((r) => r.status === 'failed').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    error: results.filter((r) => r.status === 'error').length,
    passRate: 0,
  };

  summary.passRate =
    summary.total > 0 ? Math.round((summary.passed / summary.total) * 100) : 0;

  // Check for failures and create alerts
  const failures = results.filter((r) => r.status === 'failed' || r.status === 'error');
  if (failures.length > 0) {
    await createFailureAlert(integrationName, failures);
  }

  return {
    integrationName,
    startedAt,
    completedAt,
    triggeredBy,
    results,
    summary,
  };
}

/**
 * Run a single test
 */
export async function runSingleTest(
  integrationName: string,
  test: IntegrationTest,
  triggeredBy: TriggerType = 'manual',
  orgId?: string
): Promise<TestResult> {
  const result = await runTestWithTimeout(test, test.timeout || DEFAULT_TIMEOUT);
  await storeTestResult(integrationName, test, result, triggeredBy, orgId);
  return result;
}

/**
 * Store test result in database
 */
async function storeTestResult(
  integrationName: string,
  test: IntegrationTest,
  result: TestResult,
  triggeredBy: TriggerType,
  orgId?: string
): Promise<void> {
  try {
    const { data: userData } = await supabase.auth.getUser();

    await supabase.from('integration_test_results').insert({
      integration_name: integrationName,
      test_name: test.name,
      test_category: test.category,
      status: result.status === 'running' || result.status === 'pending' ? 'skipped' : result.status,
      duration_ms: result.duration,
      message: result.message,
      error_details: result.errorDetails,
      response_data: result.responseData,
      triggered_by: triggeredBy,
      triggered_by_user_id: userData?.user?.id,
      org_id: orgId,
    });
  } catch (error) {
    console.error('[IntegrationTestRunner] Failed to store test result:', error);
  }
}

/**
 * Create an alert for test failures
 */
async function createFailureAlert(
  integrationName: string,
  failures: TestResult[]
): Promise<void> {
  try {
    const failedTests = failures.map((f) => f.testName).join(', ');
    const severity = failures.length > 2 ? 'critical' : failures.length > 1 ? 'high' : 'medium';

    await supabase.from('integration_alerts').insert({
      integration_name: integrationName,
      alert_type: 'failure',
      severity,
      title: `${integrationName} integration test${failures.length > 1 ? 's' : ''} failed`,
      message: `The following test${failures.length > 1 ? 's' : ''} failed: ${failedTests}`,
    });
  } catch (error) {
    console.error('[IntegrationTestRunner] Failed to create alert:', error);
  }
}

/**
 * Get health summary for all integrations
 * Uses latest_integration_test_results to show only the most recent test run counts
 * (not cumulative totals from multiple runs)
 */
export async function getIntegrationHealthSummary(): Promise<IntegrationHealthSummary[]> {
  // Fetch the latest test results (one per test per integration)
  const { data, error } = await supabase
    .from('latest_integration_test_results')
    .select('*');

  if (error) {
    console.error('[IntegrationTestRunner] Failed to fetch latest results:', error);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Group by integration and calculate summary stats
  const integrationMap = new Map<string, {
    passed: number;
    failed: number;
    error: number;
    total: number;
    lastTestAt: string | null;
  }>();

  for (const record of data) {
    const existing = integrationMap.get(record.integration_name) || {
      passed: 0,
      failed: 0,
      error: 0,
      total: 0,
      lastTestAt: null,
    };

    existing.total++;
    if (record.status === 'passed') existing.passed++;
    else if (record.status === 'failed') existing.failed++;
    else if (record.status === 'error') existing.error++;

    // Track most recent test time
    if (!existing.lastTestAt || (record.created_at && record.created_at > existing.lastTestAt)) {
      existing.lastTestAt = record.created_at;
    }

    integrationMap.set(record.integration_name, existing);
  }

  // Convert to IntegrationHealthSummary format
  const summaries: IntegrationHealthSummary[] = [];
  for (const [integrationName, stats] of integrationMap) {
    const passRate = stats.total > 0
      ? Math.round((stats.passed / stats.total) * 1000) / 10
      : 0;

    let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (stats.failed > 0 || stats.error > 0) {
      healthStatus = 'critical';
    } else if (stats.passed < stats.total) {
      healthStatus = 'warning';
    }

    summaries.push({
      integration_name: integrationName,
      passed_count: stats.passed,
      failed_count: stats.failed,
      error_count: stats.error,
      total_tests: stats.total,
      pass_rate: passRate,
      last_test_at: stats.lastTestAt,
      health_status: healthStatus,
    });
  }

  return summaries;
}

/**
 * Get recent test results for an integration
 */
export async function getTestHistory(
  integrationName: string,
  limit: number = 50
): Promise<IntegrationTestRecord[]> {
  const { data, error } = await supabase
    .from('integration_test_results')
    .select('*')
    .eq('integration_name', integrationName)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[IntegrationTestRunner] Failed to fetch test history:', error);
    return [];
  }

  return data || [];
}

/**
 * Get latest test results for an integration
 */
export async function getLatestTestResults(
  integrationName: string
): Promise<IntegrationTestRecord[]> {
  const { data, error } = await supabase
    .from('latest_integration_test_results')
    .select('*')
    .eq('integration_name', integrationName);

  if (error) {
    console.error('[IntegrationTestRunner] Failed to fetch latest results:', error);
    return [];
  }

  return data || [];
}

/**
 * Get active alerts
 */
export async function getActiveAlerts(): Promise<IntegrationAlert[]> {
  const { data, error } = await supabase
    .from('integration_alerts')
    .select('*')
    .is('resolved_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[IntegrationTestRunner] Failed to fetch alerts:', error);
    return [];
  }

  return data || [];
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(alertId: string): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('integration_alerts')
    .update({
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: userData?.user?.id,
    })
    .eq('id', alertId);

  if (error) {
    console.error('[IntegrationTestRunner] Failed to acknowledge alert:', error);
    return false;
  }

  return true;
}

/**
 * Resolve an alert
 */
export async function resolveAlert(alertId: string): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('integration_alerts')
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: userData?.user?.id,
    })
    .eq('id', alertId);

  if (error) {
    console.error('[IntegrationTestRunner] Failed to resolve alert:', error);
    return false;
  }

  return true;
}
