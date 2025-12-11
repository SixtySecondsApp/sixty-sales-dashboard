/**
 * MeetingUsageIndicator Component
 * 
 * Shows "X of 15 meetings used" for free tier users.
 * Displays in the sidebar or header to keep users informed.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrg } from '@/lib/contexts/OrgContext';
import { useFreeTierUsageStatus } from '@/lib/hooks/useSubscription';
import { cn } from '@/lib/utils';
import { AlertCircle, TrendingUp, Zap } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface MeetingUsageIndicatorProps {
  /** Compact mode for sidebar */
  compact?: boolean;
  /** Show upgrade button */
  showUpgradeButton?: boolean;
  /** Additional class names */
  className?: string;
}

export function MeetingUsageIndicator({
  compact = false,
  showUpgradeButton = true,
  className,
}: MeetingUsageIndicatorProps) {
  const navigate = useNavigate();
  const { activeOrgId } = useOrg();
  const { data: usageStatus, isLoading } = useFreeTierUsageStatus(activeOrgId);

  // Don't show for paid users or while loading
  if (isLoading || !usageStatus || !usageStatus.isFreeTier) {
    return null;
  }

  const { meetingsUsed, meetingsLimit, percentUsed, shouldShowUpgradePrompt, remainingMeetings } = usageStatus;

  // Determine color based on usage
  const getColor = () => {
    if (percentUsed >= 100) return 'text-red-500';
    if (percentUsed >= 80) return 'text-amber-500';
    if (percentUsed >= 60) return 'text-yellow-500';
    return 'text-emerald-500';
  };

  const getProgressColor = () => {
    if (percentUsed >= 100) return 'bg-red-500';
    if (percentUsed >= 80) return 'bg-amber-500';
    if (percentUsed >= 60) return 'bg-yellow-500';
    return 'bg-emerald-500';
  };

  const handleUpgradeClick = () => {
    navigate('/pricing');
  };

  // Compact mode for sidebar
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                shouldShowUpgradePrompt 
                  ? 'bg-amber-500/10 hover:bg-amber-500/20' 
                  : 'bg-gray-800/50 hover:bg-gray-800',
                className
              )}
              onClick={handleUpgradeClick}
            >
              {shouldShowUpgradePrompt ? (
                <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
              ) : (
                <TrendingUp className={cn('h-4 w-4 flex-shrink-0', getColor())} />
              )}
              <span className={cn('text-sm font-medium', getColor())}>
                {meetingsUsed}/{meetingsLimit}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-[200px]">
            <div className="space-y-2">
              <p className="font-semibold">
                {meetingsUsed} of {meetingsLimit} meetings used
              </p>
              <Progress 
                value={Math.min(percentUsed, 100)} 
                className="h-2"
              />
              <p className="text-xs text-gray-400">
                {remainingMeetings && remainingMeetings > 0 
                  ? `${remainingMeetings} meetings remaining`
                  : 'Upgrade for unlimited meetings'}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full mode with progress bar
  return (
    <div
      className={cn(
        'rounded-lg border p-4 space-y-3',
        shouldShowUpgradePrompt
          ? 'border-amber-500/30 bg-amber-500/5'
          : 'border-gray-700 bg-gray-800/30',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {shouldShowUpgradePrompt ? (
            <AlertCircle className="h-5 w-5 text-amber-500" />
          ) : (
            <TrendingUp className={cn('h-5 w-5', getColor())} />
          )}
          <span className="font-medium text-sm text-gray-200">
            Meeting Usage
          </span>
        </div>
        <span className={cn('text-sm font-bold', getColor())}>
          {meetingsUsed} / {meetingsLimit}
        </span>
      </div>

      <div className="space-y-1">
        <Progress 
          value={Math.min(percentUsed, 100)} 
          className="h-2"
        />
        <p className="text-xs text-gray-400">
          {remainingMeetings && remainingMeetings > 0 
            ? `${remainingMeetings} meeting${remainingMeetings !== 1 ? 's' : ''} remaining this month`
            : 'You\'ve reached your free tier limit'}
        </p>
      </div>

      {shouldShowUpgradePrompt && showUpgradeButton && (
        <Button
          size="sm"
          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
          onClick={handleUpgradeClick}
        >
          <Zap className="h-4 w-4 mr-2" />
          Upgrade for Unlimited
        </Button>
      )}
    </div>
  );
}

/**
 * Inline version for headers/nav
 */
export function MeetingUsageInline({ className }: { className?: string }) {
  const { activeOrgId } = useOrg();
  const { data: usageStatus, isLoading } = useFreeTierUsageStatus(activeOrgId);
  const navigate = useNavigate();

  if (isLoading || !usageStatus || !usageStatus.isFreeTier) {
    return null;
  }

  const { meetingsUsed, meetingsLimit, percentUsed, shouldShowUpgradePrompt } = usageStatus;

  const getColor = () => {
    if (percentUsed >= 100) return 'text-red-400';
    if (percentUsed >= 80) return 'text-amber-400';
    return 'text-gray-400';
  };

  return (
    <button
      onClick={() => navigate('/pricing')}
      className={cn(
        'flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors',
        shouldShowUpgradePrompt 
          ? 'bg-amber-500/10 hover:bg-amber-500/20' 
          : 'hover:bg-gray-800',
        className
      )}
    >
      <span className={getColor()}>
        {meetingsUsed}/{meetingsLimit} meetings
      </span>
      {shouldShowUpgradePrompt && (
        <Zap className="h-3 w-3 text-amber-400" />
      )}
    </button>
  );
}

export default MeetingUsageIndicator;
