// src/components/subscription/TrialBanner.tsx
// Full-width banner for trial notifications

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, AlertTriangle, CreditCard, ArrowRight, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTrialStatus, useCreatePortalSession } from '../../lib/hooks/useSubscription';
import { useOrg } from '@/lib/contexts/OrgContext';

interface TrialBannerProps {
  dismissible?: boolean;
  storageKey?: string;
}

export function TrialBanner({
  dismissible = true,
  storageKey = 'trial-banner-dismissed',
}: TrialBannerProps) {
  const { activeOrgId: organizationId } = useOrg();
  const realTrialStatus = useTrialStatus(organizationId);
  const createPortalSession = useCreatePortalSession();

  // Check for simulation data
  const simulationData = React.useMemo(() => {
    try {
      const data = sessionStorage.getItem('trial_simulation');
      if (data) {
        const parsed = JSON.parse(data);
        // Only use if less than 5 minutes old
        if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
          return parsed;
        }
      }
    } catch {
      // Ignore errors
    }
    return null;
  }, []);

  // Use simulation data if available, otherwise use real data
  const trialStatus = simulationData?.trialStatus || realTrialStatus;

  // Check if banner was dismissed (but ignore dismissal in preview mode)
  const [isDismissed, setIsDismissed] = useState(() => {
    if (!dismissible || simulationData) return false; // Never dismissed in preview mode
    try {
      const dismissed = localStorage.getItem(storageKey);
      if (!dismissed) return false;
      // Allow showing again after 24 hours
      const dismissedAt = parseInt(dismissed, 10);
      return Date.now() - dismissedAt < 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  });

  const handleDismiss = () => {
    setIsDismissed(true);
    // Don't persist dismissal in preview mode
    if (!simulationData) {
      try {
        localStorage.setItem(storageKey, Date.now().toString());
      } catch {
        // Ignore storage errors
      }
    }
  };

  const handleAddPayment = async () => {
    if (!organizationId) return;
    await createPortalSession.mutateAsync({
      org_id: organizationId,
      return_url: window.location.href,
    });
  };

  // Don't show if not on trial or loading
  if (!trialStatus.isTrialing || trialStatus.isLoading || isDismissed) {
    return null;
  }

  const isUrgent = trialStatus.daysRemaining <= 3;
  const isExpiringSoon = trialStatus.daysRemaining <= 7;
  const needsPayment = !trialStatus.hasPaymentMethod;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className={`
          fixed top-[65px] left-0 right-0 z-30
          lg:top-[65px] lg:left-[256px]
          ${isUrgent
            ? 'bg-red-500/10 border-b border-red-500/20'
            : isExpiringSoon
              ? 'bg-amber-500/10 border-b border-amber-500/20'
              : 'bg-blue-500/10 border-b border-blue-500/20'
          }
          backdrop-blur-sm
        `}
      >
        <div className="px-3 py-2 sm:px-4 sm:py-2.5 lg:px-6 lg:py-3 pb-3">
          <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
            {/* Left: Status info */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {simulationData && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 flex-shrink-0">
                  <Eye className="w-3 h-3" />
                  <span className="hidden sm:inline">Preview</span>
                  <span className="font-medium">Day {simulationData.day}</span>
                </span>
              )}

              {isUrgent ? (
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-400" />
              ) : (
                <Clock className="w-4 h-4 flex-shrink-0 text-blue-400" />
              )}

              <span className={`truncate ${
                isUrgent ? 'text-red-300' : isExpiringSoon ? 'text-amber-300' : 'text-blue-300'
              }`}>
                <span className="font-medium">{trialStatus.daysRemaining} days</span>
                <span className="hidden sm:inline"> left in trial</span>
              </span>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {needsPayment && (
                <button
                  onClick={handleAddPayment}
                  disabled={createPortalSession.isPending}
                  className={`
                    inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium
                    transition-colors
                    ${isUrgent
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : isExpiringSoon
                        ? 'bg-amber-500 hover:bg-amber-600 text-white'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }
                    disabled:opacity-50
                  `}
                >
                  <CreditCard className="w-3 h-3" />
                  <span className="hidden sm:inline">Add Payment</span>
                </button>
              )}

              <Link
                to="/team/billing"
                className={`
                  inline-flex items-center gap-0.5 px-2 py-1 rounded text-xs font-medium
                  transition-colors
                  ${isUrgent
                    ? 'text-red-300 hover:text-red-200 hover:bg-red-500/20'
                    : isExpiringSoon
                      ? 'text-amber-300 hover:text-amber-200 hover:bg-amber-500/20'
                      : 'text-blue-300 hover:text-blue-200 hover:bg-blue-500/20'
                  }
                `}
              >
                <span className="hidden sm:inline">Plans</span>
                <ArrowRight className="w-3 h-3" />
              </Link>

              {dismissible && (
                <button
                  onClick={handleDismiss}
                  className={`
                    p-1 rounded transition-colors
                    ${isUrgent
                      ? 'text-red-400 hover:text-red-300 hover:bg-red-500/20'
                      : isExpiringSoon
                        ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/20'
                        : 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/20'
                    }
                  `}
                  aria-label="Dismiss"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default TrialBanner;
