/**
 * SequenceExecutionViewer Component
 *
 * Modal for viewing detailed execution history of an agent sequence.
 * Shows step-by-step results, timing, and error information.
 */

import { useMemo } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  Sparkles,
  Database,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { SequenceExecution, StepResult } from '@/lib/hooks/useAgentSequences';

// =============================================================================
// Types
// =============================================================================

interface SequenceExecutionViewerProps {
  execution: SequenceExecution | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// =============================================================================
// Status Components
// =============================================================================

function StatusBadge({ status }: { status: SequenceExecution['status'] }) {
  const config = {
    pending: { icon: Clock, color: 'bg-gray-100 text-gray-700', label: 'Pending' },
    running: { icon: Loader2, color: 'bg-yellow-100 text-yellow-700', label: 'Running' },
    completed: { icon: CheckCircle2, color: 'bg-green-100 text-green-700', label: 'Completed' },
    failed: { icon: XCircle, color: 'bg-red-100 text-red-700', label: 'Failed' },
    cancelled: { icon: AlertCircle, color: 'bg-orange-100 text-orange-700', label: 'Cancelled' },
  };

  const { icon: Icon, color, label } = config[status];

  return (
    <Badge className={cn('gap-1', color)}>
      <Icon className={cn('h-3 w-3', status === 'running' && 'animate-spin')} />
      {label}
    </Badge>
  );
}

// =============================================================================
// Step Result Row
// =============================================================================

interface StepResultRowProps {
  result: StepResult;
  isLast: boolean;
}

function StepResultRow({ result, isLast }: StepResultRowProps) {
  const statusIcon = {
    pending: <Clock className="h-4 w-4 text-muted-foreground" />,
    running: <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />,
    completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    failed: <XCircle className="h-4 w-4 text-red-500" />,
    skipped: <Clock className="h-4 w-4 text-muted-foreground" />,
  };

  return (
    <div className="relative">
      {/* Timeline connector */}
      {!isLast && (
        <div className="absolute left-[11px] top-8 bottom-0 w-px bg-border" />
      )}

      <div className="flex gap-3">
        {/* Status indicator */}
        <div className="shrink-0 pt-1">{statusIcon[result.status]}</div>

        {/* Content */}
        <div className="flex-1 pb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">Step {result.step_index + 1}</span>
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{result.skill_key}</code>
            {result.duration_ms && (
              <span className="text-xs text-muted-foreground">{result.duration_ms}ms</span>
            )}
          </div>

          {/* Input */}
          {result.input && Object.keys(result.input).length > 0 && (
            <div className="mb-2">
              <span className="text-xs text-muted-foreground">Input:</span>
              <pre className="mt-1 p-2 bg-muted/50 rounded text-xs overflow-x-auto max-h-24">
                {JSON.stringify(result.input, null, 2)}
              </pre>
            </div>
          )}

          {/* Output */}
          {result.output && (
            <div className="mb-2">
              <span className="text-xs text-muted-foreground">Output:</span>
              <pre className="mt-1 p-2 bg-green-50 border border-green-200 rounded text-xs overflow-x-auto max-h-32">
                {JSON.stringify(result.output, null, 2)}
              </pre>
            </div>
          )}

          {/* Error */}
          {result.error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded">
              <span className="text-xs text-red-600 font-medium">Error:</span>
              <pre className="mt-1 text-xs text-red-700 whitespace-pre-wrap">
                {result.error}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function SequenceExecutionViewer({
  execution,
  open,
  onOpenChange,
}: SequenceExecutionViewerProps) {
  // Format dates
  const formattedDates = useMemo(() => {
    if (!execution) return null;
    return {
      started: execution.started_at
        ? format(new Date(execution.started_at), 'PPp')
        : null,
      completed: execution.completed_at
        ? format(new Date(execution.completed_at), 'PPp')
        : null,
      relative: execution.started_at
        ? formatDistanceToNow(new Date(execution.started_at), { addSuffix: true })
        : null,
    };
  }, [execution]);

  // Calculate duration
  const duration = useMemo(() => {
    if (!execution?.started_at || !execution?.completed_at) return null;
    const start = new Date(execution.started_at).getTime();
    const end = new Date(execution.completed_at).getTime();
    return end - start;
  }, [execution]);

  if (!execution) return null;

  const stepResults = (execution.step_results || []) as StepResult[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Execution Details
            <StatusBadge status={execution.status} />
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex items-center gap-4 text-sm">
              <code className="bg-muted px-2 py-0.5 rounded">{execution.sequence_key}</code>
              <Badge variant="outline" className="gap-1">
                {execution.is_simulation ? (
                  <>
                    <Sparkles className="h-3 w-3" />
                    Mock
                  </>
                ) : (
                  <>
                    <Database className="h-3 w-3" />
                    Live
                  </>
                )}
              </Badge>
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Timing Info */}
        <div className="grid grid-cols-3 gap-4 py-3 border-y">
          <div>
            <span className="text-xs text-muted-foreground block">Started</span>
            <span className="text-sm font-medium">
              {formattedDates?.started || 'N/A'}
            </span>
            {formattedDates?.relative && (
              <span className="text-xs text-muted-foreground block">
                {formattedDates.relative}
              </span>
            )}
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Completed</span>
            <span className="text-sm font-medium">
              {formattedDates?.completed || 'In progress...'}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Duration</span>
            <span className="text-sm font-medium">
              {duration ? `${duration}ms` : 'N/A'}
            </span>
          </div>
        </div>

        {/* Input Context */}
        {execution.input_context && Object.keys(execution.input_context).length > 0 && (
          <div>
            <span className="text-xs text-muted-foreground block mb-1">Input Context</span>
            <pre className="p-2 bg-muted rounded text-xs overflow-x-auto max-h-24">
              {JSON.stringify(execution.input_context, null, 2)}
            </pre>
          </div>
        )}

        {/* Step Results */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="py-4">
            <span className="text-xs text-muted-foreground block mb-3">
              Execution Steps ({stepResults.length})
            </span>
            {stepResults.length > 0 ? (
              <div>
                {stepResults.map((result, index) => (
                  <StepResultRow
                    key={index}
                    result={result}
                    isLast={index === stepResults.length - 1}
                  />
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-8">
                No step results available
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Error Message */}
        {execution.error_message && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700 font-medium text-sm mb-1">
              <XCircle className="h-4 w-4" />
              Execution Failed
              {execution.failed_step_index !== null && (
                <span className="font-normal">at step {execution.failed_step_index + 1}</span>
              )}
            </div>
            <pre className="text-xs text-red-600 whitespace-pre-wrap">
              {execution.error_message}
            </pre>
          </div>
        )}

        {/* Final Output */}
        {execution.final_output && execution.status === 'completed' && (
          <div>
            <span className="text-xs text-muted-foreground block mb-1">Final Output</span>
            <pre className="p-2 bg-green-50 border border-green-200 rounded text-xs overflow-x-auto max-h-32">
              {JSON.stringify(execution.final_output, null, 2)}
            </pre>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default SequenceExecutionViewer;
