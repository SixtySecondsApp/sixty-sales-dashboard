// src/components/subscription/TrialBadge.tsx
// Compact badge showing trial status for navigation/header use

import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTrialStatus } from '../../lib/hooks/useSubscription';
import { useOrg } from '@/lib/contexts/OrgContext';

interface TrialBadgeProps {
  showUpgradeLink?: boolean;
  className?: string;
}

export function TrialBadge({ showUpgradeLink = true, className = '' }: TrialBadgeProps) {
  const { activeOrgId: organizationId } = useOrg();
  const trialStatus = useTrialStatus(organizationId);

  // Don't show anything if not on trial
  if (!trialStatus.isTrialing || trialStatus.isLoading) {
    return null;
  }

  const isUrgent = trialStatus.daysRemaining <= 3;
  const isExpiringSoon = trialStatus.daysRemaining <= 7;

  const badge = (
    <div
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        ${isUrgent
          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
          : isExpiringSoon
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
        }
        ${className}
      `}
    >
      {isUrgent ? (
        <AlertTriangle className="w-3 h-3" />
      ) : (
        <Clock className="w-3 h-3" />
      )}
      <span>
        {trialStatus.daysRemaining} day{trialStatus.daysRemaining !== 1 ? 's' : ''} left
      </span>
    </div>
  );

  if (showUpgradeLink) {
    return (
      <Link to="/team/billing" className="hover:opacity-80 transition-opacity">
        {badge}
      </Link>
    );
  }

  return badge;
}

export default TrialBadge;
