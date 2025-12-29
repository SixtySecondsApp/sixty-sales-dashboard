/**
 * Workflow Test Panel
 *
 * Slide-out panel for configuring and running workflow tests.
 * Displays test progress, results, and logs.
 *
 * Uses parseMermaidNodes to extract actual node IDs from the Mermaid diagram
 * so that highlighting works correctly with AI-generated diagrams.
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
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
  Sparkles,
  Route,
  GitBranch,
  AlertOctagon,
  BarChart3,
  PlayCircle,
  Square,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  ProcessMapStepResult,
  ProcessMapTestRun,
  ProcessStructure,
  RunMode,
  StepStatus,
  WorkflowStepDefinition,
  WorkflowStepType,
  LogEntry as TestLogEntry,
  GeneratedTestScenario,
  TestCoverage,
  ScenarioType,
  TrackedResource,
  TrackedAIPrompt,
  CleanupResult,
  TestDataTestRun,
} from '@/lib/types/processMapTesting';
import {
  parseMermaidNodes,
  getOrderedNodeIds,
  type MermaidNode,
} from '@/lib/testing/parsers/WorkflowParser';
import { ProcessMapTestEngine } from '@/lib/testing/ProcessMapTestEngine';
import { ScenarioTestEngine } from '@/lib/testing/ScenarioTestEngine';
import { TestDataTestEngine } from '@/lib/testing/TestDataTestEngine';
import { convertProcessStructureToWorkflow } from '@/lib/testing/converters/processStructureConverter';
import { createTestMockRegistry, getAllMocksFromRegistry } from '@/lib/testing/mocks';
import { generateScenarios, type ScenarioGeneratorResult } from '@/lib/testing/generators';
import { analyzeCoverage } from '@/lib/testing/analyzers';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ExternalLink, Trash2, Zap } from 'lucide-react';
import { ScenarioCard, ScenarioList } from './ScenarioCard';
import { TestHistoryPanel } from './TestHistoryPanel';
import {
  saveScenarios,
  saveCoverageSnapshot,
  fetchScenarios,
  fetchLatestCoverage,
  saveScenarioRun,
  generateProcessStructureHash,
  checkScenariosNeedRegeneration,
} from '@/lib/services/testScenarioService';
import {
  BatchScenarioRunner,
  type BatchProgress,
} from '@/lib/testing/runners/BatchScenarioRunner';
import { useActiveOrgId } from '@/lib/stores/orgStore';
import { useTestDataStore } from '@/lib/stores/testDataStore';
import { supabase } from '@/lib/supabase/clientV2';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map Mermaid node shape type to WorkflowStepType
 */
function mapMermaidTypeToStepType(
  mermaidType: MermaidNode['type'],
  label: string,
  index: number,
  totalNodes: number
): WorkflowStepType {
  const labelLower = label.toLowerCase();

  // Check for specific keywords in the label first
  if (/webhook|trigger|event|receive|subscription|start/.test(labelLower)) {
    return 'trigger';
  }
  if (/notify|alert|email|message|slack|notification/.test(labelLower)) {
    return 'notification';
  }
  if (/store|save|database|table|record|insert|update/.test(labelLower)) {
    return 'storage';
  }
  if (/api|fetch|call|request|sync|oauth|endpoint/.test(labelLower)) {
    return 'external_call';
  }
  if (/transform|extract|parse|convert|map|process|ai|claude|analyze/.test(labelLower)) {
    return 'transform';
  }
  if (/check|verify|validate|condition|if|match/.test(labelLower)) {
    return 'condition';
  }

  // Use Mermaid shape type as fallback
  switch (mermaidType) {
    case 'start':
      return 'trigger';
    case 'end':
      return index === totalNodes - 1 ? 'notification' : 'action';
    case 'decision':
      return 'condition';
    case 'data':
      return 'storage';
    default:
      // Use position for additional hints
      if (index === 0) return 'trigger';
      if (index === totalNodes - 1) return 'notification';
      return 'action';
  }
}

/**
 * Detect integration name from node label keywords
 */
function detectIntegrationFromLabel(label: string): string | undefined {
  const labelLower = label.toLowerCase();

  const integrationPatterns: Record<string, RegExp> = {
    hubspot: /hubspot|deal|contact|crm|pipeline/,
    fathom: /fathom|transcript|recording|meeting|video/,
    google: /google|gmail|calendar|drive|workspace/,
    slack: /slack|channel|notification|bot/,
    justcall: /justcall|call|phone/,
    savvycal: /savvycal|booking|schedule/,
    supabase: /supabase|postgres|database|table/,
  };

  for (const [integration, pattern] of Object.entries(integrationPatterns)) {
    if (pattern.test(labelLower)) {
      return integration;
    }
  }

  return undefined;
}

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
  /**
   * ProcessStructure JSON - the source of truth for nodes/steps.
   * When provided, this takes precedence over Mermaid parsing.
   * Generated by Claude Opus in Phase 1 of process map generation.
   */
  processStructure?: ProcessStructure | null;
  /** Callback when step status changes (for highlighting) */
  onStepStatusChange?: (stepStatuses: Map<string, StepStatus>) => void;
  /** Callback when current step changes */
  onCurrentStepChange?: (stepId: string | null) => void;
  /** If true, render without fixed positioning (for embedding in other containers) */
  embedded?: boolean;
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

  // Auto-scroll to bottom when new logs arrive, but only if there are enough logs to scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      // Small delay to ensure content is rendered
      requestAnimationFrame(() => {
        // Only scroll if content overflows (i.e., there are enough logs to scroll)
        if (el.scrollHeight > el.clientHeight) {
          el.scrollTop = el.scrollHeight;
        }
      });
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
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No logs yet. Run a test to see logs.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full" ref={scrollRef}>
      <div className="space-y-1 font-mono text-xs pb-4">
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
  processStructure,
  onStepStatusChange,
  onCurrentStepChange,
  embedded = false,
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

  // Scenario state
  const [scenarios, setScenarios] = useState<GeneratedTestScenario[]>([]);
  const [coverage, setCoverage] = useState<TestCoverage | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPhase, setGenerationPhase] = useState<'idle' | 'analyzing' | 'generating' | 'saving' | 'complete'>('idle');
  const [isLoadingScenarios, setIsLoadingScenarios] = useState(false);
  const [runningScenarioId, setRunningScenarioId] = useState<string | null>(null);
  const [scenarioFilter, setScenarioFilter] = useState<ScenarioType | 'all'>('all');
  const [justGenerated, setJustGenerated] = useState(false);

  // Batch execution state
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const batchRunnerRef = useRef<BatchScenarioRunner | null>(null);

  // Test Data Mode state
  const [showTestDataWarning, setShowTestDataWarning] = useState(false);
  const [testDataRun, setTestDataRun] = useState<TestDataTestRun | null>(null);
  const [trackedResources, setTrackedResources] = useState<TrackedResource[]>([]);
  const [trackedAIPrompts, setTrackedAIPrompts] = useState<TrackedAIPrompt[]>([]);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [cleanupProgress, setCleanupProgress] = useState<{
    total: number;
    completed: number;
    currentResource?: string;
  } | null>(null);

  // Reference to TestDataTestEngine for manual cleanup
  const testDataEngineRef = useRef<TestDataTestEngine | null>(null);

  // Get active organization ID for test_data mode
  const activeOrgId = useActiveOrgId();

  // Test data store for persisting state across navigation - use selectors for stable refs
  const storeGetTestRun = useTestDataStore((state) => state.getTestRun);
  const storeSetTestRun = useTestDataStore((state) => state.setTestRun);
  const storeSetCleanupResult = useTestDataStore((state) => state.setCleanupResult);
  const storeClearTestRun = useTestDataStore((state) => state.clearTestRun);

  // Load persisted test data on mount
  useEffect(() => {
    if (!processMapId || !isOpen) return;

    const persistedData = storeGetTestRun(processMapId);
    if (persistedData) {
      console.log('[WorkflowTestPanel] Restoring persisted test data for', processMapId);
      setTestDataRun(persistedData.testRun);
      setTestRun(persistedData.testRun);
      setTrackedResources(persistedData.trackedResources);
      setTrackedAIPrompts(persistedData.trackedAIPrompts);
      if (persistedData.cleanupResult) {
        setCleanupResult(persistedData.cleanupResult);
      }
      // Note: Engine reference is not persisted (can't serialize class instances)
      // The user will need to re-run tests if they want cleanup functionality
      // Switch to resources tab if there are resources
      if (persistedData.trackedResources.length > 0 && !persistedData.cleanupResult) {
        setActiveTab('resources');
      }
    }
  }, [processMapId, isOpen, storeGetTestRun]);

  // HubSpot portal ID and region for view URLs
  const [hubspotPortalId, setHubspotPortalId] = useState<string | null>(null);
  const [hubspotRegion, setHubspotRegion] = useState<string>('eu1'); // Default to EU

  // Fetch HubSpot portal ID and region when org changes
  useEffect(() => {
    if (!activeOrgId) {
      setHubspotPortalId(null);
      setHubspotRegion('eu1');
      return;
    }

    const fetchHubspotConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('hubspot_org_integrations')
          .select('hubspot_portal_id, hubspot_hub_id, hubspot_region')
          .eq('org_id', activeOrgId)
          .maybeSingle();

        if (error) {
          console.warn('[WorkflowTestPanel] Failed to fetch HubSpot config:', error);
          return;
        }

        if (data) {
          // Use portal_id or hub_id
          setHubspotPortalId(data.hubspot_portal_id || data.hubspot_hub_id || null);
          // Use stored region or default to EU (most common for this project)
          setHubspotRegion((data as { hubspot_region?: string }).hubspot_region || 'eu1');
        }
      } catch (err) {
        console.warn('[WorkflowTestPanel] Error fetching HubSpot config:', err);
      }
    };

    fetchHubspotConfig();
  }, [activeOrgId]);

  // Load saved scenarios and coverage from database
  useEffect(() => {
    if (!processMapId || !isOpen) return;

    const loadSavedData = async () => {
      setIsLoadingScenarios(true);
      try {
        // Load scenarios and coverage in parallel
        const [savedScenarios, savedCoverage] = await Promise.all([
          fetchScenarios(processMapId),
          fetchLatestCoverage(processMapId),
        ]);

        if (savedScenarios.length > 0) {
          setScenarios(savedScenarios);
          console.log(`[WorkflowTestPanel] Loaded ${savedScenarios.length} saved scenarios`);
        }

        if (savedCoverage) {
          setCoverage(savedCoverage);
          console.log('[WorkflowTestPanel] Loaded saved coverage:', savedCoverage.overallScore);
        }
      } catch (error) {
        console.error('[WorkflowTestPanel] Failed to load saved data:', error);
        // Don't show error toast - just continue without saved data
      } finally {
        setIsLoadingScenarios(false);
      }
    };

    loadSavedData();
  }, [processMapId, isOpen]);

  // Parse Mermaid nodes to get actual node IDs for highlighting (fallback if no processStructure)
  const mermaidNodes = useMemo(() => {
    if (processStructure?.nodes) return []; // Don't parse if we have structure
    const nodes = parseMermaidNodes(mermaidCode);
    console.log('[WorkflowTestPanel] Parsed mermaid nodes:', nodes.map(n => ({ id: n.id, label: n.label })));
    return nodes;
  }, [mermaidCode, processStructure]);

  const orderedNodeIds = useMemo(() => {
    if (processStructure?.nodes) {
      // Use execution order from ProcessStructure
      const ordered = [...processStructure.nodes]
        .sort((a, b) => a.executionOrder - b.executionOrder)
        .map(n => n.id);
      console.log('[WorkflowTestPanel] Node IDs from ProcessStructure:', ordered);
      return ordered;
    }
    const ids = getOrderedNodeIds(mermaidCode);
    console.log('[WorkflowTestPanel] Ordered node IDs from Mermaid:', ids);
    return ids;
  }, [mermaidCode, processStructure]);

  // Convert to WorkflowStepDefinition format
  // Prefer ProcessStructure (source of truth) when available, fallback to Mermaid parsing
  const workflowSteps: WorkflowStepDefinition[] = useMemo(() => {
    // If we have ProcessStructure, use it directly (this is the source of truth)
    if (processStructure?.nodes && processStructure.nodes.length > 0) {
      console.log('[WorkflowTestPanel] Using ProcessStructure nodes:', processStructure.nodes.length);

      // Sort by execution order
      const sortedNodes = [...processStructure.nodes].sort((a, b) => a.executionOrder - b.executionOrder);

      return sortedNodes.map((node, index) => ({
        id: node.id,
        name: node.label,
        type: node.stepType,
        integration: node.integration,
        description: node.description,
        inputSchema: { type: 'object' as const },
        outputSchema: { type: 'object' as const },
        dependencies: index > 0 ? [sortedNodes[index - 1].id] : [],
        testConfig: {
          mockable: node.testConfig?.mockable ?? true,
          timeout: 30000,
          retryCount: 2,
          requiresRealApi: node.testConfig?.requiresRealApi,
          operations: node.testConfig?.operations,
        },
      }));
    }

    // Fallback: Parse from Mermaid code
    if (mermaidNodes.length === 0) {
      // Fallback to demo steps if no nodes found
      return [
        {
          id: 'demo_1',
          name: 'Step 1',
          type: 'trigger' as WorkflowStepType,
          description: 'No workflow nodes detected in diagram',
          inputSchema: { type: 'object' },
          outputSchema: { type: 'object' },
          dependencies: [],
          testConfig: { mockable: true, timeout: 30000, retryCount: 2 },
        },
      ];
    }

    console.log('[WorkflowTestPanel] Falling back to Mermaid parsing');

    // Use orderedNodeIds to maintain execution order
    return orderedNodeIds.map((nodeId, index) => {
      const node = mermaidNodes.find((n) => n.id === nodeId);
      if (!node) {
        return {
          id: nodeId,
          name: nodeId,
          type: 'action' as WorkflowStepType,
          description: '',
          inputSchema: { type: 'object' as const },
          outputSchema: { type: 'object' as const },
          dependencies: index > 0 ? [orderedNodeIds[index - 1]] : [],
          testConfig: { mockable: true, timeout: 30000, retryCount: 2 },
        };
      }

      // Map Mermaid node type to WorkflowStepType
      const stepType = mapMermaidTypeToStepType(node.type, node.label, index, mermaidNodes.length);

      // Detect integration from label keywords
      const integration = detectIntegrationFromLabel(node.label);

      return {
        id: node.id, // Use actual Mermaid node ID
        name: node.label,
        type: stepType,
        integration,
        description: node.section ? `Part of ${node.section}` : undefined,
        inputSchema: { type: 'object' as const },
        outputSchema: { type: 'object' as const },
        dependencies: index > 0 ? [orderedNodeIds[index - 1]] : [],
        testConfig: { mockable: stepType !== 'storage', timeout: 30000, retryCount: 2 },
      };
    });
  }, [processStructure, mermaidNodes, orderedNodeIds]);

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

  // Run test using real ProcessMapTestEngine with mocks
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

    // Reset test data mode state if applicable
    if (runMode === 'test_data') {
      setTrackedResources([]);
      setTrackedAIPrompts([]);
      setCleanupResult(null);
      setTestDataRun(null);
    }

    // Track results locally since React state updates are async
    const localResults: ProcessMapStepResult[] = [];

    try {
      // Convert ProcessStructure to ProcessMapWorkflow
      // Detect integrations from workflow steps
      const integrations = Array.from(
        new Set(
          workflowSteps
            .map((s) => s.integration)
            .filter((i): i is string => !!i)
        )
      );

      addLog('info', `Detected integrations: ${integrations.length > 0 ? integrations.join(', ') : 'none'}`);

      // Create workflow for engine
      const workflow = processStructure
        ? convertProcessStructureToWorkflow(processStructure, {
            workflowId: processMapId,
            orgId: 'test-org', // Will be replaced with actual org ID when available
          })
        : {
            id: processMapId,
            name: processMapTitle,
            orgId: 'test-org',
            version: 1,
            steps: workflowSteps,
            metadata: {
              mermaidCode,
            },
          };

      addLog('debug', `Workflow created with ${workflow.steps.length} steps`);

      // Use TestDataTestEngine for test_data mode, otherwise use ProcessMapTestEngine
      if (runMode === 'test_data') {
        addLog('info', '🔴 LIVE MODE: Real API calls will be made');

        // Create and run the test data engine
        const testDataEngine = new TestDataTestEngine({
          workflow,
          integrationContext: {
            orgId: activeOrgId || undefined,
            hubspotPortalId: hubspotPortalId || undefined,
            hubspotRegion: hubspotRegion || 'eu1',
          },
          config: {
            continueOnFailure,
            timeout: 300000, // 5 minutes
          },
          testDataConfig: {
            autoCleanup: false, // Manual cleanup - user triggers after viewing resources
            cleanupDelayMs: 2000,
            continueCleanupOnFailure: true,
          },
          events: {
            onStepStart: (stepId: string, stepName: string) => {
              setCurrentStepId(stepId);
              addLog('info', `Starting step: ${stepName}`);
            },
            onStepComplete: (result: ProcessMapStepResult) => {
              const fullResult: ProcessMapStepResult = {
                ...result,
                id: result.id || `result_${Date.now()}_${result.sequenceNumber}`,
              };
              localResults.push(fullResult);
              setStepResults((prev) => [...prev, fullResult]);

              const statusMessage = result.status === 'passed'
                ? `Step ${result.stepName}: passed`
                : result.status === 'failed'
                  ? `Step ${result.stepName}: failed - ${result.errorMessage || 'Unknown error'}`
                  : `Step ${result.stepName}: ${result.status}`;

              addLog(
                result.status === 'passed' ? 'info' : result.status === 'failed' ? 'error' : 'warn',
                statusMessage
              );

              if (result.durationMs !== null && result.durationMs !== undefined) {
                addLog('debug', `  → Duration: ${result.durationMs}ms`);
              }
            },
            onResourceCreated: (resource: TrackedResource) => {
              addLog('info', `📦 Created ${resource.integration} ${resource.resourceType}: ${resource.displayName}`);
              setTrackedResources((prev) => [...prev, resource]);
            },
            onAIPromptUsed: (prompt: TrackedAIPrompt) => {
              addLog('debug', `🤖 AI Prompt: ${prompt.featureKey} at step ${prompt.stepName}`);
              setTrackedAIPrompts((prev) => [...prev, prompt]);
            },
            onCleanupStart: (totalResources: number) => {
              addLog('info', `🧹 Starting cleanup of ${totalResources} resources...`);
              setIsCleaningUp(true);
              setCleanupProgress({ total: totalResources, completed: 0 });
            },
            onCleanupProgress: (resource: TrackedResource, index: number, total: number, success: boolean) => {
              setCleanupProgress({
                total,
                completed: index + 1,
                currentResource: resource.displayName,
              });
              setTrackedResources((prev) =>
                prev.map((r) =>
                  r.id === resource.id
                    ? { ...r, cleanupStatus: success ? 'success' : 'failed' }
                    : r
                )
              );
              if (success) {
                addLog('debug', `  ✓ Cleaned ${resource.displayName}`);
              } else {
                addLog('warn', `  ✗ Failed to clean ${resource.displayName}`);
              }
            },
            onCleanupComplete: (result: CleanupResult) => {
              setIsCleaningUp(false);
              setCleanupProgress(null);
              setCleanupResult(result);
              addLog('info', `🧹 Cleanup complete: ${result.successCount} cleaned, ${result.failedCount} failed, ${result.skippedCount} skipped`);
            },
            onLog: (log: TestLogEntry) => {
              addLog(log.level, log.message, log.data);
            },
            onError: (error: Error) => {
              addLog('error', `Engine error: ${error.message}`);
            },
          },
        });

        // Store engine reference for manual cleanup
        testDataEngineRef.current = testDataEngine;

        // Execute the test
        const result = await testDataEngine.run();

        setTestDataRun(result.testRun);
        setTestRun(result.testRun);
        setTrackedResources(result.trackedResources);
        setTrackedAIPrompts(result.trackedAIPrompts);
        if (result.cleanupResult) {
          setCleanupResult(result.cleanupResult);
        }

        // Persist to store for navigation persistence
        storeSetTestRun(
          processMapId,
          result.testRun,
          result.trackedResources,
          result.trackedAIPrompts
        );

        addLog('info', `Test run completed: ${result.testRun.stepsPassed} passed, ${result.testRun.stepsFailed} failed`);

        // Switch to resources tab to show created resources
        if (result.trackedResources.length > 0) {
          setActiveTab('resources');
        }

        if (result.testRun.overallResult === 'pass') {
          toast.success(`All ${result.testRun.stepsPassed} tests passed! ${result.trackedResources.length} resources created - click "Run Cleanup" when ready.`);
        } else if (result.testRun.overallResult === 'partial') {
          toast.warning(`${result.testRun.stepsPassed} passed, ${result.testRun.stepsFailed} failed`);
        } else {
          toast.error(`Test failed: ${result.testRun.errorMessage || 'Unknown error'}`);
        }
      } else {
        // Standard mock/production_readonly mode
        const mockRegistry = createTestMockRegistry(
          processMapId,
          'test-org',
          integrations.length > 0 ? (integrations as Array<'hubspot' | 'fathom' | 'google' | 'slack' | 'justcall' | 'savvycal' | 'supabase'>) : undefined
        );
        const mocks = getAllMocksFromRegistry(mockRegistry);

        addLog('debug', `Loaded ${mocks.length} mock configurations`);

        // Create and run the test engine
        const engine = new ProcessMapTestEngine({
          workflow,
          runMode,
          config: {
            continueOnFailure,
            timeout: 300000, // 5 minutes
          },
          mocks,
          events: {
            onStepStart: (stepId: string, stepName: string) => {
              setCurrentStepId(stepId);
              addLog('info', `Starting step: ${stepName}`);
            },
            onStepComplete: (result: ProcessMapStepResult) => {
              // Add ID to result if not present
              const fullResult: ProcessMapStepResult = {
                ...result,
                id: result.id || `result_${Date.now()}_${result.sequenceNumber}`,
              };
              localResults.push(fullResult);
              setStepResults((prev) => [...prev, fullResult]);

              const statusMessage = result.status === 'passed'
                ? `Step ${result.stepName}: passed`
                : result.status === 'failed'
                  ? `Step ${result.stepName}: failed - ${result.errorMessage || 'Unknown error'}`
                  : `Step ${result.stepName}: ${result.status}`;

              addLog(
                result.status === 'passed' ? 'info' : result.status === 'failed' ? 'error' : 'warn',
                statusMessage
              );

              if (result.wasMocked) {
                addLog('debug', `  → Mocked via ${result.mockSource || 'default mock'}`);
              }
              if (result.durationMs !== null && result.durationMs !== undefined) {
                addLog('debug', `  → Duration: ${result.durationMs}ms`);
              }
            },
            onLog: (log: TestLogEntry) => {
              addLog(log.level, log.message, log.data);
            },
            onError: (error: Error) => {
              addLog('error', `Engine error: ${error.message}`);
            },
          },
        });

        // Execute the test
        const { testRun: runResult } = await engine.run();

        setTestRun(runResult as ProcessMapTestRun);
        addLog('info', `Test run completed: ${runResult.stepsPassed} passed, ${runResult.stepsFailed} failed`);

        if (runResult.overallResult === 'pass') {
          toast.success(`All ${runResult.stepsPassed} tests passed!`);
        } else if (runResult.overallResult === 'partial') {
          toast.warning(`${runResult.stepsPassed} passed, ${runResult.stepsFailed} failed`);
        } else {
          toast.error(`Test failed: ${runResult.errorMessage || 'Unknown error'}`);
        }
      }
    } catch (error) {
      const err = error as Error;
      addLog('error', `Test execution failed: ${err.message}`);
      toast.error(`Test execution failed: ${err.message}`);
    } finally {
      setCurrentStepId(null);
      setIsRunning(false);
      setIsCleaningUp(false);
    }
  }, [runMode, continueOnFailure, workflowSteps, processStructure, processMapId, processMapTitle, mermaidCode, activeOrgId, hubspotPortalId, hubspotRegion, storeSetTestRun]);

  // Reset test state
  const handleReset = useCallback(() => {
    setTestRun(null);
    setStepResults([]);
    setLogs([]);
    setCurrentStepId(null);
    // Reset test data mode state
    setTestDataRun(null);
    setTrackedResources([]);
    setTrackedAIPrompts([]);
    setCleanupResult(null);
    setCleanupProgress(null);
    testDataEngineRef.current = null;
    // Clear from store
    storeClearTestRun(processMapId);
  }, [processMapId, storeClearTestRun]);

  // Manual cleanup for test_data mode
  const handleManualCleanup = useCallback(async () => {
    if (!testDataEngineRef.current || !testDataRun) {
      toast.error('No test run available for cleanup');
      return;
    }

    const addLog = (level: LogEntry['level'], message: string) => {
      setLogs((prev) => [...prev, { timestamp: new Date().toISOString(), level, message }]);
    };

    addLog('info', '🧹 Starting manual cleanup...');
    setIsCleaningUp(true);
    setCleanupProgress({ total: trackedResources.length, completed: 0 });

    try {
      const result = await testDataEngineRef.current.performCleanup(testDataRun);
      setCleanupResult(result);

      // Update tracked resources with cleanup status
      setTrackedResources((prev) =>
        prev.map((r) => {
          const failed = result.failedResources.find((f) => f.resource.id === r.id);
          if (failed) {
            return { ...r, cleanupStatus: 'failed' as const, cleanupError: failed.error };
          }
          return { ...r, cleanupStatus: 'success' as const };
        })
      );

      addLog('info', `🧹 Cleanup complete: ${result.successCount} cleaned, ${result.failedCount} failed`);

      // Update store with cleanup result
      storeSetCleanupResult(processMapId, result);

      if (result.success) {
        toast.success(`Successfully cleaned up ${result.successCount} resources`);
        // Clear from store after successful cleanup
        storeClearTestRun(processMapId);
      } else {
        toast.warning(`Cleanup completed with ${result.failedCount} failures. Check manual cleanup instructions.`);
      }
    } catch (error) {
      const err = error as Error;
      addLog('error', `Cleanup failed: ${err.message}`);
      toast.error(`Cleanup failed: ${err.message}`);
    } finally {
      setIsCleaningUp(false);
      setCleanupProgress(null);
    }
  }, [trackedResources, testDataRun, processMapId, storeSetCleanupResult, storeClearTestRun]);

  // Generate test scenarios with phased feedback
  const handleGenerateScenarios = useCallback(async () => {
    if (!processStructure) {
      toast.error('No process structure available for scenario generation');
      return;
    }

    setIsGenerating(true);
    setJustGenerated(false);

    try {
      // Phase 1: Analyzing structure
      setGenerationPhase('analyzing');
      await new Promise(resolve => setTimeout(resolve, 300)); // Brief pause for UX

      // Phase 2: Generating scenarios
      setGenerationPhase('generating');
      const result = generateScenarios(
        processStructure,
        processMapId,
        'test-org', // TODO: Use actual org ID
        {
          includeFailureModes: true,
          maxPathScenarios: 50,
        }
      );

      // Calculate coverage
      const coverageResult = analyzeCoverage({
        processStructure,
        scenarios: result.scenarios,
      });

      // Generate hash for version tracking
      const structureHash = generateProcessStructureHash(processStructure);

      // Phase 3: Saving to database
      setGenerationPhase('saving');

      // Save scenarios and coverage to database
      try {
        const [savedScenarios] = await Promise.all([
          saveScenarios({
            processMapId,
            orgId: 'test-org', // TODO: Use actual org ID
            scenarios: result.scenarios,
            processStructureHash: structureHash,
          }),
          saveCoverageSnapshot({
            processMapId,
            orgId: 'test-org', // TODO: Use actual org ID
            coverage: coverageResult,
            totalScenarios: result.scenarios.length,
            scenarioCounts: {
              happyPath: result.pathScenarios.filter(s => s.scenarioType === 'happy_path').length,
              branchPath: result.pathScenarios.filter(s => s.scenarioType === 'branch_path').length,
              failureMode: result.failureScenarios.length,
            },
            processStructureHash: structureHash,
          }),
        ]);

        // Use saved scenarios (they have database IDs)
        setScenarios(savedScenarios);
        console.log(`[WorkflowTestPanel] Saved ${savedScenarios.length} scenarios to database`);
      } catch (saveError) {
        console.error('[WorkflowTestPanel] Failed to save scenarios to database:', saveError);
        // Fall back to using in-memory scenarios
        setScenarios(result.scenarios);
      }

      setCoverage(coverageResult);

      // Phase 4: Complete
      setGenerationPhase('complete');
      setJustGenerated(true);

      // Switch to scenarios tab after brief delay to show completion
      await new Promise(resolve => setTimeout(resolve, 500));
      setActiveTab('scenarios');

      toast.success(
        `Generated ${result.scenarios.length} scenarios: ` +
          `${result.pathScenarios.length} paths, ${result.failureScenarios.length} failure modes`
      );

      // Reset justGenerated after a few seconds
      setTimeout(() => setJustGenerated(false), 3000);
    } catch (error) {
      const err = error as Error;
      console.error('Scenario generation failed:', err);
      toast.error(`Failed to generate scenarios: ${err.message}`);
    } finally {
      setIsGenerating(false);
      setGenerationPhase('idle');
    }
  }, [processStructure, processMapId]);

  // Run a single scenario
  const handleRunScenario = useCallback(async (scenario: GeneratedTestScenario) => {
    if (!processStructure) {
      toast.error('No process structure available');
      return;
    }

    setRunningScenarioId(scenario.id);
    setActiveTab('progress');

    const addLog = (level: LogEntry['level'], message: string, data?: Record<string, unknown>) => {
      setLogs((prev) => [...prev, { timestamp: new Date().toISOString(), level, message, data }]);
    };

    addLog('info', `Running scenario: ${scenario.name}`);
    setStepResults([]);
    setLogs([]);

    try {
      // Convert ProcessStructure to ProcessMapWorkflow
      const workflow = convertProcessStructureToWorkflow(processStructure, {
        workflowId: processMapId,
        orgId: 'test-org',
      });

      // Get mocks
      const integrations = Array.from(
        new Set(
          workflowSteps
            .map((s) => s.integration)
            .filter((i): i is string => !!i)
        )
      ) as Array<'hubspot' | 'fathom' | 'google' | 'slack' | 'justcall' | 'savvycal' | 'supabase'>;

      const mockRegistry = createTestMockRegistry(processMapId, 'test-org', integrations.length > 0 ? integrations : undefined);
      const mocks = getAllMocksFromRegistry(mockRegistry);

      // Create scenario engine
      const engine = new ScenarioTestEngine({
        workflow,
        runMode,
        baseMocks: mocks,
        events: {
          onStepStart: (stepId: string, stepName: string) => {
            setCurrentStepId(stepId);
            addLog('info', `Starting step: ${stepName}`);
          },
          onStepComplete: (result: ProcessMapStepResult) => {
            const fullResult: ProcessMapStepResult = {
              ...result,
              id: result.id || `result_${Date.now()}_${result.sequenceNumber}`,
            };
            setStepResults((prev) => [...prev, fullResult]);

            const statusMessage = result.status === 'passed'
              ? `Step ${result.stepName}: passed`
              : result.status === 'failed'
                ? `Step ${result.stepName}: failed - ${result.errorMessage || 'Unknown error'}`
                : `Step ${result.stepName}: ${result.status}`;

            addLog(
              result.status === 'passed' ? 'info' : result.status === 'failed' ? 'error' : 'warn',
              statusMessage
            );
          },
          onLog: (log: TestLogEntry) => {
            addLog(log.level, log.message, log.data);
          },
          onError: (error: Error) => {
            addLog('error', `Engine error: ${error.message}`);
          },
        },
      });

      // Execute scenario
      const executionResult = await engine.executeScenario(scenario);

      setTestRun(executionResult.testRun);

      // Calculate step counts from results
      const stepsPassed = executionResult.stepResults?.filter(r => r.status === 'passed').length || 0;
      const stepsFailed = executionResult.stepResults?.filter(r => r.status === 'failed').length || 0;
      const stepsExecuted = executionResult.stepResults?.length || 0;

      // Find failure details if any step failed
      const failedStep = executionResult.stepResults?.find(r => r.status === 'failed');

      // Save scenario run to database
      try {
        // Only save if the scenario has a valid database ID (not a temp ID)
        if (scenario.id && !scenario.id.startsWith('scenario_')) {
          await saveScenarioRun({
            scenarioId: scenario.id,
            testRunId: executionResult.testRun.id,
            result: executionResult.testRun.overallResult || 'error',
            matchedExpectation: executionResult.matchedExpectation,
            mismatchDetails: executionResult.mismatchDetails,
            durationMs: executionResult.testRun.durationMs || 0,
            stepsExecuted,
            stepsPassed,
            stepsFailed,
            errorMessage: failedStep?.errorMessage,
            failureStepId: failedStep?.stepId,
            failureType: failedStep ? 'error' : undefined,
          });
          console.log(`[WorkflowTestPanel] Saved scenario run for ${scenario.name}`);
        }
      } catch (saveError) {
        console.error('[WorkflowTestPanel] Failed to save scenario run:', saveError);
        // Continue - don't block UI for save failures
      }

      // Update scenario with last run result in local state
      const lastRunResult = {
        result: executionResult.testRun.overallResult || 'error',
        runAt: executionResult.executedAt,
        durationMs: executionResult.testRun.durationMs || 0,
      };

      setScenarios((prev) =>
        prev.map((s) =>
          s.id === scenario.id
            ? { ...s, lastRunResult }
            : s
        )
      );

      if (executionResult.matchedExpectation) {
        toast.success(`Scenario "${scenario.name}" completed as expected`);
      } else {
        toast.warning(`Scenario "${scenario.name}" did not match expectation: ${executionResult.mismatchDetails}`);
      }

      addLog('info', `Scenario completed: ${executionResult.matchedExpectation ? 'matched expectation' : 'mismatch'}`);
    } catch (error) {
      const err = error as Error;
      addLog('error', `Scenario execution failed: ${err.message}`);
      toast.error(`Scenario execution failed: ${err.message}`);
    } finally {
      setRunningScenarioId(null);
      setCurrentStepId(null);
    }
  }, [processStructure, processMapId, runMode, workflowSteps]);

  // Run all scenarios in batch
  const handleRunAllScenarios = useCallback(async () => {
    if (!processStructure || scenarios.length === 0) {
      toast.error('No scenarios available to run');
      return;
    }

    setIsBatchRunning(true);
    setBatchProgress({
      total: scenarios.length,
      completed: 0,
      passed: 0,
      failed: 0,
      errors: 0,
      running: 0,
      pending: scenarios.length,
      progressPercent: 0,
      runningScenarioIds: [],
      estimatedRemainingMs: null,
    });

    try {
      // Convert ProcessStructure to ProcessMapWorkflow
      const workflow = convertProcessStructureToWorkflow(processStructure, {
        workflowId: processMapId,
        orgId: 'test-org',
      });

      // Get mocks
      const integrations = Array.from(
        new Set(
          workflowSteps
            .map((s) => s.integration)
            .filter((i): i is string => !!i)
        )
      ) as Array<'hubspot' | 'fathom' | 'google' | 'slack' | 'justcall' | 'savvycal' | 'supabase'>;

      const mockRegistry = createTestMockRegistry(processMapId, 'test-org', integrations.length > 0 ? integrations : undefined);
      const mocks = getAllMocksFromRegistry(mockRegistry);

      // Create batch runner
      const runner = new BatchScenarioRunner(
        {
          workflow,
          runMode,
          baseMocks: mocks,
          concurrency: 3,
          persistResults: true,
        },
        {
          onProgress: (progress) => {
            setBatchProgress(progress);
          },
          onScenarioComplete: (result, progress) => {
            // Update scenario in list with new last run result
            setScenarios((prev) =>
              prev.map((s) =>
                s.id === result.scenario.id
                  ? {
                      ...s,
                      lastRunResult: {
                        result: result.matchedExpectation ? 'pass' : 'fail',
                        runAt: result.executedAt,
                        durationMs: result.testRun.durationMs || 0,
                      },
                    }
                  : s
              )
            );
          },
          onComplete: (batchResult) => {
            if (batchResult.failed === 0 && batchResult.errors === 0) {
              toast.success(`All ${batchResult.passed} scenarios passed!`);
            } else {
              toast.warning(
                `Batch complete: ${batchResult.passed} passed, ${batchResult.failed} failed, ${batchResult.errors} errors`
              );
            }
          },
        }
      );

      batchRunnerRef.current = runner;

      // Filter scenarios based on current filter
      const scenariosToRun = scenarioFilter === 'all'
        ? scenarios
        : scenarios.filter((s) => s.scenarioType === scenarioFilter);

      await runner.runAll(scenariosToRun);
    } catch (error) {
      const err = error as Error;
      console.error('[WorkflowTestPanel] Batch execution failed:', err);
      toast.error(`Batch execution failed: ${err.message}`);
    } finally {
      setIsBatchRunning(false);
      batchRunnerRef.current = null;
    }
  }, [processStructure, processMapId, scenarios, scenarioFilter, runMode, workflowSteps]);

  // Stop batch execution
  const handleStopBatch = useCallback(() => {
    if (batchRunnerRef.current) {
      batchRunnerRef.current.stop();
      toast.info('Stopping batch execution...');
    }
  }, []);

  // Export scenarios to JSON
  const handleExportScenarios = useCallback(() => {
    if (scenarios.length === 0) {
      toast.error('No scenarios to export');
      return;
    }

    try {
      const exportData = {
        exportedAt: new Date().toISOString(),
        processMapId,
        processMapTitle,
        totalScenarios: scenarios.length,
        coverage: coverage ? {
          pathCoveragePercent: coverage.pathCoveragePercent,
          branchCoveragePercent: coverage.branchCoveragePercent,
          overallScore: coverage.overallScore,
        } : null,
        scenarios: scenarios.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          scenarioType: s.scenarioType,
          expectedResult: s.expectedResult,
          expectedFailureStep: s.expectedFailureStep,
          expectedFailureType: s.expectedFailureType,
          priority: s.priority,
          tags: s.tags,
          path: s.path,
          mockOverrides: s.mockOverrides,
          lastRunResult: s.lastRunResult,
          generatedAt: s.generatedAt,
        })),
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `test-scenarios-${processMapId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${scenarios.length} scenarios`);
    } catch (error) {
      const err = error as Error;
      console.error('Export failed:', err);
      toast.error(`Export failed: ${err.message}`);
    }
  }, [scenarios, coverage, processMapId, processMapTitle]);

  if (!isOpen) return null;

  // Inner content shared between embedded and standalone modes
  const testContent = (
    <>
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
              <SelectItem value="test_data">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-orange-500" />
                  Test Data Mode
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 ml-1">
                    LIVE
                  </Badge>
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
          <Button
            onClick={() => {
              if (runMode === 'test_data') {
                setShowTestDataWarning(true);
              } else {
                handleRunTest();
              }
            }}
            disabled={isRunning || isGenerating || isCleaningUp}
            className={cn("flex-1", runMode === 'test_data' && "bg-orange-600 hover:bg-orange-700")}
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {runMode === 'test_data' ? 'Running Live Test...' : 'Running...'}
              </>
            ) : isCleaningUp ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cleaning Up...
              </>
            ) : (
              <>
                {runMode === 'test_data' ? (
                  <Zap className="mr-2 h-4 w-4" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                {runMode === 'test_data' ? 'Run Live Test' : 'Run Test'}
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isRunning || isGenerating || stepResults.length === 0}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Generate Scenarios Button */}
        {processStructure && (
          <Button
            variant={justGenerated ? "default" : "secondary"}
            onClick={handleGenerateScenarios}
            disabled={isRunning || isGenerating}
            className={cn(
              "w-full transition-all duration-300",
              justGenerated && "bg-green-600 hover:bg-green-700 text-white"
            )}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {generationPhase === 'analyzing' && 'Analyzing structure...'}
                {generationPhase === 'generating' && 'Generating tests...'}
                {generationPhase === 'saving' && 'Saving scenarios...'}
                {generationPhase === 'idle' && 'Preparing...'}
              </>
            ) : justGenerated ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Generated {scenarios.length} Tests
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Tests
                {scenarios.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {scenarios.length}
                  </Badge>
                )}
              </>
            )}
          </Button>
        )}
      </div>

      {/* Results */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="px-4 pt-2 flex-shrink-0">
          <TabsList className="w-full grid" style={{ gridTemplateColumns: runMode === 'test_data' ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)' }}>
            <TabsTrigger value="progress">
              Progress
            </TabsTrigger>
            {runMode === 'test_data' && (
              <TabsTrigger value="resources">
                Resources
                {trackedResources.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                    {trackedResources.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="scenarios">
              Scenarios
              {scenarios.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                  {scenarios.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">
              History
            </TabsTrigger>
            <TabsTrigger value="logs">
              Logs
              {logs.length > 0 && (
                <Badge variant="outline" className="ml-1.5 text-[10px] px-1.5 py-0">
                  {logs.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="progress" className="p-4 pt-2 flex-1 flex flex-col min-h-0 overflow-auto data-[state=inactive]:hidden">
          {/* Summary */}
          {stepResults.length > 0 && (
            <Card className="mb-4 flex-shrink-0">
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
                      {workflowSteps.length - stepResults.length}
                    </div>
                    <div className="text-xs text-muted-foreground">Pending</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Steps list with scroll indicator */}
          <div className="flex-1 min-h-0 relative">
            <ScrollArea className="h-full">
              <TestStepProgress
                steps={workflowSteps}
                results={stepResults}
                currentStepId={currentStepId || undefined}
                isRunning={isRunning}
              />
            </ScrollArea>
            {/* Bottom fade indicator when there's more content */}
            {workflowSteps.length > 5 && (
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
            )}
          </div>

          {/* Cleanup Status for Test Data Mode */}
          {runMode === 'test_data' && (cleanupResult || isCleaningUp) && (
            <Card className="mt-4 flex-shrink-0">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  Cleanup Status
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 px-3">
                {isCleaningUp && cleanupProgress ? (
                  <div className="space-y-2">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${(cleanupProgress.completed / cleanupProgress.total) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Cleaning up {cleanupProgress.completed}/{cleanupProgress.total}
                      {cleanupProgress.currentResource && `: ${cleanupProgress.currentResource}`}
                    </p>
                  </div>
                ) : cleanupResult ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-around text-center text-xs">
                      <div>
                        <span className="font-medium text-green-500">{cleanupResult.successCount}</span>
                        <span className="text-muted-foreground ml-1">cleaned</span>
                      </div>
                      <div>
                        <span className="font-medium text-red-500">{cleanupResult.failedCount}</span>
                        <span className="text-muted-foreground ml-1">failed</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-500">{cleanupResult.skippedCount}</span>
                        <span className="text-muted-foreground ml-1">skipped</span>
                      </div>
                    </div>
                    {cleanupResult.manualCleanupInstructions.length > 0 && (
                      <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded border border-yellow-200 dark:border-yellow-800">
                        <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                          Manual Cleanup Required:
                        </p>
                        <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                          {cleanupResult.manualCleanupInstructions.slice(0, 3).map((instruction, i) => (
                            <li key={i}>• {instruction}</li>
                          ))}
                          {cleanupResult.manualCleanupInstructions.length > 3 && (
                            <li className="text-muted-foreground">
                              ... and {cleanupResult.manualCleanupInstructions.length - 3} more
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Resources Tab (Test Data Mode only) */}
        <TabsContent value="resources" className="p-4 pt-2 flex-1 flex flex-col min-h-0 overflow-auto data-[state=inactive]:hidden">
          {/* AI Prompts Used */}
          {trackedAIPrompts.length > 0 && (
            <Card className="mb-4 flex-shrink-0">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  AI Prompts Used ({trackedAIPrompts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 px-3">
                <div className="space-y-2">
                  {trackedAIPrompts.map((prompt) => (
                    <div
                      key={prompt.id}
                      className="flex items-center justify-between text-xs p-2 bg-muted/50 rounded"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{prompt.featureKey}</p>
                        <p className="text-muted-foreground">Step: {prompt.stepName}</p>
                      </div>
                      {prompt.viewUrl && (
                        <Button variant="ghost" size="sm" asChild className="h-6 w-6 p-0">
                          <a href={prompt.viewUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cleanup Actions */}
          {trackedResources.length > 0 && !cleanupResult && (
            <Card className="mb-4 flex-shrink-0 border-orange-200 dark:border-orange-800">
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Ready to clean up?</p>
                    <p className="text-xs text-muted-foreground">
                      {testDataEngineRef.current
                        ? 'Review the resources above, then clean up when ready.'
                        : 'Re-run the test to enable cleanup (session was restored).'}
                    </p>
                  </div>
                  <Button
                    onClick={handleManualCleanup}
                    disabled={isCleaningUp || isRunning || !testDataEngineRef.current}
                    variant="destructive"
                    size="sm"
                    title={!testDataEngineRef.current ? 'Re-run test to enable cleanup' : undefined}
                  >
                    {isCleaningUp ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Cleaning...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-3 w-3" />
                        Run Cleanup
                      </>
                    )}
                  </Button>
                </div>
                {isCleaningUp && cleanupProgress && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${(cleanupProgress.completed / cleanupProgress.total) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {cleanupProgress.completed}/{cleanupProgress.total}
                      {cleanupProgress.currentResource && `: ${cleanupProgress.currentResource}`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Cleanup Result Summary */}
          {cleanupResult && (
            <Card className="mb-4 flex-shrink-0 border-green-200 dark:border-green-800">
              <CardContent className="py-3">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Cleanup Complete</span>
                </div>
                <div className="flex items-center justify-around text-center text-xs">
                  <div>
                    <span className="font-medium text-green-500">{cleanupResult.successCount}</span>
                    <span className="text-muted-foreground ml-1">cleaned</span>
                  </div>
                  <div>
                    <span className="font-medium text-red-500">{cleanupResult.failedCount}</span>
                    <span className="text-muted-foreground ml-1">failed</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">{cleanupResult.skippedCount}</span>
                    <span className="text-muted-foreground ml-1">skipped</span>
                  </div>
                </div>
                {cleanupResult.manualCleanupInstructions.length > 0 && (
                  <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded border border-yellow-200 dark:border-yellow-800">
                    <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                      Manual Cleanup Required:
                    </p>
                    <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                      {cleanupResult.manualCleanupInstructions.slice(0, 3).map((instruction, i) => (
                        <li key={i}>• {instruction}</li>
                      ))}
                      {cleanupResult.manualCleanupInstructions.length > 3 && (
                        <li className="text-muted-foreground">
                          ... and {cleanupResult.manualCleanupInstructions.length - 3} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tracked Resources */}
          {trackedResources.length > 0 ? (
            <div className="flex-1 min-h-0 relative">
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {trackedResources.map((resource) => (
                    <div
                      key={resource.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-md border',
                        resource.cleanupStatus === 'success' && 'border-green-200 bg-green-50 dark:bg-green-950/20',
                        resource.cleanupStatus === 'failed' && 'border-red-200 bg-red-50 dark:bg-red-950/20',
                        resource.cleanupStatus === 'pending' && 'border-gray-200 dark:border-gray-800',
                        resource.cleanupStatus === 'not_supported' && 'border-gray-200 bg-gray-50 dark:bg-gray-950/20'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {resource.integration}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {resource.resourceType}
                          </Badge>
                          {resource.cleanupStatus === 'success' && (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-green-500">
                              Cleaned
                            </Badge>
                          )}
                          {resource.cleanupStatus === 'failed' && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                              Cleanup Failed
                            </Badge>
                          )}
                          {resource.cleanupStatus === 'not_supported' && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-gray-500">
                              Read-only
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium truncate">{resource.displayName}</p>
                        <p className="text-xs text-muted-foreground">
                          Step: {resource.createdByStepName}
                        </p>
                        {resource.externalId && (
                          <p className="text-xs text-muted-foreground truncate">
                            ID: {resource.externalId}
                          </p>
                        )}
                        {resource.cleanupError && (
                          <p className="text-xs text-red-500 mt-1">
                            Error: {resource.cleanupError}
                          </p>
                        )}
                      </div>
                      {resource.viewUrl && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={resource.viewUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View
                          </a>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              <div className="text-center">
                <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No resources tracked yet.</p>
                <p className="text-xs">Run a test to see created resources.</p>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="scenarios" className="p-4 pt-2 flex-1 flex flex-col min-h-0 overflow-auto data-[state=inactive]:hidden">
          {/* Coverage Summary */}
          {coverage && (
            <Card className="mb-4 flex-shrink-0">
              <CardContent className="py-3">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Test Coverage</span>
                </div>
                <div className="flex items-center justify-around text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-500">
                      {coverage.pathCoveragePercent}%
                    </div>
                    <div className="text-xs text-muted-foreground">Paths</div>
                  </div>
                  <Separator orientation="vertical" className="h-8" />
                  <div>
                    <div className="text-2xl font-bold text-purple-500">
                      {coverage.branchCoveragePercent}%
                    </div>
                    <div className="text-xs text-muted-foreground">Branches</div>
                  </div>
                  <Separator orientation="vertical" className="h-8" />
                  <div>
                    <div className={cn(
                      'text-2xl font-bold',
                      coverage.overallScore >= 80 ? 'text-green-500' :
                      coverage.overallScore >= 60 ? 'text-yellow-500' : 'text-red-500'
                    )}>
                      {coverage.overallScore}%
                    </div>
                    <div className="text-xs text-muted-foreground">Overall</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Batch Progress */}
          {batchProgress && isBatchRunning && (
            <Card className="mb-4 flex-shrink-0">
              <CardContent className="py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Running All Scenarios</span>
                  <Button variant="ghost" size="sm" onClick={handleStopBatch}>
                    <Square className="h-3 w-3 mr-1" />
                    Stop
                  </Button>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${batchProgress.progressPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-around text-center text-xs">
                  <div>
                    <span className="font-medium text-green-500">{batchProgress.passed}</span>
                    <span className="text-muted-foreground ml-1">passed</span>
                  </div>
                  <div>
                    <span className="font-medium text-red-500">{batchProgress.failed}</span>
                    <span className="text-muted-foreground ml-1">failed</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-500">{batchProgress.running}</span>
                    <span className="text-muted-foreground ml-1">running</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">{batchProgress.pending}</span>
                    <span className="text-muted-foreground ml-1">pending</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scenario Type Filter + Run All */}
          {scenarios.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3 flex-shrink-0">
              <Button
                variant={scenarioFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setScenarioFilter('all')}
                className="text-xs"
              >
                All ({scenarios.length})
              </Button>
              <Button
                variant={scenarioFilter === 'happy_path' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setScenarioFilter('happy_path')}
                className="text-xs"
              >
                <Route className="h-3 w-3 mr-1" />
                Happy ({scenarios.filter(s => s.scenarioType === 'happy_path').length})
              </Button>
              <Button
                variant={scenarioFilter === 'branch_path' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setScenarioFilter('branch_path')}
                className="text-xs"
              >
                <GitBranch className="h-3 w-3 mr-1" />
                Branch ({scenarios.filter(s => s.scenarioType === 'branch_path').length})
              </Button>
              <Button
                variant={scenarioFilter === 'failure_mode' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setScenarioFilter('failure_mode')}
                className="text-xs"
              >
                <AlertOctagon className="h-3 w-3 mr-1" />
                Failure ({scenarios.filter(s => s.scenarioType === 'failure_mode').length})
              </Button>
              <div className="flex-1" />
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportScenarios}
                disabled={scenarios.length === 0}
                className="text-xs"
                title="Export scenarios to JSON"
              >
                <Download className="h-3 w-3" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRunAllScenarios}
                disabled={isRunning || isGenerating || isBatchRunning || runningScenarioId !== null}
                className="text-xs"
              >
                {isBatchRunning ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-3 w-3 mr-1" />
                    Run {scenarioFilter === 'all' ? 'All' : scenarioFilter.replace('_', ' ')}
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Scenario List */}
          <div className="flex-1 min-h-0 relative">
            <ScrollArea className="h-full">
              <ScenarioList
                scenarios={scenarios}
                runningScenarioId={runningScenarioId || undefined}
                onRunScenario={handleRunScenario}
                disabled={isRunning || isGenerating}
                filterType={scenarioFilter}
              />
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="history" className="p-4 pt-2 flex-1 min-h-0 overflow-auto data-[state=inactive]:hidden">
          <TestHistoryPanel processMapId={processMapId} />
        </TabsContent>

        <TabsContent value="logs" className="p-4 pt-2 flex-1 min-h-0 overflow-auto data-[state=inactive]:hidden">
          <LogsViewer logs={logs} />
        </TabsContent>
      </Tabs>
    </>
  );

  // Test Data Mode Warning Dialog
  const testDataWarningDialog = (
    <AlertDialog open={showTestDataWarning} onOpenChange={setShowTestDataWarning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Test Data Mode Warning
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                This will create <strong>REAL resources</strong> in your connected integrations:
              </p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>HubSpot contacts, deals, and tasks</li>
                <li>Slack messages</li>
                <li>Calendar events</li>
                <li>Database records</li>
              </ul>
              <p className="text-sm text-muted-foreground">
                After the test completes, you can view and verify the created resources.
                When ready, use the "Run Cleanup" button to delete all test data.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setShowTestDataWarning(false);
              handleRunTest();
            }}
            className="bg-orange-600 hover:bg-orange-700"
          >
            I Understand, Run Test
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // Embedded mode: render content directly without positioning
  if (embedded) {
    return (
      <>
        {testDataWarningDialog}
        <div className="flex flex-col h-full bg-background">
          {testContent}
        </div>
      </>
    );
  }

  // Standalone mode: fixed position slide-out panel
  return (
    <>
      {testDataWarningDialog}
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

        {testContent}
      </div>
    </>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default WorkflowTestPanel;
export type { WorkflowTestPanelProps };
