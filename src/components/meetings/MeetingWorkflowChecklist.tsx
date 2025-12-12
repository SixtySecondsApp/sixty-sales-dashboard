/**
 * Meeting Workflow Checklist Component
 *
 * Displays checklist coverage results from call type workflows:
 * - Visual checklist with covered/missing status
 * - Coverage percentage with progress bar
 * - Evidence quotes for covered items
 * - Grouped by category
 * - Missing required items highlighted
 * - Forward movement signals display
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  Quote,
  TrendingUp,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkflowResults, WorkflowChecklistItem, ForwardMovementSignal } from '@/lib/hooks/useWorkflowResults';

interface MeetingWorkflowChecklistProps {
  meetingId: string;
  className?: string;
  compact?: boolean;
  showForwardMovement?: boolean;
}

export function MeetingWorkflowChecklist({
  meetingId,
  className,
  compact = false,
  showForwardMovement = true,
}: MeetingWorkflowChecklistProps) {
  const {
    workflowResult,
    loading,
    error,
    checklistItems,
    groupedChecklist,
    coverageScore,
    requiredCoverageScore,
    missingRequiredItems,
    totalItems,
    coveredItems,
    forwardMovementSignals,
    hasForwardMovement,
    pipelineActionTaken,
    pipelineActionDetails,
  } = useWorkflowResults(meetingId);

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['discovery', 'qualification']));

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!workflowResult || checklistItems.length === 0) {
    return null; // No checklist configured for this call type
  }

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Determine overall status color
  const getStatusColor = () => {
    if (requiredCoverageScore === 100) return 'text-green-500';
    if (requiredCoverageScore >= 75) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getProgressColor = () => {
    if (requiredCoverageScore === 100) return 'bg-green-500';
    if (requiredCoverageScore >= 75) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (compact) {
    return (
      <CompactChecklist
        coverageScore={coverageScore}
        requiredCoverageScore={requiredCoverageScore}
        totalItems={totalItems}
        coveredItems={coveredItems}
        missingRequiredItems={missingRequiredItems}
        className={className}
      />
    );
  }

  return (
    <div className={cn('rounded-lg border bg-card', className)}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className={cn('h-5 w-5', getStatusColor())} />
            <h3 className="font-semibold">Call Checklist</h3>
          </div>
          <div className="flex items-center gap-4">
            <span className={cn('text-sm font-medium', getStatusColor())}>
              {Math.round(coverageScore)}% Complete
            </span>
            <span className="text-xs text-muted-foreground">
              {coveredItems}/{totalItems} items
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${coverageScore}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={cn('h-full rounded-full', getProgressColor())}
          />
        </div>
      </div>

      {/* Missing required items warning */}
      {missingRequiredItems.length > 0 && (
        <div className="mx-4 mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-500">
                Missing Required Items ({missingRequiredItems.length})
              </p>
              <ul className="mt-1 text-xs text-muted-foreground space-y-0.5">
                {missingRequiredItems.slice(0, 3).map((item, idx) => (
                  <li key={idx}>- {item}</li>
                ))}
                {missingRequiredItems.length > 3 && (
                  <li>- and {missingRequiredItems.length - 3} more...</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Checklist by category */}
      <div className="p-4 space-y-3">
        {Object.entries(groupedChecklist).map(([category, items]) => (
          <CategorySection
            key={category}
            category={category}
            items={items}
            isExpanded={expandedCategories.has(category)}
            onToggle={() => toggleCategory(category)}
          />
        ))}
      </div>

      {/* Forward Movement Signals */}
      {showForwardMovement && hasForwardMovement && (
        <div className="border-t p-4">
          <ForwardMovementSection
            signals={forwardMovementSignals}
            pipelineActionTaken={pipelineActionTaken}
            pipelineActionDetails={pipelineActionDetails}
          />
        </div>
      )}
    </div>
  );
}

// =====================================================
// Sub-Components
// =====================================================

interface CategorySectionProps {
  category: string;
  items: WorkflowChecklistItem[];
  isExpanded: boolean;
  onToggle: () => void;
}

function CategorySection({ category, items, isExpanded, onToggle }: CategorySectionProps) {
  const coveredCount = items.filter(i => i.covered).length;
  const allCovered = coveredCount === items.length;
  const hasRequired = items.some(i => i.required);
  const missingRequired = items.filter(i => i.required && !i.covered).length > 0;

  const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ');

  return (
    <div className="border rounded-md overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-medium text-sm">{categoryLabel}</span>
          {missingRequired && (
            <span className="text-xs px-1.5 py-0.5 bg-red-500/10 text-red-500 rounded">
              Missing required
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {allCovered ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <span className="text-xs text-muted-foreground">
              {coveredCount}/{items.length}
            </span>
          )}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2">
              {items.map((item) => (
                <ChecklistItemRow key={item.item_id} item={item} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ChecklistItemRowProps {
  item: WorkflowChecklistItem;
}

function ChecklistItemRow({ item }: ChecklistItemRowProps) {
  const [showEvidence, setShowEvidence] = useState(false);

  return (
    <div className={cn(
      'p-2 rounded-md text-sm',
      item.covered ? 'bg-green-500/5' : item.required ? 'bg-red-500/10' : 'bg-muted/50'
    )}>
      <div className="flex items-start gap-2">
        {item.covered ? (
          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
        ) : (
          <XCircle className={cn(
            'h-4 w-4 mt-0.5 shrink-0',
            item.required ? 'text-red-500' : 'text-muted-foreground'
          )} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              item.covered ? 'text-foreground' : item.required ? 'text-red-500' : 'text-muted-foreground'
            )}>
              {item.label}
            </span>
            {item.required && (
              <span className="text-[10px] px-1 py-0.5 bg-primary/10 text-primary rounded">
                Required
              </span>
            )}
          </div>

          {/* Timestamp */}
          {item.covered && item.timestamp && (
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{item.timestamp}</span>
            </div>
          )}

          {/* Evidence quote */}
          {item.covered && item.evidence_quote && (
            <>
              <button
                onClick={() => setShowEvidence(!showEvidence)}
                className="mt-1 text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Quote className="h-3 w-3" />
                {showEvidence ? 'Hide evidence' : 'Show evidence'}
              </button>
              <AnimatePresence>
                {showEvidence && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-2 pl-3 border-l-2 border-primary/30 text-xs text-muted-foreground italic"
                  >
                    "{item.evidence_quote}"
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface ForwardMovementSectionProps {
  signals: ForwardMovementSignal[];
  pipelineActionTaken: string | null;
  pipelineActionDetails: Record<string, any> | null;
}

function ForwardMovementSection({
  signals,
  pipelineActionTaken,
  pipelineActionDetails,
}: ForwardMovementSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-green-500" />
        <span className="font-medium text-sm">Forward Movement Detected</span>
      </div>

      <div className="space-y-2">
        {signals.map((signal, idx) => (
          <div
            key={idx}
            className="p-2 bg-green-500/5 border border-green-500/20 rounded-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                {formatSignalType(signal.type)}
              </span>
              <span className="text-xs text-muted-foreground">
                {Math.round(signal.confidence * 100)}% confidence
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground italic">
              "{signal.evidence}"
            </p>
          </div>
        ))}
      </div>

      {/* Pipeline action taken */}
      {pipelineActionTaken && (
        <div className="flex items-center gap-2 p-2 bg-primary/5 border border-primary/20 rounded-md">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm">
            Pipeline updated: {formatPipelineAction(pipelineActionTaken, pipelineActionDetails)}
          </span>
        </div>
      )}
    </div>
  );
}

interface CompactChecklistProps {
  coverageScore: number;
  requiredCoverageScore: number;
  totalItems: number;
  coveredItems: number;
  missingRequiredItems: string[];
  className?: string;
}

function CompactChecklist({
  coverageScore,
  requiredCoverageScore,
  totalItems,
  coveredItems,
  missingRequiredItems,
  className,
}: CompactChecklistProps) {
  const hasIssues = missingRequiredItems.length > 0;

  return (
    <div className={cn(
      'flex items-center gap-3 p-2 rounded-md border',
      hasIssues ? 'bg-amber-500/5 border-amber-500/20' : 'bg-green-500/5 border-green-500/20',
      className
    )}>
      {hasIssues ? (
        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
      ) : (
        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            Checklist: {Math.round(coverageScore)}%
          </span>
          <span className="text-xs text-muted-foreground">
            {coveredItems}/{totalItems}
          </span>
        </div>
        {hasIssues && (
          <p className="text-xs text-amber-500 truncate">
            {missingRequiredItems.length} required item(s) missing
          </p>
        )}
      </div>
    </div>
  );
}

// =====================================================
// Helper Functions
// =====================================================

function formatSignalType(type: string): string {
  const labels: Record<string, string> = {
    proposal_requested: 'Proposal Requested',
    pricing_discussed: 'Pricing Discussed',
    verbal_commitment: 'Verbal Commitment',
    next_meeting_scheduled: 'Next Meeting Scheduled',
    decision_maker_engaged: 'Decision Maker Engaged',
    timeline_confirmed: 'Timeline Confirmed',
    forward_movement_detected: 'Forward Movement',
  };
  return labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatPipelineAction(action: string, details: Record<string, any> | null): string {
  switch (action) {
    case 'stage_advanced':
      return 'Deal stage advanced';
    case 'task_created':
      return `Task created: "${details?.title || 'Follow-up task'}"`;
    case 'deal_field_updated':
      return `${details?.field || 'Field'} updated`;
    default:
      return action.replace(/_/g, ' ');
  }
}

export default MeetingWorkflowChecklist;
