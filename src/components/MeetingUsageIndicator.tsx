/**
 * MeetingUsageBar Component
 * 
 * Shows meeting usage for free tier users as a subtle bar.
 * Displays at the top of the Meetings page.
 */

import { Link } from 'react-router-dom';
import { useOrg } from '@/lib/contexts/OrgContext';
import { useFreeTierUsageStatus } from '@/lib/hooks/useSubscription';
import { cn } from '@/lib/utils';
import { Zap, ArrowRight } from 'lucide-react';

interface MeetingUsageBarProps {
  className?: string;
}

/**
 * Meeting Usage Bar - shows at top of meetings page
 * A subtle, non-intrusive bar showing current usage
 */
export function MeetingUsageBar({ className }: MeetingUsageBarProps) {
  const { activeOrgId } = useOrg();
  const { data: usageStatus, isLoading } = useFreeTierUsageStatus(activeOrgId);

  // Don't show for paid users or while loading
  if (isLoading || !usageStatus || !usageStatus.isFreeTier) {
    return null;
  }

  const { meetingsUsed, meetingsLimit, percentUsed, remainingMeetings } = usageStatus;

  // Determine styling based on usage level
  const getBarStyle = () => {
    if (percentUsed >= 100) {
      return {
        bg: 'bg-red-500/10 border-red-500/20',
        progress: 'bg-red-500',
        text: 'text-red-400',
        accent: 'text-red-500',
      };
    }
    if (percentUsed >= 80) {
      return {
        bg: 'bg-amber-500/10 border-amber-500/20',
        progress: 'bg-amber-500',
        text: 'text-amber-400',
        accent: 'text-amber-500',
      };
    }
    return {
      bg: 'bg-gray-800/30 border-gray-700/30',
      progress: 'bg-emerald-500',
      text: 'text-gray-400',
      accent: 'text-gray-300',
    };
  };

  const style = getBarStyle();
  const showUpgradePrompt = percentUsed >= 80;

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-2.5 rounded-xl border backdrop-blur-sm',
        style.bg,
        className
      )}
    >
      {/* Left side: Usage info */}
      <div className="flex items-center gap-4">
        {/* Mini progress bar */}
        <div className="w-24 h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', style.progress)}
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
          />
        </div>
        
        {/* Usage text */}
        <span className={cn('text-sm', style.text)}>
          <span className={cn('font-semibold', style.accent)}>
            {meetingsUsed}
          </span>
          <span className="mx-1">/</span>
          <span>{meetingsLimit}</span>
          <span className="ml-1.5 hidden sm:inline">meetings used</span>
        </span>

        {/* Remaining badge */}
        {remainingMeetings !== null && remainingMeetings > 0 && (
          <span className="text-xs text-gray-500 hidden md:inline">
            ({remainingMeetings} remaining)
          </span>
        )}
      </div>

      {/* Right side: Upgrade link when needed */}
      {showUpgradePrompt && (
        <Link
          to="/pricing"
          className="flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
        >
          <Zap className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Get unlimited</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

// Keep the old exports for backwards compatibility (if needed elsewhere)
export function MeetingUsageIndicator(props: { compact?: boolean; showUpgradeButton?: boolean; className?: string }) {
  return <MeetingUsageBar className={props.className} />;
}

export function MeetingUsageInline({ className }: { className?: string }) {
  return <MeetingUsageBar className={className} />;
}

export default MeetingUsageBar;
