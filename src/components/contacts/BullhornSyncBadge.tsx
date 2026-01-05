/**
 * Bullhorn Sync Status Badge Component
 *
 * Displays the sync status of a contact with Bullhorn ATS.
 * Shows visual indicators for synced, pending, error, and not linked states.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  Clock,
  XCircle,
  Link2,
  Link2Off,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';

// =============================================================================
// Types
// =============================================================================

export type BullhornSyncStatus = 'synced' | 'pending' | 'error' | 'not_linked' | 'syncing';

export interface BullhornSyncBadgeProps {
  syncStatus: BullhornSyncStatus;
  bullhornId?: number | null;
  bullhornEntityType?: 'Candidate' | 'ClientContact' | null;
  lastSyncedAt?: string | null;
  syncError?: string | null;
  className?: string;
  onClick?: () => void;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

// =============================================================================
// Badge Configuration
// =============================================================================

const getBadgeConfig = (status: BullhornSyncStatus, entityType?: string | null) => {
  const entityLabel = entityType === 'ClientContact' ? 'Client Contact' : 'Candidate';

  switch (status) {
    case 'synced':
      return {
        icon: CheckCircle2,
        label: `Synced to Bullhorn ${entityLabel}`,
        shortLabel: 'Synced',
        variant: 'default' as const,
        className: 'bg-emerald-900/60 text-emerald-300 border-emerald-700/50 hover:bg-emerald-800/60',
      };
    case 'pending':
      return {
        icon: Clock,
        label: 'Pending Sync',
        shortLabel: 'Pending',
        variant: 'secondary' as const,
        className: 'bg-yellow-900/60 text-yellow-300 border-yellow-700/50 hover:bg-yellow-800/60',
      };
    case 'syncing':
      return {
        icon: RefreshCw,
        label: 'Syncing to Bullhorn...',
        shortLabel: 'Syncing',
        variant: 'secondary' as const,
        className: 'bg-blue-900/60 text-blue-300 border-blue-700/50',
      };
    case 'error':
      return {
        icon: XCircle,
        label: 'Sync Error',
        shortLabel: 'Error',
        variant: 'destructive' as const,
        className: 'bg-red-900/60 text-red-300 border-red-700/50 hover:bg-red-800/60',
      };
    case 'not_linked':
      return {
        icon: Link2Off,
        label: 'Not Linked to Bullhorn',
        shortLabel: 'Not Linked',
        variant: 'outline' as const,
        className: 'bg-slate-900/60 text-slate-400 border-slate-700/50 hover:bg-slate-800/60',
      };
    default:
      return {
        icon: AlertTriangle,
        label: 'Unknown Status',
        shortLabel: 'Unknown',
        variant: 'secondary' as const,
        className: '',
      };
  }
};

// =============================================================================
// Component
// =============================================================================

export function BullhornSyncBadge({
  syncStatus,
  bullhornId,
  bullhornEntityType,
  lastSyncedAt,
  syncError,
  className,
  onClick,
  showLabel = true,
  size = 'md',
}: BullhornSyncBadgeProps) {
  const config = getBadgeConfig(syncStatus, bullhornEntityType);
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-0.5',
    lg: 'text-sm px-2.5 py-1',
  };

  const iconSizes = {
    sm: 'h-2.5 w-2.5',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  };

  const formatLastSync = (date: string | null | undefined) => {
    if (!date) return null;
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return null;
    }
  };

  const tooltipContent = (
    <div className="space-y-1 text-xs">
      <div className="font-medium">{config.label}</div>
      {bullhornId && (
        <div className="text-slate-400">
          Bullhorn ID: {bullhornId}
        </div>
      )}
      {lastSyncedAt && (
        <div className="text-slate-400">
          Last synced: {formatLastSync(lastSyncedAt)}
        </div>
      )}
      {syncError && (
        <div className="text-red-400 max-w-48">
          Error: {syncError}
        </div>
      )}
      {onClick && (
        <div className="text-blue-400 mt-1">Click to manage sync</div>
      )}
    </div>
  );

  const badge = (
    <Badge
      variant={config.variant}
      className={cn(
        'flex items-center gap-1 transition-all duration-200',
        sizeClasses[size],
        config.className,
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      <Icon
        className={cn(
          iconSizes[size],
          syncStatus === 'syncing' && 'animate-spin'
        )}
      />
      {showLabel && (
        <span className="font-medium">{config.shortLabel}</span>
      )}
      {syncStatus === 'synced' && bullhornId && (
        <ExternalLink className={cn(iconSizes[size], 'ml-0.5 opacity-60')} />
      )}
      {syncStatus === 'synced' && (
        <Link2 className={cn(iconSizes[size], 'ml-0.5 opacity-60')} />
      )}
    </Badge>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="bg-slate-800 border-slate-700">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// =============================================================================
// Compact Version for Tables/Lists
// =============================================================================

export function BullhornSyncIcon({
  syncStatus,
  bullhornId,
  className,
  onClick,
}: Pick<BullhornSyncBadgeProps, 'syncStatus' | 'bullhornId' | 'className' | 'onClick'>) {
  const config = getBadgeConfig(syncStatus);
  const Icon = config.icon;

  const iconColors = {
    synced: 'text-emerald-400',
    pending: 'text-yellow-400',
    syncing: 'text-blue-400',
    error: 'text-red-400',
    not_linked: 'text-slate-500',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              'p-1 rounded hover:bg-slate-800/50 transition-colors',
              onClick && 'cursor-pointer',
              className
            )}
          >
            <Icon
              className={cn(
                'h-4 w-4',
                iconColors[syncStatus],
                syncStatus === 'syncing' && 'animate-spin'
              )}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-slate-800 border-slate-700">
          <div className="text-xs">
            <div className="font-medium">{config.label}</div>
            {bullhornId && (
              <div className="text-slate-400">ID: {bullhornId}</div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// =============================================================================
// Helper to derive sync status from contact metadata
// =============================================================================

export function deriveBullhornSyncStatus(contact: {
  metadata?: Record<string, unknown> | null;
  external_id?: string | null;
}): {
  status: BullhornSyncStatus;
  bullhornId?: number;
  bullhornEntityType?: 'Candidate' | 'ClientContact';
  lastSyncedAt?: string;
  syncError?: string;
} {
  const metadata = contact.metadata as Record<string, unknown> | null;

  // Check if contact has Bullhorn mapping
  if (!metadata?.bullhorn_id && !contact.external_id?.startsWith('bullhorn_')) {
    return { status: 'not_linked' };
  }

  // Check for sync error
  if (metadata?.bullhorn_sync_error) {
    return {
      status: 'error',
      bullhornId: metadata.bullhorn_id as number | undefined,
      bullhornEntityType: metadata.bullhorn_type as 'Candidate' | 'ClientContact' | undefined,
      syncError: metadata.bullhorn_sync_error as string,
    };
  }

  // Check if deleted in Bullhorn
  if (metadata?.bullhorn_deleted) {
    return {
      status: 'error',
      bullhornId: metadata.bullhorn_id as number | undefined,
      bullhornEntityType: metadata.bullhorn_type as 'Candidate' | 'ClientContact' | undefined,
      syncError: 'Deleted in Bullhorn',
    };
  }

  // Check for pending sync
  if (metadata?.bullhorn_sync_pending) {
    return {
      status: 'pending',
      bullhornId: metadata.bullhorn_id as number | undefined,
      bullhornEntityType: metadata.bullhorn_type as 'Candidate' | 'ClientContact' | undefined,
    };
  }

  // Successfully synced
  return {
    status: 'synced',
    bullhornId: metadata?.bullhorn_id as number | undefined,
    bullhornEntityType: metadata?.bullhorn_type as 'Candidate' | 'ClientContact' | undefined,
    lastSyncedAt: metadata?.synced_at as string | undefined,
  };
}

export default BullhornSyncBadge;
