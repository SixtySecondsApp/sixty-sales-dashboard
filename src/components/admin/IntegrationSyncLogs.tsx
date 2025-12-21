/**
 * IntegrationSyncLogs
 *
 * Displays real-time integration sync activity logs.
 * Shows item-by-item sync operations with filtering and live updates.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  RefreshCw,
  Radio,
  CircleOff,
  ChevronDown,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  ArrowDownRight,
  ArrowUpRight,
  Video,
  Mail,
  MessageSquare,
  Users,
  Calendar,
  CalendarCheck,
  CheckSquare,
  Filter,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  useIntegrationSyncLogs,
  type IntegrationSyncLog,
  type IntegrationName,
  type SyncStatus,
  type SyncLogFilters,
  INTEGRATION_DISPLAY,
  STATUS_DISPLAY,
  OPERATION_DISPLAY,
} from '@/lib/hooks/useIntegrationSyncLogs';

// Icon mapping for integrations
const integrationIcons: Record<IntegrationName, React.ElementType> = {
  hubspot: Users,
  fathom: Video,
  google_calendar: Calendar,
  google_tasks: CheckSquare,
  savvycal: CalendarCheck,
  slack: MessageSquare,
};

// Status icons
const statusIcons: Record<SyncStatus, React.ElementType> = {
  pending: Clock,
  success: CheckCircle,
  failed: XCircle,
  skipped: AlertTriangle,
};

// Format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 5) return 'just now';
  if (diffSecs < 60) return `${diffSecs}s ago`;

  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

interface LogEntryProps {
  log: IntegrationSyncLog;
}

function LogEntry({ log }: LogEntryProps) {
  const [expanded, setExpanded] = useState(false);

  const IntegrationIcon = integrationIcons[log.integration_name] || Mail;
  const StatusIcon = statusIcons[log.status];
  const integrationMeta = INTEGRATION_DISPLAY[log.integration_name];
  const statusMeta = STATUS_DISPLAY[log.status];
  const operationMeta = OPERATION_DISPLAY[log.operation];

  // Build display text
  const entityDisplay = log.entity_name || log.entity_id || 'Unknown';
  const entityTypeDisplay = log.entity_type.replace(/_/g, ' ');

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'group border-b border-gray-100 dark:border-gray-800',
        'hover:bg-gray-50 dark:hover:bg-gray-800/50',
        'transition-colors'
      )}
    >
      <div className="p-3 flex items-start gap-3">
        {/* Integration Icon */}
        <div
          className={cn(
            'p-2 rounded-lg flex-shrink-0',
            log.status === 'failed'
              ? 'bg-red-100 dark:bg-red-900/30'
              : 'bg-gray-100 dark:bg-gray-800'
          )}
        >
          <IntegrationIcon
            className={cn(
              'w-4 h-4',
              log.status === 'failed'
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-500 dark:text-gray-400'
            )}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {/* Operation + Entity Type */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs font-medium',
                    statusMeta.bgClass,
                    statusMeta.textClass,
                    'border-transparent'
                  )}
                >
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {operationMeta.label}
                </Badge>

                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {entityTypeDisplay}
                </span>

                {/* Direction indicator */}
                {log.direction && (
                  <span
                    className={cn(
                      'inline-flex items-center text-xs',
                      log.direction === 'inbound'
                        ? 'text-blue-500'
                        : 'text-purple-500'
                    )}
                    title={
                      log.direction === 'inbound'
                        ? 'Inbound (from external system)'
                        : 'Outbound (to external system)'
                    }
                  >
                    {log.direction === 'inbound' ? (
                      <ArrowDownRight className="w-3 h-3" />
                    ) : (
                      <ArrowUpRight className="w-3 h-3" />
                    )}
                  </span>
                )}
              </div>

              {/* Entity Name */}
              <p
                className={cn(
                  'mt-1 text-sm font-medium truncate',
                  log.status === 'failed'
                    ? 'text-red-700 dark:text-red-400'
                    : 'text-gray-900 dark:text-gray-100'
                )}
                title={entityDisplay}
              >
                {entityDisplay}
              </p>

              {/* Error message preview */}
              {log.error_message && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400 truncate">
                  {log.error_message}
                </p>
              )}
            </div>

            {/* Timestamp and Integration */}
            <div className="flex-shrink-0 text-right">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {formatRelativeTime(log.created_at)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {integrationMeta.label}
              </p>
            </div>
          </div>

          {/* Expandable details */}
          {(log.error_message || Object.keys(log.metadata).length > 0) && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <ChevronDown
                className={cn(
                  'w-3 h-3 transition-transform',
                  expanded && 'rotate-180'
                )}
              />
              {expanded ? 'Hide details' : 'Show details'}
            </button>
          )}

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded text-xs space-y-2">
                  {log.error_message && (
                    <div>
                      <span className="font-medium text-red-600 dark:text-red-400">
                        Error:
                      </span>
                      <p className="text-red-600 dark:text-red-400 mt-0.5">
                        {log.error_message}
                      </p>
                    </div>
                  )}
                  {log.entity_id && (
                    <div>
                      <span className="font-medium text-gray-600 dark:text-gray-400">
                        Entity ID:
                      </span>{' '}
                      <span className="text-gray-700 dark:text-gray-300 font-mono">
                        {log.entity_id}
                      </span>
                    </div>
                  )}
                  {Object.keys(log.metadata).length > 0 && (
                    <div>
                      <span className="font-medium text-gray-600 dark:text-gray-400">
                        Metadata:
                      </span>
                      <pre className="mt-1 text-gray-600 dark:text-gray-400 overflow-x-auto">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                  <div className="text-gray-500">
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

export default function IntegrationSyncLogs() {
  // Filter state
  const [filters, setFilters] = useState<SyncLogFilters>({
    integration: 'all',
    status: 'all',
    timeRange: 'day',
  });

  const {
    logs,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    isLive,
    newLogsCount,
    loadMore,
    refresh,
    setIsLive,
    clearNewLogs,
  } = useIntegrationSyncLogs({ filters });

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.integration && filters.integration !== 'all') count++;
    if (filters.status && filters.status !== 'all') count++;
    if (filters.timeRange && filters.timeRange !== 'all') count++;
    return count;
  }, [filters]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({
      integration: 'all',
      status: 'all',
      timeRange: 'day',
    });
  }, []);

  return (
    <div className="space-y-4">
      {/* Header with Live Toggle and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Live toggle and refresh */}
        <div className="flex items-center gap-2">
          <Button
            variant={isLive ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsLive(!isLive)}
            className={cn(
              isLive && 'bg-emerald-600 hover:bg-emerald-700'
            )}
          >
            {isLive ? (
              <>
                <Radio className="w-4 h-4 mr-2 animate-pulse" />
                Live
              </>
            ) : (
              <>
                <CircleOff className="w-4 h-4 mr-2" />
                Paused
              </>
            )}
          </Button>

          {!isLive && newLogsCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearNewLogs}
              className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
            >
              {newLogsCount} new log{newLogsCount > 1 ? 's' : ''}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isLoading}
          >
            <RefreshCw
              className={cn('w-4 h-4', isLoading && 'animate-spin')}
            />
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Integration Filter */}
          <Select
            value={filters.integration || 'all'}
            onValueChange={(value) =>
              setFilters((f) => ({
                ...f,
                integration: value as IntegrationName | 'all',
              }))
            }
          >
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="Integration" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Integrations</SelectItem>
              <SelectItem value="hubspot">HubSpot</SelectItem>
              <SelectItem value="fathom">Fathom</SelectItem>
              <SelectItem value="google_calendar">Google Calendar</SelectItem>
              <SelectItem value="google_tasks">Google Tasks</SelectItem>
              <SelectItem value="savvycal">SavvyCal</SelectItem>
              <SelectItem value="slack">Slack</SelectItem>
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select
            value={filters.status || 'all'}
            onValueChange={(value) =>
              setFilters((f) => ({
                ...f,
                status: value as SyncStatus | 'all',
              }))
            }
          >
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="skipped">Skipped</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>

          {/* Time Range Filter */}
          <Select
            value={filters.timeRange || 'all'}
            onValueChange={(value) =>
              setFilters((f) => ({
                ...f,
                timeRange: value as SyncLogFilters['timeRange'],
              }))
            }
          >
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue placeholder="Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hour">Last Hour</SelectItem>
              <SelectItem value="day">Last 24h</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>

          {/* Clear Filters */}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9"
            >
              <X className="w-4 h-4 mr-1" />
              Clear ({activeFilterCount})
            </Button>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-400">
            Failed to load logs: {error.message}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* Logs List */}
      {!isLoading && !error && (
        <div
          className={cn(
            'bg-white dark:bg-gray-900/80 backdrop-blur-sm',
            'border border-gray-200 dark:border-gray-700/50 rounded-xl',
            'shadow-sm dark:shadow-none overflow-hidden'
          )}
        >
          {logs.length === 0 ? (
            <div className="p-8 text-center">
              <Filter className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                No sync logs found
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                {activeFilterCount > 0
                  ? 'Try adjusting your filters'
                  : 'Sync activity will appear here when integrations run'}
              </p>
            </div>
          ) : (
            <>
              <div className="max-h-[600px] overflow-y-auto">
                <AnimatePresence mode="popLayout">
                  {logs.map((log) => (
                    <LogEntry key={log.id} log={log} />
                  ))}
                </AnimatePresence>
              </div>

              {/* Load More */}
              {hasMore && (
                <div className="p-3 border-t border-gray-100 dark:border-gray-800">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="w-full"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load More'
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Log count */}
      {!isLoading && logs.length > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          Showing {logs.length} log{logs.length > 1 ? 's' : ''}
          {hasMore && ' (scroll for more)'}
        </p>
      )}
    </div>
  );
}
