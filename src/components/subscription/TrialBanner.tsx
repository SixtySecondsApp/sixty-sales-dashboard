// src/components/subscription/TrialBanner.tsx
// Full-width banner for trial notifications

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, AlertTriangle, CreditCard, ArrowRight } from 'lucide-react';
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
  const trialStatus = useTrialStatus(organizationId);
  const createPortalSession = useCreatePortalSession();

  // Check if banner was dismissed
  const [isDismissed, setIsDismissed] = useState(() => {
    if (!dismissible) return false;
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
    try {
      localStorage.setItem(storageKey, Date.now().toString());
    } catch {
      // Ignore storage errors
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
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className={`
          relative overflow-hidden
          ${isUrgent
            ? 'bg-gradient-to-r from-red-500/20 to-red-600/20 border-b border-red-500/30'
            : isExpiringSoon
              ? 'bg-gradient-to-r from-amber-500/20 to-amber-600/20 border-b border-amber-500/30'
              : 'bg-gradient-to-r from-blue-500/20 to-blue-600/20 border-b border-blue-500/30'
          }
        `}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              {isUrgent ? (
                <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${isUrgent ? 'text-red-400' : 'text-amber-400'}`} />
              ) : (
                <Clock className="w-5 h-5 flex-shrink-0 text-blue-400" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${
                  isUrgent ? 'text-red-300' : isExpiringSoon ? 'text-amber-300' : 'text-blue-300'
                }`}>
                  {isUrgent ? (
                    <>
                      Your trial ends in {trialStatus.daysRemaining} day{trialStatus.daysRemaining !== 1 ? 's' : ''}!
                      {needsPayment && ' Add a payment method to continue using Sixty.'}
                    </>
                  ) : (
                    <>
                      You have {trialStatus.daysRemaining} days left in your free trial.
                      {needsPayment && ' Add a payment method to ensure uninterrupted access.'}
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {needsPayment && (
                <button
                  onClick={handleAddPayment}
                  disabled={createPortalSession.isPending}
                  className={`
                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
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
                  <CreditCard className="w-4 h-4" />
                  Add Payment
                </button>
              )}

              <Link
                to="/org/billing"
                className={`
                  inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium
                  transition-colors
                  ${isUrgent
                    ? 'text-red-300 hover:text-red-200 hover:bg-red-500/20'
                    : isExpiringSoon
                      ? 'text-amber-300 hover:text-amber-200 hover:bg-amber-500/20'
                      : 'text-blue-300 hover:text-blue-200 hover:bg-blue-500/20'
                  }
                `}
              >
                View Plans
                <ArrowRight className="w-4 h-4" />
              </Link>

              {dismissible && (
                <button
                  onClick={handleDismiss}
                  className={`
                    p-1 rounded-lg transition-colors
                    ${isUrgent
                      ? 'text-red-400 hover:text-red-300 hover:bg-red-500/20'
                      : isExpiringSoon
                        ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/20'
                        : 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/20'
                    }
                  `}
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
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
