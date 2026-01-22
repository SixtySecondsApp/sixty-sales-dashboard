// src/components/IntegrationReconnectBanner.tsx
// Banner shown when a user's integration (Fathom) needs reconnection

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, RefreshCw, Video, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useIntegrationReconnectNeeded } from '@/lib/hooks/useIntegrationReconnectNeeded';
import { useFathomIntegration } from '@/lib/hooks/useFathomIntegration';
import { cn } from '@/lib/utils';

interface IntegrationReconnectBannerProps {
  className?: string;
  /** Whether trial banner is visible above this banner */
  hasTrialBannerAbove?: boolean;
  /** Whether impersonation banner is visible at the very top */
  hasImpersonationBannerAbove?: boolean;
  /** Whether sidebar is collapsed (for proper left offset) */
  isSidebarCollapsed?: boolean;
}

export function IntegrationReconnectBanner({
  className,
  hasTrialBannerAbove = false,
  hasImpersonationBannerAbove = false,
  isSidebarCollapsed = false,
}: IntegrationReconnectBannerProps) {
  const { needsReconnect, loading, dismiss } = useIntegrationReconnectNeeded();
  const { connectFathom } = useFathomIntegration();
  const navigate = useNavigate();
  const [isReconnecting, setIsReconnecting] = React.useState(false);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      await connectFathom();
      // After reconnection, the banner will automatically disappear
      // when the integration becomes active again (via realtime subscription)
    } catch (error) {
      console.error('[IntegrationReconnectBanner] Reconnect error:', error);
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleGoToSettings = () => {
    navigate('/settings/meeting-sync');
  };

  // Don't show if loading or no reconnection needed
  if (loading || !needsReconnect) {
    return null;
  }

  const integrationName = needsReconnect.type === 'fathom' ? 'Fathom' : 'Integration';
  const email = needsReconnect.fathom_user_email;

  // Calculate top position based on what's above
  // Base: 64px (top bar height)
  // + 44px if impersonation banner
  // + ~51px if trial banner (banner height)
  const getTopPosition = () => {
    let base = 64; // Top bar height
    if (hasImpersonationBannerAbove) base += 44;
    if (hasTrialBannerAbove) base += 51;
    return `${base}px`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        style={{
          top: getTopPosition(),
        }}
        className={cn(
          'fixed left-0 right-0 z-[85]',
          // Amber/orange color scheme for "needs attention"
          'bg-amber-500/10 dark:bg-amber-500/15 border-b border-amber-500/20',
          'backdrop-blur-sm',
          // Desktop: account for sidebar
          isSidebarCollapsed ? 'lg:left-[80px]' : 'lg:left-[256px]',
          className
        )}
      >
        <div className="px-3 py-2 sm:px-4 sm:py-2.5 lg:px-6">
          <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
            {/* Left: Warning info */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-500" />
              <Video className="w-4 h-4 flex-shrink-0 text-amber-400 hidden sm:block" />
              <span className="text-amber-200 truncate">
                <span className="font-medium">{integrationName}</span>
                {email && <span className="hidden md:inline text-amber-300/70"> ({email})</span>}
                <span className="text-amber-300/80"> disconnected — </span>
                <span className="text-amber-300">your meeting recordings are not syncing</span>
              </span>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={handleReconnect}
                disabled={isReconnecting}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium',
                  'bg-amber-500 hover:bg-amber-600 text-white',
                  'transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <RefreshCw className={cn('w-3 h-3', isReconnecting && 'animate-spin')} />
                <span>{isReconnecting ? 'Connecting...' : 'Reconnect'}</span>
              </button>

              <button
                onClick={handleGoToSettings}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium',
                  'text-amber-300 hover:text-amber-200 hover:bg-amber-500/20',
                  'transition-colors'
                )}
              >
                <Settings className="w-3 h-3" />
                <span className="hidden sm:inline">Settings</span>
              </button>

              <button
                onClick={dismiss}
                className={cn(
                  'p-1 rounded transition-colors',
                  'text-amber-400 hover:text-amber-300 hover:bg-amber-500/20'
                )}
                aria-label="Dismiss for 24 hours"
                title="Dismiss for 24 hours"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default IntegrationReconnectBanner;
