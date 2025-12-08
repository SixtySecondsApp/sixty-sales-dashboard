// src/components/subscription/UpgradeGate.tsx
// Component to show upgrade prompts when users hit free tier limits

import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  AlertCircle,
  Zap,
  ArrowRight,
  X,
  Clock,
  Gift,
} from 'lucide-react';
import { useOrg } from '@/lib/contexts/OrgContext';
import { useFreeTierUsageStatus } from '@/lib/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface UpgradeGateProps {
  /** Action being gated (for messaging) */
  action?: 'create_meeting' | 'add_user' | 'generic';
  /** Variant for display style */
  variant?: 'inline' | 'banner' | 'modal';
  /** Whether the modal is open (for modal variant) */
  isOpen?: boolean;
  /** Callback when modal is closed */
  onClose?: () => void;
  /** Custom message to display */
  message?: string;
  /** Children to render when not at limit */
  children?: React.ReactNode;
  /** Show even if not at limit (for preview/testing) */
  forceShow?: boolean;
  /** Callback when user dismisses (for tracking) */
  onDismiss?: () => void;
}

/**
 * UpgradeGate - Shows upgrade prompts when users approach or hit free tier limits
 *
 * Usage:
 * - Inline: Renders inline usage indicator with upgrade CTA
 * - Banner: Renders a dismissible banner at the top of a section
 * - Modal: Shows a modal dialog when limit is reached
 */
export function UpgradeGate({
  action = 'generic',
  variant = 'inline',
  isOpen,
  onClose,
  message,
  children,
  forceShow = false,
  onDismiss,
}: UpgradeGateProps) {
  const { activeOrgId } = useOrg();
  const { data: usageStatus, isLoading } = useFreeTierUsageStatus(activeOrgId);
  const [dismissed, setDismissed] = React.useState(false);

  // Don't show anything while loading
  if (isLoading || !usageStatus) {
    return children ? <>{children}</> : null;
  }

  // Don't show if not on free tier (unless forced)
  if (!usageStatus.isFreeTier && !forceShow) {
    return children ? <>{children}</> : null;
  }

  // Don't show if not approaching limit (unless forced)
  if (!usageStatus.shouldShowUpgradePrompt && !forceShow) {
    return children ? <>{children}</> : null;
  }

  // Don't show if dismissed (for banner variant)
  if (dismissed && variant === 'banner') {
    return children ? <>{children}</> : null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const isAtLimit = usageStatus.remainingMeetings !== null && usageStatus.remainingMeetings <= 0;
  const isNearLimit = usageStatus.percentUsed >= 80 && !isAtLimit;
  // Check if this is a total limit (free tier) vs per-month limit (paid tier)
  const isTotalLimit = usageStatus.isTotalLimit ?? usageStatus.isFreeTier;
  const limitTypeText = isTotalLimit ? 'total' : 'monthly';

  // Get contextual message
  const getActionMessage = () => {
    if (message) return message;

    if (isAtLimit) {
      switch (action) {
        case 'create_meeting':
          return `You've reached your ${isTotalLimit ? 'free' : ''} meeting limit. Upgrade to continue recording meetings.`;
        case 'add_user':
          return "You've reached your user limit. Upgrade to add more team members.";
        default:
          return `You've reached your ${isTotalLimit ? 'free tier' : 'meeting'} limit. Upgrade to unlock more features.`;
      }
    }

    return `You've used ${usageStatus.percentUsed}% of your ${limitTypeText} meetings. Upgrade for unlimited access.`;
  };

  // Inline variant - simple progress bar with upgrade link
  if (variant === 'inline') {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            'p-2 rounded-lg',
            isAtLimit ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
          )}>
            {isAtLimit ? <AlertCircle className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {isAtLimit ? 'Meeting Limit Reached' : 'Approaching Limit'}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {getActionMessage()}
            </p>

            {/* Progress bar */}
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>
                  {usageStatus.meetingsUsed} / {usageStatus.meetingsLimit} {isTotalLimit ? 'total' : 'monthly'} meetings used
                </span>
                <span>{usageStatus.percentUsed}%</span>
              </div>
              <Progress
                value={usageStatus.percentUsed}
                className={cn(
                  'h-2',
                  isAtLimit ? '[&>div]:bg-red-500' : '[&>div]:bg-amber-500'
                )}
              />
            </div>

            <Link to="/pricing" className="mt-3 inline-block">
              <Button
                size="sm"
                className="bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700"
              >
                <Zap className="w-4 h-4 mr-1" />
                Upgrade Now
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Banner variant - dismissible top banner
  if (variant === 'banner') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={cn(
          'relative rounded-lg border px-4 py-3 mb-4',
          isAtLimit
            ? 'border-red-500/30 bg-red-500/10'
            : 'border-amber-500/30 bg-amber-500/10'
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-1.5 rounded-lg',
              isAtLimit ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
            )}>
              {isAtLimit ? <AlertCircle className="w-4 h-4" /> : <Gift className="w-4 h-4" />}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {isAtLimit
                  ? 'Free tier limit reached'
                  : `${usageStatus.remainingMeetings} ${isTotalLimit ? 'free' : 'monthly'} meetings remaining`
                }
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {isAtLimit
                  ? 'Upgrade to continue using all features'
                  : 'Upgrade for unlimited meetings'
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/pricing">
              <Button size="sm" variant="outline" className="text-xs">
                View Plans
              </Button>
            </Link>
            <button
              onClick={handleDismiss}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Modal variant - full upgrade modal
  if (variant === 'modal') {
    return (
      <Dialog open={isOpen ?? isAtLimit} onOpenChange={(open) => !open && onClose?.()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-amber-400" />
            </div>
            <DialogTitle className="text-center">
              {isAtLimit ? 'Meeting Limit Reached' : 'Upgrade Your Plan'}
            </DialogTitle>
            <DialogDescription className="text-center">
              {getActionMessage()}
            </DialogDescription>
          </DialogHeader>

          {/* Usage stats */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 my-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600 dark:text-gray-400">
                {isTotalLimit ? 'Total meetings used' : 'Meetings this month'}
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {usageStatus.meetingsUsed} / {usageStatus.meetingsLimit}
              </span>
            </div>
            <Progress
              value={usageStatus.percentUsed}
              className={cn('h-2', isAtLimit ? '[&>div]:bg-red-500' : '[&>div]:bg-amber-500')}
            />
            {usageStatus.remainingMeetings !== null && usageStatus.remainingMeetings > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {usageStatus.remainingMeetings} {isTotalLimit ? 'free' : 'monthly'} meetings remaining
              </p>
            )}
          </div>

          {/* Benefits list */}
          <div className="space-y-2 mb-4">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Upgrade benefits:
            </p>
            <ul className="space-y-1.5">
              {[
                'Unlimited meetings per month',
                'Longer data retention',
                'Advanced AI analytics',
                'Team collaboration features',
              ].map((benefit) => (
                <li key={benefit} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Zap className="w-4 h-4 text-blue-500" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <Link to="/pricing" className="w-full">
              <Button className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700">
                <Zap className="w-4 h-4 mr-2" />
                View Upgrade Options
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            {onClose && (
              <Button variant="ghost" onClick={onClose} className="w-full">
                Maybe Later
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return children ? <>{children}</> : null;
}

/**
 * Hook to check if action should be gated
 */
export function useUpgradeGate() {
  const { activeOrgId } = useOrg();
  const { data: usageStatus } = useFreeTierUsageStatus(activeOrgId);

  const shouldShowGate = usageStatus?.isFreeTier && usageStatus?.shouldShowUpgradePrompt;
  const isAtLimit = usageStatus?.remainingMeetings !== null && (usageStatus?.remainingMeetings ?? 1) <= 0;

  return {
    isFreeTier: usageStatus?.isFreeTier ?? false,
    shouldShowGate: shouldShowGate ?? false,
    isAtLimit: isAtLimit ?? false,
    percentUsed: usageStatus?.percentUsed ?? 0,
    remainingMeetings: usageStatus?.remainingMeetings ?? null,
  };
}

export default UpgradeGate;
