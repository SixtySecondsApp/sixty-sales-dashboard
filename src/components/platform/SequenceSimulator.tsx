/**
 * SequenceSimulator Component
 *
 * Simulation panel for testing agent sequences with mock or live data.
 * Shows step-by-step execution progress and results.
 */

import { useState, useCallback } from 'react';
import {
  Play,
  Square,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Database,
  Edit3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSequenceExecution, DEFAULT_MOCK_DATA } from '@/lib/hooks/useSequenceExecution';
import type { AgentSequence, StepResult } from '@/lib/hooks/useAgentSequences';

// =============================================================================
// Types
// =============================================================================

interface SequenceSimulatorProps {
  sequence: AgentSequence;
  className?: string;
}

// =============================================================================
// Step Result Display
// =============================================================================

interface StepResultDisplayProps {
  result: StepResult;
  index: number;
}

function StepResultDisplay({ result, index }: StepResultDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusIcon = {
    pending: <Clock className="h-4 w-4 text-muted-foreground" />,
    running: <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />,
    completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    failed: <XCircle className="h-4 w-4 text-red-500" />,
    skipped: <Clock className="h-4 w-4 text-muted-foreground" />,
  };

  const statusColor = {
    pending: 'border-muted',
    running: 'border-yellow-500 bg-yellow-50',
    completed: 'border-green-500 bg-green-50',
    failed: 'border-red-500 bg-red-50',
    skipped: 'border-muted',
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div
        className={cn(
          'rounded-lg border p-3 transition-colors',
          statusColor[result.status]
        )}
      >
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-3 text-left">
            {statusIcon[result.status]}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">Step {index + 1}</span>
                <code className="text-xs text-muted-foreground">{result.skill_key}</code>
              </div>
              {result.duration_ms && (
                <span className="text-xs text-muted-foreground">
                  {result.duration_ms}ms
                </span>
              )}
            </div>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-3 space-y-2 text-sm">
            {/* Input */}
            {Object.keys(result.input).length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Input</Label>
                <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                  {JSON.stringify(result.input, null, 2)}
                </pre>
              </div>
            )}

            {/* Output */}
            {result.output && (
              <div>
                <Label className="text-xs text-muted-foreground">Output</Label>
                <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                  {JSON.stringify(result.output, null, 2)}
                </pre>
              </div>
            )}

            {/* Error */}
            {result.error && (
              <div>
                <Label className="text-xs text-red-600">Error</Label>
                <pre className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  {result.error}
                </pre>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function SequenceSimulator({ sequence, className }: SequenceSimulatorProps) {
  const [isSimulation, setIsSimulation] = useState(true);
  const [inputContextJson, setInputContextJson] = useState('{}');
  const [mockDataJson, setMockDataJson] = useState(
    JSON.stringify(DEFAULT_MOCK_DATA, null, 2)
  );
  const [showMockEditor, setShowMockEditor] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const execution = useSequenceExecution();

  // Parse JSON safely
  const parseJson = useCallback((json: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(json);
      setJsonError(null);
      return parsed;
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON');
      return null;
    }
  }, []);

  // Handle run simulation
  const handleRun = useCallback(async () => {
    const inputContext = parseJson(inputContextJson);
    if (!inputContext) return;

    const mockData = isSimulation ? parseJson(mockDataJson) : undefined;
    if (isSimulation && !mockData) return;

    try {
      await execution.execute(sequence, {
        isSimulation,
        inputContext,
        mockData,
        // For live mode, use backend execution which supports both skills and actions
        useLiveBackend: !isSimulation,
        onStepStart: (index) => {
          console.log(`[Simulator] Step ${index + 1} started`);
        },
        onStepComplete: (index, result) => {
          console.log(`[Simulator] Step ${index + 1} completed`, result);
        },
        onStepFailed: (index, error) => {
          console.log(`[Simulator] Step ${index + 1} failed:`, error);
        },
      });
    } catch (error) {
      console.error('[Simulator] Execution error:', error);
    }
  }, [sequence, isSimulation, inputContextJson, mockDataJson, parseJson, execution]);

  // Handle stop
  const handleStop = useCallback(() => {
    execution.cancel();
  }, [execution]);

  // Handle reset
  const handleReset = useCallback(() => {
    execution.reset();
    setJsonError(null);
  }, [execution]);

  // Check if all steps have valid skill keys
  const stepsWithSkills = sequence.frontmatter.sequence_steps?.filter(s => s.skill_key) || [];
  const hasValidSteps = stepsWithSkills.length > 0;
  const totalSteps = sequence.frontmatter.sequence_steps?.length || 0;
  const missingSkillCount = totalSteps - stepsWithSkills.length;

  const canRun =
    !execution.isExecuting &&
    hasValidSteps &&
    !jsonError;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="p-4 border-b space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Simulation</h3>
          <div className="flex items-center gap-2">
            <Label htmlFor="simulation-mode" className="text-sm text-muted-foreground">
              Mode:
            </Label>
            <div className="flex items-center gap-2 rounded-lg border p-1">
              <button
                onClick={() => setIsSimulation(true)}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors',
                  isSimulation
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Mock
              </button>
              <button
                onClick={() => setIsSimulation(false)}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors',
                  !isSimulation
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <Database className="h-3.5 w-3.5" />
                Live
              </button>
            </div>
          </div>
        </div>

        {/* Input Context */}
        <div>
          <Label className="text-sm">Input Context</Label>
          <Textarea
            value={inputContextJson}
            onChange={(e) => {
              setInputContextJson(e.target.value);
              parseJson(e.target.value);
            }}
            placeholder='{ "email": "example@company.com" }'
            className="mt-1 font-mono text-xs h-20"
          />
        </div>

        {/* Mock Data Editor (only in simulation mode) */}
        {isSimulation && (
          <Collapsible open={showMockEditor} onOpenChange={setShowMockEditor}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 w-full justify-start">
                <Edit3 className="h-3.5 w-3.5" />
                {showMockEditor ? 'Hide' : 'Edit'} Mock Data
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Textarea
                value={mockDataJson}
                onChange={(e) => {
                  setMockDataJson(e.target.value);
                  parseJson(e.target.value);
                }}
                className="mt-2 font-mono text-xs h-48"
              />
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Error Message */}
        {jsonError && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
            JSON Error: {jsonError}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {execution.isExecuting ? (
            <Button onClick={handleStop} variant="destructive" className="gap-2 flex-1">
              <Square className="h-4 w-4" />
              Stop
            </Button>
          ) : (
            <Button onClick={handleRun} disabled={!canRun} className="gap-2 flex-1">
              <Play className="h-4 w-4" />
              Run {isSimulation ? 'Simulation' : 'Live'}
            </Button>
          )}
          <Button onClick={handleReset} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Status Messages */}
        {!canRun && !execution.isExecuting && (
          <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
            {totalSteps === 0 ? (
              <span>Add at least one step to run the simulation.</span>
            ) : missingSkillCount > 0 ? (
              <span>
                {missingSkillCount} step{missingSkillCount > 1 ? 's' : ''} need{missingSkillCount === 1 ? 's' : ''} a skill selected.
              </span>
            ) : jsonError ? (
              <span>Fix JSON errors to run the simulation.</span>
            ) : null}
          </div>
        )}
      </div>

      {/* Results */}
      <ScrollArea className="flex-1 p-4">
        {execution.stepResults.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <p>Click "Run" to test the sequence.</p>
            <p className="mt-2 text-xs">
              {isSimulation
                ? 'Mock mode uses simulated data.'
                : 'Live mode executes against your database.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {execution.stepResults.map((result, index) => (
              <StepResultDisplay key={index} result={result} index={index} />
            ))}

            {/* Final Status */}
            {(execution.status === 'completed' || execution.status === 'failed') && (
              <div
                className={cn(
                  'mt-4 p-4 rounded-lg border',
                  execution.status === 'completed'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  {execution.status === 'completed' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span
                    className={cn(
                      'font-semibold',
                      execution.status === 'completed' ? 'text-green-700' : 'text-red-700'
                    )}
                  >
                    {execution.status === 'completed'
                      ? 'Sequence Completed'
                      : 'Sequence Failed'}
                  </span>
                </div>

                {execution.error && (
                  <p className="text-sm text-red-700">{execution.error}</p>
                )}

                {execution.status === 'completed' && Object.keys(execution.context).length > 0 && (
                  <div className="mt-3">
                    <Label className="text-xs text-muted-foreground">Final Context</Label>
                    <pre className="mt-1 p-2 bg-white border rounded text-xs overflow-x-auto max-h-48">
                      {JSON.stringify(execution.context, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export default SequenceSimulator;
