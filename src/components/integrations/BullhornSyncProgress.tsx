/**
 * Bullhorn Sync Progress Component
 *
 * Displays sync status, progress indicators, and queue information
 * for the Bullhorn integration.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  Check,
  AlertCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
  Users,
  Building2,
  Briefcase,
  FileText,
  CheckSquare,
  Send,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

export type EntityType =
  | 'candidate'
  | 'client_contact'
  | 'client_corporation'
  | 'job_order'
  | 'placement'
  | 'task'
  | 'note'
  | 'sendout';

export type SyncStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface EntityProgress {
  entityType: EntityType;
  status: SyncStatus;
  total: number;
  processed: number;
  created: number;
  updated: number;
  failed: number;
  startedAt: string | null;
  completedAt: string | null;
  error?: string;
}

export interface QueueStatus {
  pending: number;
  processing: number;
  failed: number;
}

export interface SyncStatusData {
  lastSyncAt: string | null;
  entityStatuses: Record<string, { lastSyncAt: string | null; count: number }>;
  queueStatus: QueueStatus;
}

export interface BullhornSyncProgressProps {
  syncStatus: SyncStatusData;
  entityProgress?: Map<EntityType, EntityProgress>;
  isRunning?: boolean;
  onStartSync?: () => void;
  onCancelSync?: () => void;
  onRetryFailed?: () => void;
  onClearFailed?: () => void;
  className?: string;
}

// =============================================================================
// Entity Icons & Labels
// =============================================================================

const ENTITY_CONFIG: Record<EntityType, { icon: typeof Users; label: string; color: string }> = {
  candidate: { icon: Users, label: 'Candidates', color: 'text-blue-500' },
  client_contact: { icon: Users, label: 'Contacts', color: 'text-green-500' },
  client_corporation: { icon: Building2, label: 'Companies', color: 'text-purple-500' },
  job_order: { icon: Briefcase, label: 'Job Orders', color: 'text-orange-500' },
  placement: { icon: FileText, label: 'Placements', color: 'text-emerald-500' },
  task: { icon: CheckSquare, label: 'Tasks', color: 'text-yellow-500' },
  note: { icon: FileText, label: 'Notes', color: 'text-gray-500' },
  sendout: { icon: Send, label: 'Sendouts', color: 'text-pink-500' },
};

// =============================================================================
// Sub-Components
// =============================================================================

interface EntityRowProps {
  entityType: EntityType;
  progress?: EntityProgress;
  lastSyncAt?: string | null;
  count?: number;
}

function EntityRow({ entityType, progress, lastSyncAt, count }: EntityRowProps) {
  const config = ENTITY_CONFIG[entityType];
  const Icon = config.icon;

  const getStatusBadge = () => {
    if (!progress) {
      return count ? (
        <Badge variant="secondary" className="text-xs">
          {count} synced
        </Badge>
      ) : null;
    }

    switch (progress.status) {
      case 'running':
        return (
          <Badge variant="default" className="bg-blue-500 text-xs">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Syncing
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="default" className="bg-green-500 text-xs">
            <Check className="mr-1 h-3 w-3" />
            Done
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="text-xs">
            <AlertCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-xs">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
    }
  };

  const getProgressBar = () => {
    if (!progress || progress.total === 0) return null;

    const percent = Math.round((progress.processed / progress.total) * 100);

    return (
      <div className="mt-2 space-y-1">
        <Progress value={percent} className="h-1.5" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {progress.processed} / {progress.total}
          </span>
          <span>{percent}%</span>
        </div>
      </div>
    );
  };

  const formatLastSync = (date: string | null | undefined) => {
    if (!date) return 'Never';
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-md bg-muted', config.color)}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium">{config.label}</p>
          <p className="text-xs text-muted-foreground">
            Last sync: {formatLastSync(progress?.completedAt || lastSyncAt)}
          </p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        {getStatusBadge()}
        {progress?.status === 'running' && getProgressBar()}
        {progress?.failed && progress.failed > 0 && (
          <span className="text-xs text-destructive">
            {progress.failed} failed
          </span>
        )}
      </div>
    </div>
  );
}

interface QueueStatusCardProps {
  queue: QueueStatus;
  onRetry?: () => void;
  onClear?: () => void;
}

function QueueStatusCard({ queue, onRetry, onClear }: QueueStatusCardProps) {
  const total = queue.pending + queue.processing + queue.failed;

  if (total === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Check className="h-4 w-4 text-green-500" />
        Queue is empty
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2 rounded-md bg-muted">
          <p className="text-lg font-semibold">{queue.pending}</p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </div>
        <div className="text-center p-2 rounded-md bg-blue-500/10">
          <p className="text-lg font-semibold text-blue-500">{queue.processing}</p>
          <p className="text-xs text-muted-foreground">Processing</p>
        </div>
        <div className="text-center p-2 rounded-md bg-destructive/10">
          <p className="text-lg font-semibold text-destructive">{queue.failed}</p>
          <p className="text-xs text-muted-foreground">Failed</p>
        </div>
      </div>

      {queue.failed > 0 && (
        <div className="flex gap-2">
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="flex-1">
              <RefreshCw className="mr-1 h-3 w-3" />
              Retry Failed
            </Button>
          )}
          {onClear && (
            <Button variant="ghost" size="sm" onClick={onClear} className="text-destructive">
              Clear
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function BullhornSyncProgress({
  syncStatus,
  entityProgress,
  isRunning = false,
  onStartSync,
  onCancelSync,
  onRetryFailed,
  onClearFailed,
  className,
}: BullhornSyncProgressProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [animateSync, setAnimateSync] = useState(false);

  // Animate sync icon when running
  useEffect(() => {
    setAnimateSync(isRunning);
  }, [isRunning]);

  const formatLastSync = (date: string | null) => {
    if (!date) return 'Never synced';
    const d = new Date(date);
    return d.toLocaleString();
  };

  const entityTypes: EntityType[] = [
    'client_corporation',
    'client_contact',
    'candidate',
    'job_order',
    'placement',
    'task',
    'sendout',
    'note',
  ];

  // Calculate overall progress
  const overallProgress = entityProgress
    ? Array.from(entityProgress.values()).reduce(
        (acc, p) => ({
          total: acc.total + p.total,
          processed: acc.processed + p.processed,
          failed: acc.failed + p.failed,
        }),
        { total: 0, processed: 0, failed: 0 }
      )
    : null;

  const overallPercent = overallProgress?.total
    ? Math.round((overallProgress.processed / overallProgress.total) * 100)
    : 0;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <motion.div
              animate={animateSync ? { rotate: 360 } : { rotate: 0 }}
              transition={{ duration: 1, repeat: animateSync ? Infinity : 0, ease: 'linear' }}
            >
              <RefreshCw className={cn('h-5 w-5', isRunning && 'text-blue-500')} />
            </motion.div>
            <CardTitle className="text-lg">Bullhorn Sync</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {isRunning ? (
              <Button variant="destructive" size="sm" onClick={onCancelSync}>
                Cancel
              </Button>
            ) : (
              <Button variant="default" size="sm" onClick={onStartSync}>
                <RefreshCw className="mr-1 h-3 w-3" />
                Sync Now
              </Button>
            )}
          </div>
        </div>
        <CardDescription className="flex items-center gap-2">
          <Calendar className="h-3 w-3" />
          {formatLastSync(syncStatus.lastSyncAt)}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Overall Progress (when syncing) */}
        <AnimatePresence>
          {isRunning && overallProgress && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              <div className="flex justify-between text-sm">
                <span>Overall Progress</span>
                <span className="font-medium">{overallPercent}%</span>
              </div>
              <Progress value={overallPercent} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {overallProgress.processed} / {overallProgress.total} items
                </span>
                {overallProgress.failed > 0 && (
                  <span className="text-destructive">{overallProgress.failed} failed</span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Queue Status */}
        <div className="p-3 rounded-lg bg-muted/50">
          <h4 className="text-sm font-medium mb-2">Sync Queue</h4>
          <QueueStatusCard
            queue={syncStatus.queueStatus}
            onRetry={onRetryFailed}
            onClear={onClearFailed}
          />
        </div>

        {/* Entity Details Toggle */}
        <Button
          variant="ghost"
          className="w-full justify-between"
          onClick={() => setShowDetails(!showDetails)}
        >
          <span className="text-sm">Entity Details</span>
          {showDetails ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>

        {/* Entity List */}
        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="divide-y">
                {entityTypes.map((entityType) => {
                  const status = syncStatus.entityStatuses[entityType];
                  const progress = entityProgress?.get(entityType);

                  return (
                    <EntityRow
                      key={entityType}
                      entityType={entityType}
                      progress={progress}
                      lastSyncAt={status?.lastSyncAt}
                      count={status?.count}
                    />
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Export Default
// =============================================================================

export default BullhornSyncProgress;
