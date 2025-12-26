/**
 * Scenario Card Component
 *
 * Displays a single test scenario with type badge, run button, and result indicator.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Route,
  GitBranch,
  AlertOctagon,
  Clock,
} from 'lucide-react';
import type {
  GeneratedTestScenario,
  ScenarioType,
  TestRunResult,
} from '@/lib/types/processMapTesting';

// ============================================================================
// Types
// ============================================================================

interface ScenarioCardProps {
  /** The scenario to display */
  scenario: GeneratedTestScenario;
  /** Whether this scenario is currently running */
  isRunning?: boolean;
  /** Callback when Run button is clicked */
  onRun?: (scenario: GeneratedTestScenario) => void;
  /** Whether the Run button should be disabled */
  disabled?: boolean;
  /** Compact mode for smaller cards */
  compact?: boolean;
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Icon for scenario type
 */
function ScenarioTypeIcon({ type }: { type: ScenarioType }) {
  switch (type) {
    case 'happy_path':
      return <Route className="h-4 w-4 text-green-500" />;
    case 'branch_path':
      return <GitBranch className="h-4 w-4 text-blue-500" />;
    case 'failure_mode':
      return <AlertOctagon className="h-4 w-4 text-orange-500" />;
  }
}

/**
 * Badge variant for scenario type
 */
function getTypeBadgeVariant(type: ScenarioType): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (type) {
    case 'happy_path':
      return 'default';
    case 'branch_path':
      return 'secondary';
    case 'failure_mode':
      return 'destructive';
  }
}

/**
 * Result indicator icon
 */
function ResultIndicator({ result }: { result: TestRunResult }) {
  switch (result) {
    case 'pass':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'fail':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'partial':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'error':
      return <AlertOctagon className="h-4 w-4 text-red-500" />;
  }
}

/**
 * Human-readable scenario type label
 */
function getTypeLabel(type: ScenarioType): string {
  switch (type) {
    case 'happy_path':
      return 'Happy Path';
    case 'branch_path':
      return 'Branch';
    case 'failure_mode':
      return 'Failure';
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function ScenarioCard({
  scenario,
  isRunning = false,
  onRun,
  disabled = false,
  compact = false,
}: ScenarioCardProps) {
  const handleRun = () => {
    onRun?.(scenario);
  };

  const lastResult = scenario.lastRunResult;
  const hasRun = !!lastResult;

  return (
    <Card
      className={cn(
        'transition-all duration-200',
        isRunning && 'ring-2 ring-blue-500 ring-offset-2',
        hasRun && lastResult?.result === 'pass' && 'border-green-200 dark:border-green-800',
        hasRun && lastResult?.result === 'fail' && 'border-red-200 dark:border-red-800'
      )}
    >
      <CardContent className={cn('p-3', compact && 'p-2')}>
        <div className="flex items-start gap-3">
          {/* Type Icon */}
          <div className="flex-shrink-0 mt-0.5">
            <ScenarioTypeIcon type={scenario.scenarioType} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-1">
              <span
                className={cn(
                  'font-medium truncate',
                  compact ? 'text-sm' : 'text-sm'
                )}
                title={scenario.name}
              >
                {scenario.name}
              </span>
              <Badge
                variant={getTypeBadgeVariant(scenario.scenarioType)}
                className="text-[10px] px-1.5 py-0 flex-shrink-0"
              >
                {getTypeLabel(scenario.scenarioType)}
              </Badge>
            </div>

            {/* Description (if not compact) */}
            {!compact && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                {scenario.description}
              </p>
            )}

            {/* Meta Info */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{scenario.path.totalSteps} steps</span>
              {scenario.path.decisions.length > 0 && (
                <span>{scenario.path.decisions.length} decisions</span>
              )}
              {scenario.expectedResult === 'fail' && scenario.expectedFailureType && (
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  {scenario.expectedFailureType.replace('_', ' ')}
                </Badge>
              )}
            </div>

            {/* Tags */}
            {!compact && scenario.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {scenario.tags
                  .filter((tag) => !tag.startsWith('steps:') && !tag.startsWith('decisions:'))
                  .slice(0, 3)
                  .map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="text-[10px] px-1 py-0"
                    >
                      {tag}
                    </Badge>
                  ))}
                {scenario.tags.length > 3 && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                    +{scenario.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Last Result */}
            {hasRun && !isRunning && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1">
                      <ResultIndicator result={lastResult.result} />
                      <span className="text-xs text-muted-foreground">
                        {lastResult.durationMs}ms
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Last run: {lastResult.result}
                      <br />
                      <span className="text-xs text-muted-foreground">
                        {new Date(lastResult.runAt).toLocaleString()}
                      </span>
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Run Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRun}
              disabled={disabled || isRunning}
              className="h-8 w-8"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Scenario List Component
// ============================================================================

interface ScenarioListProps {
  /** List of scenarios to display */
  scenarios: GeneratedTestScenario[];
  /** ID of currently running scenario (if any) */
  runningScenarioId?: string;
  /** Callback when a scenario Run button is clicked */
  onRunScenario?: (scenario: GeneratedTestScenario) => void;
  /** Whether all run buttons should be disabled */
  disabled?: boolean;
  /** Use compact mode for cards */
  compact?: boolean;
  /** Filter by scenario type */
  filterType?: ScenarioType | 'all';
  /** Maximum number of scenarios to show */
  maxVisible?: number;
}

export function ScenarioList({
  scenarios,
  runningScenarioId,
  onRunScenario,
  disabled = false,
  compact = false,
  filterType = 'all',
  maxVisible,
}: ScenarioListProps) {
  // Filter scenarios
  const filteredScenarios =
    filterType === 'all'
      ? scenarios
      : scenarios.filter((s) => s.scenarioType === filterType);

  // Limit visible scenarios
  const visibleScenarios = maxVisible
    ? filteredScenarios.slice(0, maxVisible)
    : filteredScenarios;

  const hiddenCount = filteredScenarios.length - visibleScenarios.length;

  if (visibleScenarios.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Route className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No scenarios generated yet.</p>
        <p className="text-xs">Click "Generate Tests" to create test scenarios.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {visibleScenarios.map((scenario) => (
        <ScenarioCard
          key={scenario.id}
          scenario={scenario}
          isRunning={runningScenarioId === scenario.id}
          onRun={onRunScenario}
          disabled={disabled}
          compact={compact}
        />
      ))}
      {hiddenCount > 0 && (
        <p className="text-xs text-center text-muted-foreground pt-2">
          +{hiddenCount} more scenarios
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default ScenarioCard;
export type { ScenarioCardProps, ScenarioListProps };
