/**
 * Google Integration Tests Page
 *
 * Individual integration test page for Google Workspace.
 * Tests Gmail, Calendar, Tasks, Drive, and authentication.
 * Note: Google integration is user-level, not org-level.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Play,
  RefreshCw,
  Mail,
  AlertTriangle,
  History,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Zap,
  Key,
  Cloud,
  Calendar,
  CheckSquare,
  FolderOpen,
  Database,
  LayoutList,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/clientV2';
import {
  createGoogleTests,
  getGoogleConnectionStatus,
  googleTestSuiteInfo,
  type IntegrationTest,
  type TestResult,
  type TestStatus,
  type ConnectionStatus,
  type IntegrationTestRecord,
} from '@/lib/integrationTesting';
import { runSingleTest, getTestHistory, getLatestTestResults } from '@/lib/integrationTesting/testRunner';

// Category icons
const categoryIcons: Record<string, React.ElementType> = {
  authentication: Key,
  connectivity: Cloud,
  gmail: Mail,
  calendar: Calendar,
  tasks: CheckSquare,
  drive: FolderOpen,
  data: Database,
  infrastructure: Zap,
  summary: LayoutList,
};

// Status styling
const statusStyles: Record<TestStatus, { bg: string; text: string; icon: React.ElementType }> = {
  pending: { bg: 'bg-gray-500/10', text: 'text-gray-500', icon: Clock },
  running: { bg: 'bg-blue-500/10', text: 'text-blue-500', icon: Loader2 },
  passed: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', icon: CheckCircle },
  failed: { bg: 'bg-red-500/10', text: 'text-red-500', icon: XCircle },
  skipped: { bg: 'bg-gray-500/10', text: 'text-gray-400', icon: Clock },
  error: { bg: 'bg-orange-500/10', text: 'text-orange-500', icon: AlertTriangle },
};

interface TestCardProps {
  test: IntegrationTest;
  result?: TestResult;
  onRun: (test: IntegrationTest) => void;
  isRunning: boolean;
}

function TestCard({ test, result, onRun, isRunning }: TestCardProps) {
  const [expanded, setExpanded] = useState(false);
  const CategoryIcon = categoryIcons[test.category] || Zap;

  const status: TestStatus = result?.status || 'pending';
  const { bg, text, icon: StatusIcon } = statusStyles[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-white dark:bg-gray-900/80 backdrop-blur-sm',
        'border border-gray-200 dark:border-gray-700/50 rounded-xl',
        'shadow-sm dark:shadow-none overflow-hidden'
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'p-2 rounded-lg',
                'bg-gray-100 dark:bg-gray-800'
              )}
            >
              <CategoryIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                {test.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {test.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn('text-xs font-medium', bg, text, 'border-transparent')}
            >
              <StatusIcon className={cn('w-3 h-3 mr-1', status === 'running' && 'animate-spin')} />
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>

            <Button
              size="sm"
              variant="outline"
              onClick={() => onRun(test)}
              disabled={isRunning}
              className="h-8"
            >
              {isRunning ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3" />
              )}
            </Button>
          </div>
        </div>

        {result && (result.message || result.errorDetails || result.responseData) && (
          <div className="mt-3">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'Hide details' : 'Show details'}
              {result.duration && (
                <span className="ml-2 text-gray-400">({result.duration}ms)</span>
              )}
            </button>

            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-sm">
                    {result.message && (
                      <p className="text-gray-700 dark:text-gray-300">{result.message}</p>
                    )}
                    {result.errorDetails && (
                      <pre className="mt-2 text-xs text-red-600 dark:text-red-400 overflow-x-auto">
                        {JSON.stringify(result.errorDetails, null, 2)}
                      </pre>
                    )}
                    {result.responseData && (
                      <pre className="mt-2 text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">
                        {JSON.stringify(result.responseData, null, 2)}
                      </pre>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

interface HistoryItemProps {
  record: IntegrationTestRecord;
}

function HistoryItem({ record }: HistoryItemProps) {
  const status = record.status;
  const { text, icon: StatusIcon } = statusStyles[status] || statusStyles.pending;

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className="flex items-center gap-3">
        <StatusIcon className={cn('w-4 h-4', text)} />
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {record.test_name}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {record.message || 'No message'}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {new Date(record.created_at).toLocaleString()}
        </p>
        {record.duration_ms && (
          <p className="text-xs text-gray-400">{record.duration_ms}ms</p>
        )}
      </div>
    </div>
  );
}

export default function GoogleIntegrationTestsNew() {
  const [userId, setUserId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [tests, setTests] = useState<IntegrationTest[]>([]);
  const [results, setResults] = useState<Map<string, TestResult>>(new Map());
  const [history, setHistory] = useState<IntegrationTestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAll, setRunningAll] = useState(false);
  const [runningTests, setRunningTests] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState(0);
  const [showHistory, setShowHistory] = useState(false);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          console.error('[GoogleIntegrationTests] No user:', userError);
          setLoading(false);
          return;
        }

        setUserId(user.id);

        const [status, testHistory, latestResults] = await Promise.all([
          getGoogleConnectionStatus(user.id),
          getTestHistory('google', 20),
          getLatestTestResults('google'),
        ]);

        setConnectionStatus(status);
        setTests(createGoogleTests(user.id));
        setHistory(testHistory);

        // Set results from latest test records
        const resultsMap = new Map<string, TestResult>();
        latestResults.forEach((record) => {
          resultsMap.set(record.test_name, {
            testId: record.test_name,
            testName: record.test_name,
            status: record.status,
            message: record.message || undefined,
            duration: record.duration_ms || undefined,
            errorDetails: record.error_details || undefined,
            responseData: record.response_data || undefined,
          });
        });
        setResults(resultsMap);
      } catch (error) {
        console.error('[GoogleIntegrationTests] Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Run all tests
  const handleRunAll = async () => {
    if (!userId) return;

    setRunningAll(true);
    setProgress(0);
    setResults(new Map());

    try {
      const totalTests = tests.length;
      let completed = 0;

      for (const test of tests) {
        setRunningTests((prev) => new Set(prev).add(test.id));

        // Set running status
        setResults((prev) => {
          const newMap = new Map(prev);
          newMap.set(test.name, {
            testId: test.id,
            testName: test.name,
            status: 'running',
          });
          return newMap;
        });

        // Note: For Google integration, we pass undefined for orgId since it's user-level
        const result = await runSingleTest('google', test, 'manual', undefined);

        setResults((prev) => {
          const newMap = new Map(prev);
          newMap.set(test.name, result);
          return newMap;
        });

        setRunningTests((prev) => {
          const newSet = new Set(prev);
          newSet.delete(test.id);
          return newSet;
        });

        completed++;
        setProgress(Math.round((completed / totalTests) * 100));
      }

      // Refresh history
      const testHistory = await getTestHistory('google', 20);
      setHistory(testHistory);

      // Show summary
      const resultArray = Array.from(results.values());
      const passedCount = resultArray.filter((r) => r.status === 'passed').length;
      const failedCount = resultArray.filter(
        (r) => r.status === 'failed' || r.status === 'error'
      ).length;
      const skippedCount = resultArray.filter((r) => r.status === 'skipped').length;

      if (failedCount === 0) {
        toast.success(`All tests passed! (${skippedCount} skipped)`);
      } else {
        toast.error(`${failedCount} of ${totalTests} tests failed`);
      }
    } catch (error) {
      console.error('[GoogleIntegrationTests] Error running tests:', error);
      toast.error('Failed to run tests');
    } finally {
      setRunningAll(false);
      setRunningTests(new Set());
    }
  };

  // Run single test
  const handleRunTest = async (test: IntegrationTest) => {
    if (!userId) return;

    setRunningTests((prev) => new Set(prev).add(test.id));

    // Set running status
    setResults((prev) => {
      const newMap = new Map(prev);
      newMap.set(test.name, {
        testId: test.id,
        testName: test.name,
        status: 'running',
      });
      return newMap;
    });

    try {
      const result = await runSingleTest('google', test, 'manual', undefined);

      setResults((prev) => {
        const newMap = new Map(prev);
        newMap.set(test.name, result);
        return newMap;
      });

      if (result.status === 'passed') {
        toast.success(`${test.name}: Passed`);
      } else if (result.status === 'failed' || result.status === 'error') {
        toast.error(`${test.name}: ${result.message || 'Failed'}`);
      } else if (result.status === 'skipped') {
        toast.info(`${test.name}: Skipped`);
      }

      // Refresh history
      const testHistory = await getTestHistory('google', 20);
      setHistory(testHistory);
    } catch (error) {
      console.error('[GoogleIntegrationTests] Error running test:', error);
      toast.error(`Failed to run ${test.name}`);
    } finally {
      setRunningTests((prev) => {
        const newSet = new Set(prev);
        newSet.delete(test.id);
        return newSet;
      });
    }
  };

  // Calculate summary
  const summary = React.useMemo(() => {
    const resultArray = Array.from(results.values());
    return {
      total: tests.length,
      passed: resultArray.filter((r) => r.status === 'passed').length,
      failed: resultArray.filter((r) => r.status === 'failed').length,
      error: resultArray.filter((r) => r.status === 'error').length,
      skipped: resultArray.filter((r) => r.status === 'skipped').length,
      pending: tests.length - resultArray.length,
    };
  }, [tests, results]);

  // Group tests by category
  const testCategories = React.useMemo(() => {
    const categories = new Map<string, IntegrationTest[]>();
    tests.forEach((test) => {
      const existing = categories.get(test.category) || [];
      existing.push(test);
      categories.set(test.category, existing);
    });
    return categories;
  }, [tests]);

  // Copy results for AI debugging
  const handleCopyResultsForAI = async () => {
    const resultArray = Array.from(results.entries());
    const lines: string[] = [
      '# Google Integration Test Results',
      '',
      `**Date:** ${new Date().toLocaleString()}`,
      `**Connection Status:** ${connectionStatus?.isConnected ? 'Connected' : 'Not Connected'}`,
      connectionStatus?.accountInfo?.email ? `**Account:** ${connectionStatus.accountInfo.email}` : '',
      '',
      '## Summary',
      `- Total: ${summary.total}`,
      `- Passed: ${summary.passed}`,
      `- Failed: ${summary.failed + summary.error}`,
      `- Skipped: ${summary.skipped}`,
      `- Pending: ${summary.pending}`,
      '',
    ];

    // Group by status for easier debugging
    const failed = resultArray.filter(([_, r]) => r.status === 'failed' || r.status === 'error');
    const passed = resultArray.filter(([_, r]) => r.status === 'passed');
    const skipped = resultArray.filter(([_, r]) => r.status === 'skipped');
    const pending = resultArray.filter(([_, r]) => r.status === 'pending' || r.status === 'running');

    if (failed.length > 0) {
      lines.push('## Failed Tests');
      failed.forEach(([name, result]) => {
        lines.push(`### ${name}`);
        lines.push(`- **Status:** ${result.status}`);
        if (result.message) lines.push(`- **Message:** ${result.message}`);
        if (result.duration) lines.push(`- **Duration:** ${result.duration}ms`);
        if (result.errorDetails) {
          lines.push('- **Error Details:**');
          lines.push('```json');
          lines.push(JSON.stringify(result.errorDetails, null, 2));
          lines.push('```');
        }
        if (result.responseData) {
          lines.push('- **Response Data:**');
          lines.push('```json');
          lines.push(JSON.stringify(result.responseData, null, 2));
          lines.push('```');
        }
        lines.push('');
      });
    }

    if (passed.length > 0) {
      lines.push('## Passed Tests');
      passed.forEach(([name, result]) => {
        lines.push(`- ${name}${result.duration ? ` (${result.duration}ms)` : ''}`);
      });
      lines.push('');
    }

    if (skipped.length > 0) {
      lines.push('## Skipped Tests');
      skipped.forEach(([name, result]) => {
        lines.push(`- ${name}${result.message ? `: ${result.message}` : ''}`);
      });
      lines.push('');
    }

    if (pending.length > 0) {
      lines.push('## Pending Tests');
      pending.forEach(([name]) => {
        lines.push(`- ${name}`);
      });
      lines.push('');
    }

    const text = lines.filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Test results copied to clipboard');
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy results');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Link
              to="/platform/integrations"
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    Google Integration Tests
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Gmail, Calendar, Tasks, and Drive
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleCopyResultsForAI}
              disabled={results.size === 0}
              title="Copy results for AI debugging"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy for AI
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowHistory(!showHistory)}
            >
              <History className="w-4 h-4 mr-2" />
              History
            </Button>
            <Button
              onClick={handleRunAll}
              disabled={runningAll || !connectionStatus?.isConnected}
            >
              {runningAll ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Run All Tests
            </Button>
          </div>
        </div>

        {/* Connection Status */}
        <div
          className={cn(
            'bg-white dark:bg-gray-900/80 backdrop-blur-sm',
            'border border-gray-200 dark:border-gray-700/50 rounded-xl p-5',
            'shadow-sm dark:shadow-none'
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {connectionStatus?.isConnected ? (
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {connectionStatus?.isConnected ? 'Connected' : 'Not Connected'}
                </p>
                {connectionStatus?.isConnected && connectionStatus.accountInfo?.email && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {connectionStatus.accountInfo.email}
                  </p>
                )}
                {!connectionStatus?.isConnected && connectionStatus?.error && (
                  <p className="text-sm text-red-500">{connectionStatus.error}</p>
                )}
              </div>
            </div>
            {connectionStatus?.connectedAt && (
              <div className="text-right">
                <p className="text-xs text-gray-500 dark:text-gray-400">Connected</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {new Date(connectionStatus.connectedAt).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* User-Level Note */}
        <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg p-3">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Note:</strong> Google integration is user-level. Tests are run for your personal Google account.
          </p>
        </div>

        {/* Progress Bar (when running) */}
        {runningAll && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Running tests...</span>
              <span className="text-gray-700 dark:text-gray-300">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {summary.total}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {summary.passed}
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">Passed</p>
          </div>
          <div className="bg-red-50 dark:bg-red-500/10 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {summary.failed + summary.error}
            </p>
            <p className="text-xs text-red-600 dark:text-red-400">Failed</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-500/10 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {summary.skipped}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">Skipped</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">
              {summary.pending}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Pending</p>
          </div>
        </div>

        {/* Tests by Category */}
        {Array.from(testCategories.entries()).map(([category, categoryTests]) => {
          const CategoryIcon = categoryIcons[category] || Zap;

          return (
            <div key={category} className="space-y-3">
              <div className="flex items-center gap-2">
                <CategoryIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  {category.replace('_', ' ')}
                </h2>
                <Badge variant="outline" className="text-xs">
                  {categoryTests.length}
                </Badge>
              </div>
              <div className="space-y-3">
                {categoryTests.map((test) => (
                  <TestCard
                    key={test.id}
                    test={test}
                    result={results.get(test.name)}
                    onRun={handleRunTest}
                    isRunning={runningTests.has(test.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* History Panel */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div
                className={cn(
                  'bg-white dark:bg-gray-900/80 backdrop-blur-sm',
                  'border border-gray-200 dark:border-gray-700/50 rounded-xl p-5',
                  'shadow-sm dark:shadow-none'
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Test History
                  </h2>
                  <Badge variant="outline" className="text-xs">
                    Last 20 runs
                  </Badge>
                </div>
                {history.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                    No test history yet
                  </p>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    {history.map((record) => (
                      <HistoryItem key={record.id} record={record} />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings Link */}
        <div
          className={cn(
            'bg-blue-50 dark:bg-blue-500/10',
            'border border-blue-200 dark:border-blue-500/20 rounded-xl p-4',
            'flex items-center justify-between'
          )}
        >
          <div>
            <p className="font-medium text-blue-700 dark:text-blue-400">
              Configure Google Settings
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-300">
              Manage sync settings, calendar options, and email preferences.
            </p>
          </div>
          <Link
            to="/integrations"
            className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
          >
            <span className="text-sm font-medium">Open Settings</span>
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
