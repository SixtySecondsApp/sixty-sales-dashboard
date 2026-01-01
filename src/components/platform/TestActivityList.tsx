/**
 * TestActivityList
 *
 * Displays a list of activities with type and status indicators for skill testing.
 */

import { Loader2, Calendar, Check, DollarSign, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { type TestActivity } from '@/lib/hooks/useTestActivities';
import { getTierColorClasses, type QualityTier } from '@/lib/utils/entityTestTypes';
import {
  getActivityTypeBadgeStyle,
  getActivityStatusBadgeStyle,
  formatActivityType,
} from '@/lib/utils/activityQualityScoring';

interface TestActivityListProps {
  activities: TestActivity[];
  isLoading: boolean;
  selectedActivityId: string | null;
  onSelect: (activity: TestActivity) => void;
  tier: QualityTier;
}

/**
 * Format currency for display
 */
function formatCurrency(value: number | null): string {
  if (!value || value === 0) return '';
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

/**
 * Format date for display
 */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function TestActivityList({
  activities,
  isLoading,
  selectedActivityId,
  onSelect,
  tier,
}: TestActivityListProps) {
  const tierColors = getTierColorClasses(tier);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
          Loading {tier} activities...
        </span>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <Calendar className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No {tier} activities found in your records.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[280px] overflow-y-auto">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        Select an activity to test with ({activities.length} found)
      </p>
      {activities.map((activity) => {
        const isSelected = selectedActivityId === activity.id;
        const typeStyle = getActivityTypeBadgeStyle(activity.type);
        const statusStyle = getActivityStatusBadgeStyle(activity.status);

        return (
          <button
            key={activity.id}
            type="button"
            onClick={() => onSelect(activity)}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all',
              'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500',
              isSelected
                ? `${tierColors.border} ${tierColors.bg}`
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800/50'
            )}
          >
            {/* Icon with tier color */}
            <div
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                tierColors.bg,
                tierColors.text
              )}
            >
              <Calendar className="w-5 h-5" />
            </div>

            {/* Activity info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                  {activity.client_name}
                </span>
                {isSelected && (
                  <Check className={cn('w-4 h-4 shrink-0', tierColors.text)} />
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                <span className="truncate max-w-[120px]">
                  {activity.details || formatActivityType(activity.type)}
                </span>
                {activity.date && (
                  <span className="shrink-0">{formatDate(activity.date)}</span>
                )}
              </div>
            </div>

            {/* Type, status, and amount */}
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <div className="flex items-center gap-1.5">
                <Badge
                  variant={typeStyle.variant}
                  className={cn('text-[10px] px-1.5 py-0', typeStyle.className)}
                >
                  {formatActivityType(activity.type)}
                </Badge>
                <Badge variant="outline" className={cn('text-[10px] px-1 py-0', statusStyle.className)}>
                  {statusStyle.label}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className={cn('font-medium', tierColors.text)}>
                  {activity.qualityScore.score}/100
                </span>
                {activity.amount && activity.amount > 0 && (
                  <span className="flex items-center gap-0.5 font-medium text-gray-600 dark:text-gray-300">
                    <DollarSign className="w-3 h-3" />
                    {formatCurrency(activity.amount).replace('$', '')}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
