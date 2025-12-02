/**
 * ExternalViewToggle - Toggle Button for "View as External User"
 *
 * Allows internal users to preview the application as an external customer would see it.
 * Only visible to internal users (based on email domain).
 */

import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import {
  useUserPermissions,
  useIsViewingAsExternal,
  useToggleExternalView,
} from '@/contexts/UserPermissionsContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useDropdownMenuClose } from '@/components/ui/dropdown-menu';

interface ExternalViewToggleProps {
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the label text (hidden on mobile by default) */
  showLabel?: boolean;
  /** Variant style - 'menu' for use inside dropdown menus */
  variant?: 'default' | 'outline' | 'ghost' | 'menu';
}

/**
 * Menu variant component - separated to properly use hooks
 */
function ExternalViewToggleMenu({ className }: { className?: string }) {
  const isExternalViewActive = useIsViewingAsExternal();
  const toggleExternalView = useToggleExternalView();
  const closeDropdown = useDropdownMenuClose();

  const handleClick = () => {
    toggleExternalView();
    closeDropdown();
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors',
        isExternalViewActive
          ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/70',
        className
      )}
    >
      {isExternalViewActive ? (
        <>
          <EyeOff className="h-4 w-4" />
          <span>Exit Customer View</span>
        </>
      ) : (
        <>
          <Eye className="h-4 w-4" />
          <span>View as Customer</span>
        </>
      )}
    </button>
  );
}

/**
 * Toggle button for internal users to switch to external view mode
 */
export function ExternalViewToggle({
  className,
  showLabel = true,
  variant = 'ghost',
}: ExternalViewToggleProps) {
  const { isInternal } = useUserPermissions();
  const isExternalViewActive = useIsViewingAsExternal();
  const toggleExternalView = useToggleExternalView();

  // Only show for internal users
  if (!isInternal) {
    return null;
  }

  // Menu variant - use separate component for proper hook usage
  if (variant === 'menu') {
    return <ExternalViewToggleMenu className={className} />;
  }

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={toggleExternalView}
      title={isExternalViewActive
        ? 'Exit customer view and return to internal view'
        : 'Preview the app as an external customer would see it'}
      className={cn(
        'flex items-center gap-2 transition-colors',
        isExternalViewActive
          ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/70',
        className
      )}
    >
      {isExternalViewActive ? (
        <>
          <EyeOff className="h-4 w-4" />
          {showLabel && <span className="hidden sm:inline">Exit Customer View</span>}
        </>
      ) : (
        <>
          <Eye className="h-4 w-4" />
          {showLabel && <span className="hidden sm:inline">View as Customer</span>}
        </>
      )}
    </Button>
  );
}

/**
 * Compact version of the toggle for tight spaces
 */
export function ExternalViewToggleCompact({ className }: { className?: string }) {
  return <ExternalViewToggle className={className} showLabel={false} />;
}

export default ExternalViewToggle;
