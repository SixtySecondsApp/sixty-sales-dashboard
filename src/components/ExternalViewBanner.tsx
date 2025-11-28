/**
 * ExternalViewBanner - Badge Shown When External View Mode is Active
 *
 * Displays a floating badge in the bottom-right corner when an internal user
 * is viewing the application as an external customer would see it.
 * Designed to be visible but non-intrusive.
 */

import React from 'react';
import { Eye, X } from 'lucide-react';
import {
  useUserPermissions,
  useIsViewingAsExternal,
} from '@/contexts/UserPermissionsContext';
import { cn } from '@/lib/utils';

interface ExternalViewBannerProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Floating badge in bottom-right corner when external view is active
 */
export function ExternalViewBanner({ className }: ExternalViewBannerProps) {
  const { isInternal, exitExternalView } = useUserPermissions();
  const isExternalViewActive = useIsViewingAsExternal();

  // Only show when internal user is in external view mode
  if (!isExternalViewActive || !isInternal) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-[100]',
        'bg-amber-500/90 dark:bg-amber-600/90',
        'backdrop-blur-sm',
        'rounded-full',
        'shadow-lg shadow-amber-500/25',
        'animate-in slide-in-from-bottom-4 duration-300',
        'group',
        className
      )}
    >
      <div className="flex items-center gap-2 pl-4 pr-2 py-2">
        <Eye className="h-4 w-4 text-white" />
        <span className="text-white text-sm font-medium whitespace-nowrap">
          Customer View
        </span>
        <button
          onClick={exitExternalView}
          className="ml-1 p-1.5 rounded-full hover:bg-white/20 transition-colors"
          title="Exit Customer View"
        >
          <X className="h-3.5 w-3.5 text-white" />
        </button>
      </div>
    </div>
  );
}

/**
 * Spacer component to offset content when banner is shown
 * Use this at the bottom of your layout if you have fixed bottom content
 * that needs to account for the external view banner
 */
export function ExternalViewBannerSpacer() {
  const { isInternal } = useUserPermissions();
  const isExternalViewActive = useIsViewingAsExternal();

  if (!isExternalViewActive || !isInternal) {
    return null;
  }

  // Height matches the banner (py-2 = 8px*2 + content height ~24px = ~40px)
  return <div className="h-10" />;
}

export default ExternalViewBanner;
