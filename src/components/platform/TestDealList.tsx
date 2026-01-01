/**
 * TestDealList
 *
 * Displays a list of deals with health indicators for skill testing.
 */

import { Loader2, Briefcase, Building2, Check, TrendingUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { type TestDeal } from '@/lib/hooks/useTestDeals';
import { getTierColorClasses, type QualityTier } from '@/lib/utils/entityTestTypes';
import { getDealHealthBadgeStyle } from '@/lib/utils/dealQualityScoring';

interface TestDealListProps {
  deals: TestDeal[];
  isLoading: boolean;
  selectedDealId: string | null;
  onSelect: (deal: TestDeal) => void;
  tier: QualityTier;
}

/**
 * Format currency for display
 */
function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export function TestDealList({
  deals,
  isLoading,
  selectedDealId,
  onSelect,
  tier,
}: TestDealListProps) {
  const tierColors = getTierColorClasses(tier);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
          Loading {tier} deals...
        </span>
      </div>
    );
  }

  if (deals.length === 0) {
    return (
      <div className="text-center py-8">
        <Briefcase className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No {tier} deals found in your pipeline.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[280px] overflow-y-auto">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        Select a deal to test with ({deals.length} found)
      </p>
      {deals.map((deal) => {
        const isSelected = selectedDealId === deal.id;
        const healthStyle = getDealHealthBadgeStyle(deal.health_status);

        return (
          <button
            key={deal.id}
            type="button"
            onClick={() => onSelect(deal)}
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
              <Briefcase className="w-5 h-5" />
            </div>

            {/* Deal info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                  {deal.name}
                </span>
                {isSelected && (
                  <Check className={cn('w-4 h-4 shrink-0', tierColors.text)} />
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {deal.company && (
                  <span className="flex items-center gap-1 truncate max-w-[100px]">
                    <Building2 className="w-3 h-3" />
                    {deal.company}
                  </span>
                )}
                {deal.stage_name && (
                  <span className="truncate max-w-[80px]">{deal.stage_name}</span>
                )}
              </div>
            </div>

            {/* Value and health indicators */}
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(deal.value)}
                </span>
                {deal.health_status && (
                  <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', healthStyle.className)}>
                    {deal.health_status}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className={cn('font-medium', tierColors.text)}>
                  {deal.qualityScore.score}/100
                </span>
                {deal.days_in_current_stage != null && (
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />
                    {deal.days_in_current_stage}d
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
