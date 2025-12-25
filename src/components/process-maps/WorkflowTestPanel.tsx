/**
 * Workflow Test Panel
 *
 * Slide-out panel for configuring and running workflow tests.
 * Displays test progress, results, and logs.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Play,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ChevronRight,
  RotateCcw,
  FileText,
  AlertTriangle,
  Database,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  ProcessMapWorkflow,
  ProcessMapTestRun,
  ProcessMapStepResult,
  RunMode,
  StepStatus,
  WorkflowStepDefinition,
} from '@/lib/types/processMapTesting';

// ============================================================================
// Types
// ============================================================================

interface WorkflowTestPanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Callback when panel should close */
  onClose: () => void;
  /** Process map title for display */
  processMapTitle: string;
  /** Process map ID */
  processMapId: string;
  /** Mermaid code for the diagram */
  mermaidCode: string;
  /** Callback when step status changes (for highlighting) */
  onStepStatusChange?: (stepStatuses: Map<string, StepStatus>) => void;
  /** Callback when current step changes */
  onCurrentStepChange?: (stepId: string | null) => void;
}

// ============================================================================
// Step Status Icon Component
// ============================================================================

function StepStatusIcon({
  status,
  isCurrent,
}: {
  status?: StepStatus;
  isCurrent?: boolean;
}) {
  if (isCurrent && (!status || status === 'running')) {
    return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
  }

  switch (status) {
    case 'passed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'skipped':
      return <ChevronRight className="h-4 w-4 text-gray-400" />;
    case 'running':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

// ============================================================================
// Step Progress Component
// ============================================================================

interface TestStepProgressProps {
  steps: WorkflowStepDefinition[];
  results: ProcessMapStepResult[];
  currentStepId?: string;
  isRunning: boolean;
}

function TestStepProgress({
  steps,
  results,
  currentStepId,
  isRunning,
}: TestStepProgressProps) {
  return (
    <div className="space-y-1">
      {steps.map((step, index) => {
        const result = results.find((r) => r.stepId === step.id);
        const isCurrent = currentStepId === step.id;

        return (
          <div
            key={step.id}
            className={cn(
              'flex items-center gap-3 p-2 rounded-md border transition-all duration-300',
              isCurrent && 'border-blue-500 bg-blue-50 dark:bg-blue-950/20',
              result?.status === 'passed' &&
                'border-green-200 bg-green-50 dark:bg-green-950/20',
              result?.status === 'failed' &&
                'border-red-200 bg-red-50 dark:bg-red-950/20',
              !result && !isCurrent && 'border-gray-200 dark:border-gray-800'
            )}
          >
            <div className="flex-shrink-0">
              <StepStatusIcon status={result?.status} isCurrent={isCurrent} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{index + 1}.</span>
                <span className="text-sm font-medium truncate">{step.name}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  {step.type}
                </Badge>
                {step.integration && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    {step.integration}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex-shrink-0 text-right">
              {result?.durationMs !== null && result?.durationMs !== undefined && (
                <span className="text-xs text-muted-foreground">
                  {result.durationMs}ms
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Logs Viewer Component
// ============================================================================

interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, unknown>;
}

function LogsViewer({ logs }: { logs: LogEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length]);

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'text-red-500';
      case 'warn':
        return 'text-yellow-500';
      case 'info':
        return 'text-blue-500';
      default:
        return 'text-gray-500';
    }
  };

  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        No logs yet. Run a test to see logs.
      </div>
    );
  }

  return (
    <ScrollArea className="h-64" ref={scrollRef}>
      <div className="space-y-1 font-mono text-xs">
        {logs.map((log, index) => (
          <div key={index} className="flex gap-2 py-0.5">
            <span className="text-muted-foreground w-20 flex-shrink-0">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <span className={cn('w-12 flex-shrink-0 uppercase', getLevelColor(log.level))}>
              [{log.level}]
            </span>
            <span className="flex-1 break-words">{log.message}</span>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function WorkflowTestPanel({
  isOpen,
  onClose,
  processMapTitle,
  processMapId,
  mermaidCode,
  onStepStatusChange,
  onCurrentStepChange,
}: WorkflowTestPanelProps) {
  // State
  const [runMode, setRunMode] = useState<RunMode>('mock');
  const [isRunning, setIsRunning] = useState(false);
  const [testRun, setTestRun] = useState<ProcessMapTestRun | null>(null);
  const [stepResults, setStepResults] = useState<ProcessMapStepResult[]>([]);
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [continueOnFailure, setContinueOnFailure] = useState(false);
  const [activeTab, setActiveTab] = useState('progress');

  // Mock workflow data for demo (will be replaced with real parsing)
  const [workflow] = useState<ProcessMapWorkflow | null>(() => {
    // This will be replaced with actual workflow parsing
    return null;
  });

  // Mock steps for demo
  const mockSteps: WorkflowStepDefinition[] = [
    {
      id: 'step_1_oauth',
      name: 'OAuth Connection',
      type: 'trigger',
      integration: 'hubspot',
      description: 'User connects via HubSpot OAuth flow',
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      dependencies: [],
      testConfig: { mockable: true, timeout: 30000, retryCount: 2 },
    },
    {
      id: 'step_2_sync',
      name: 'Contact Sync',
      type: 'external_call',
      integration: 'hubspot',
      description: 'Sync contacts from HubSpot',
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      dependencies: ['step_1_oauth'],
      testConfig: { mockable: true, timeout: 30000, retryCount: 2 },
    },
    {
      id: 'step_3_deals',
      name: 'Deal Sync',
      type: 'external_call',
      integration: 'hubspot',
      description: 'Sync deals from HubSpot',
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      dependencies: ['step_1_oauth'],
      testConfig: { mockable: true, timeout: 30000, retryCount: 2 },
    },
    {
      id: 'step_4_storage',
      name: 'Store Data',
      type: 'storage',
      integration: undefined,
      description: 'Store synced data in database',
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      dependencies: ['step_2_sync', 'step_3_deals'],
      testConfig: { mockable: false, timeout: 30000, retryCount: 2 },
    },
  ];

  // Handle step status changes
  useEffect(() => {
    if (onCurrentStepChange) {
      onCurrentStepChange(currentStepId);
    }
  }, [currentStepId, onCurrentStepChange]);

  useEffect(() => {
    if (onStepStatusChange) {
      const statusMap = new Map<string, StepStatus>();
      for (const result of stepResults) {
        statusMap.set(result.stepId, result.status);
      }
      if (currentStepId && !statusMap.has(currentStepId)) {
        statusMap.set(currentStepId, 'running');
      }
      onStepStatusChange(statusMap);
    }
  }, [stepResults, currentStepId, onStepStatusChange]);

  // Simulate running a test (will be replaced with actual engine)
  const handleRunTest = useCallback(async () => {
    setIsRunning(true);
    setStepResults([]);
    setLogs([]);
    setTestRun(null);
    setActiveTab('progress');

    const addLog = (level: LogEntry['level'], message: string, data?: Record<string, unknown>) => {
      setLogs((prev) => [...prev, { timestamp: new Date().toISOString(), level, message, data }]);
    };

    addLog('info', `Starting test run in ${runMode} mode`);

    // Simulate step-by-step execution
    for (let i = 0; i < mockSteps.length; i++) {
      const step = mockSteps[i];
      setCurrentStepId(step.id);

      addLog('info', `Starting step: ${step.name}`);

      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1000));

      // Simulate result (mostly success, occasional failure)
      const success = Math.random() > 0.1;
      const result: ProcessMapStepResult = {
        id: `result_${Date.now()}_${i}`,
        testRunId: 'test_run_1',
        stepId: step.id,
        stepName: step.name,
        sequenceNumber: i + 1,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: Math.floor(100 + Math.random() * 500),
        status: success ? 'passed' : 'failed',
        inputData: {},
        outputData: success ? { success: true } : null,
        expectedOutput: null,
        validationResults: [],
        errorMessage: success ? null : 'Simulated error for testing',
        errorDetails: null,
        errorStack: null,
        wasMocked: runMode === 'mock',
        mockSource: runMode === 'mock' ? step.integration || null : null,
        logs: [],
      };

      setStepResults((prev) => [...prev, result]);
      addLog(success ? 'info' : 'error', `Step ${step.name}: ${success ? 'passed' : 'failed'}`);

      if (!success && !continueOnFailure) {
        addLog('error', 'Test run stopped due to failure');
        break;
      }
    }

    setCurrentStepId(null);
    setIsRunning(false);

    // Create test run summary
    const passed = stepResults.filter((r) => r.status === 'passed').length;
    const failed = stepResults.filter((r) => r.status === 'failed').length;

    addLog('info', `Test run completed: ${passed} passed, ${failed} failed`);

    if (failed === 0) {
      toast.success('All tests passed!');
    } else {
      toast.error(`${failed} step(s) failed`);
    }
  }, [runMode, continueOnFailure]);

  // Reset test state
  const handleReset = useCallback(() => {
    setTestRun(null);
    setStepResults([]);
    setLogs([]);
    setCurrentStepId(null);
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'fixed inset-y-0 right-0 z-50 w-[400px] bg-background shadow-lg border-l',
        'transform transition-transform duration-300 ease-in-out',
        isOpen ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="font-semibold">Test Workflow</h2>
          <p className="text-sm text-muted-foreground truncate max-w-[280px]">
            {processMapTitle}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Configuration */}
      <div className="p-4 space-y-4 border-b">
        <div className="space-y-2">
          <Label htmlFor="run-mode">Run Mode</Label>
          <Select
            value={runMode}
            onValueChange={(value) => setRunMode(value as RunMode)}
            disabled={isRunning}
          >
            <SelectTrigger id="run-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="schema_validation">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Schema Validation
                </div>
              </SelectItem>
              <SelectItem value="mock">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Mock Mode
                </div>
              </SelectItem>
              <SelectItem value="production_readonly">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Production (Read-Only)
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="continue-on-failure">Continue on failure</Label>
          <Switch
            id="continue-on-failure"
            checked={continueOnFailure}
            onCheckedChange={setContinueOnFailure}
            disabled={isRunning}
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleRunTest} disabled={isRunning} className="flex-1">
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run Test
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isRunning || stepResults.length === 0}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Results */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <div className="px-4 pt-2">
          <TabsList className="w-full">
            <TabsTrigger value="progress" className="flex-1">
              Progress
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex-1">
              Logs
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="progress" className="p-4 pt-2">
          {/* Summary */}
          {stepResults.length > 0 && (
            <Card className="mb-4">
              <CardContent className="py-3">
                <div className="flex items-center justify-around text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-500">
                      {stepResults.filter((r) => r.status === 'passed').length}
                    </div>
                    <div className="text-xs text-muted-foreground">Passed</div>
                  </div>
                  <Separator orientation="vertical" className="h-8" />
                  <div>
                    <div className="text-2xl font-bold text-red-500">
                      {stepResults.filter((r) => r.status === 'failed').length}
                    </div>
                    <div className="text-xs text-muted-foreground">Failed</div>
                  </div>
                  <Separator orientation="vertical" className="h-8" />
                  <div>
                    <div className="text-2xl font-bold text-gray-500">
                      {mockSteps.length - stepResults.length}
                    </div>
                    <div className="text-xs text-muted-foreground">Pending</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <ScrollArea className="h-[calc(100vh-400px)]">
            <TestStepProgress
              steps={mockSteps}
              results={stepResults}
              currentStepId={currentStepId || undefined}
              isRunning={isRunning}
            />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="logs" className="p-4 pt-2">
          <LogsViewer logs={logs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default WorkflowTestPanel;
export type { WorkflowTestPanelProps };
