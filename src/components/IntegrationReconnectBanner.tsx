// src/components/IntegrationReconnectBanner.tsx
// Banner for alerting users when their integrations need reconnection

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, RefreshCw, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/contexts/AuthContext';
import { supabase } from '@/lib/supabase/clientV2';

interface IntegrationReconnectBannerProps {
  dismissible?: boolean;
  storageKey?: string;
  /** Additional top offset when other banners are visible (e.g., TrialBanner) */
  additionalTopOffset?: number;
}

export function IntegrationReconnectBanner({
  dismissible = true,
  storageKey = 'integration-reconnect-banner-dismissed',
  additionalTopOffset = 0,
}: IntegrationReconnectBannerProps) {
  const { user } = useAuth();

  // Check if banner was dismissed
  const [isDismissed, setIsDismissed] = useState(() => {
    if (!dismissible) return false;
    try {
      const dismissed = localStorage.getItem(storageKey);
      if (!dismissed) return false;
      // Allow showing again after 4 hours (persistent until reconnected)
      const dismissedAt = parseInt(dismissed, 10);
      return Date.now() - dismissedAt < 4 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  });

  // Query for unresolved integration alerts for current user
  const { data: alerts, isLoading } = useQuery({
    queryKey: ['integration-alerts', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('integration_alerts')
        .select('id, integration_type, title, message, severity, created_at')
        .eq('user_id', user.id)
        .is('resolved_at', null)
        .in('alert_type', ['token_revoked', 'token_expired', 'connection_failed'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[IntegrationReconnectBanner] Error fetching alerts:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(storageKey, Date.now().toString());
    } catch {
      // Ignore storage errors
    }
  };

  // Get the reconnect URL based on integration type
  const getReconnectUrl = (integrationType: string): string => {
    switch (integrationType) {
      case 'google_workspace':
        return '/settings/integrations/google-workspace';
      case 'slack':
        return '/settings/integrations/slack';
      case 'hubspot':
        return '/settings/integrations/hubspot';
      case 'fathom':
        return '/settings/integrations/fathom';
      default:
        return '/settings/integrations';
    }
  };

  // Get human-readable integration name
  const getIntegrationName = (integrationType: string): string => {
    switch (integrationType) {
      case 'google_workspace':
        return 'Google Calendar';
      case 'slack':
        return 'Slack';
      case 'hubspot':
        return 'HubSpot';
      case 'fathom':
        return 'Fathom';
      default:
        return integrationType;
    }
  };

  // Don't show if loading, dismissed, or no alerts
  if (isLoading || isDismissed || !alerts || alerts.length === 0) {
    return null;
  }

  // Use the most recent alert for display
  const primaryAlert = alerts[0];
  const integrationName = getIntegrationName(primaryAlert.integration_type);
  const reconnectUrl = getReconnectUrl(primaryAlert.integration_type);
  const hasMultipleAlerts = alerts.length > 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        style={{ top: `${65 + additionalTopOffset}px` }}
        className="fixed left-0 right-0 z-30 lg:left-[256px] bg-amber-500/10 border-b border-amber-500/20 backdrop-blur-sm"
      >
        <div className="px-3 py-2 sm:px-4 sm:py-2.5 lg:px-6 lg:py-3 pb-3">
          <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
            {/* Left: Alert info */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" />
              <span className="truncate text-amber-300">
                <span className="font-medium">{integrationName}</span>
                <span className="hidden sm:inline"> needs reconnection</span>
                {hasMultipleAlerts && (
                  <span className="ml-1 text-amber-400/70">
                    (+{alerts.length - 1} more)
                  </span>
                )}
              </span>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Link
                to={reconnectUrl}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span className="hidden sm:inline">Reconnect</span>
              </Link>

              <Link
                to="/settings/integrations"
                className="inline-flex items-center gap-0.5 px-2 py-1 rounded text-xs font-medium text-amber-300 hover:text-amber-200 hover:bg-amber-500/20 transition-colors"
              >
                <span className="hidden sm:inline">All</span>
                <ArrowRight className="w-3 h-3" />
              </Link>

              {dismissible && (
                <button
                  onClick={handleDismiss}
                  className="p-1 rounded transition-colors text-amber-400 hover:text-amber-300 hover:bg-amber-500/20"
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

/**
 * Hook to check if there are any unresolved integration alerts
 * Used by AppLayout to adjust padding when banner is visible
 */
export function useHasIntegrationAlerts(userId: string | undefined): boolean {
  const { data: alerts } = useQuery({
    queryKey: ['integration-alerts', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('integration_alerts')
        .select('id')
        .eq('user_id', userId)
        .is('resolved_at', null)
        .in('alert_type', ['token_revoked', 'token_expired', 'connection_failed'])
        .limit(1);

      if (error) return [];
      return data || [];
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  });

  return (alerts?.length ?? 0) > 0;
}

export default IntegrationReconnectBanner;
