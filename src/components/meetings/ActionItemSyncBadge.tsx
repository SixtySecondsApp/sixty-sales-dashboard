/**
 * Action Item Sync Status Badge Component
 *
 * Displays the sync status of a meeting action item with visual indicators
 * for pending, synced, failed, and excluded states.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, XCircle, Ban, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActionItemSyncBadgeProps {
  syncStatus: 'pending' | 'synced' | 'failed' | 'excluded';
  syncedToTask: boolean;
  taskId?: string | null;
  syncError?: string | null;
  className?: string;
  onClick?: () => void;
}

export function ActionItemSyncBadge({
  syncStatus,
  syncedToTask,
  taskId,
  syncError,
  className,
  onClick
}: ActionItemSyncBadgeProps) {
  const getBadgeConfig = () => {
    switch (syncStatus) {
      case 'synced':
        return {
          icon: CheckCircle2,
          label: 'Synced to Tasks',
          variant: 'default' as const,
          className: 'bg-emerald-900/60 text-emerald-300 border-emerald-700/50 hover:bg-emerald-800/60'
        };
      case 'pending':
        return {
          icon: Clock,
          label: 'Pending Sync',
          variant: 'secondary' as const,
          className: 'bg-yellow-900/60 text-yellow-300 border-yellow-700/50 hover:bg-yellow-800/60'
        };
      case 'failed':
        return {
          icon: XCircle,
          label: 'Sync Failed',
          variant: 'destructive' as const,
          className: 'bg-red-900/60 text-red-300 border-red-700/50 hover:bg-red-800/60'
        };
      case 'excluded':
        return {
          icon: Ban,
          label: 'External Assignee',
          variant: 'outline' as const,
          className: 'bg-gray-900/60 text-gray-400 border-gray-700/50 hover:bg-gray-800/60'
        };
      default:
        return {
          icon: Clock,
          label: 'Unknown',
          variant: 'secondary' as const,
          className: ''
        };
    }
  };

  const config = getBadgeConfig();
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn(
        'flex items-center gap-1.5 cursor-pointer transition-all duration-200',
        config.className,
        className
      )}
      onClick={onClick}
      title={syncError || config.label}
    >
      <Icon className="h-3 w-3" />
      <span className="text-xs font-medium">{config.label}</span>
      {taskId && (
        <Link2 className="h-3 w-3 ml-0.5" />
      )}
    </Badge>
  );
}

export default ActionItemSyncBadge;
