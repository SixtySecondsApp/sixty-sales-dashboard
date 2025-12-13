import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export type IntegrationStatus = 'active' | 'inactive' | 'error' | 'syncing' | 'coming_soon';

interface IntegrationCardProps {
  name: string;
  description: string;
  logoUrl?: string | null;
  fallbackIcon?: React.ReactNode;
  status: IntegrationStatus;
  statusText?: string;
  onAction?: () => void;
  actionLoading?: boolean;
  iconBgColor?: string;
  iconBorderColor?: string;
  footer?: React.ReactNode;
}

const statusConfig: Record<IntegrationStatus, { badge: string; text: string; dot?: boolean }> = {
  active: {
    badge: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
    text: 'Active',
    dot: true,
  },
  inactive: {
    badge: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700',
    text: 'Inactive',
  },
  error: {
    badge: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20',
    text: 'Error',
  },
  syncing: {
    badge: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
    text: 'Syncing',
    dot: true,
  },
  coming_soon: {
    badge: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
    text: 'Coming Soon',
  },
};

export function IntegrationCard({
  name,
  description,
  logoUrl,
  fallbackIcon,
  status,
  statusText,
  onAction,
  actionLoading,
  iconBgColor = 'bg-gray-100 dark:bg-gray-800',
  iconBorderColor = 'border-gray-200 dark:border-gray-700',
  footer,
}: IntegrationCardProps) {
  const config = statusConfig[status];
  const displayStatus = statusText || config.text;
  const isActive = status === 'active' || status === 'syncing';
  const isComingSoon = status === 'coming_soon';

  return (
    <div className={cn(
      "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm transition-all",
      isComingSoon ? 'opacity-75' : 'hover:shadow-md'
    )}>
      {/* Header with logo and status */}
      <div className="flex justify-between items-start mb-5">
        <div
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center border overflow-hidden',
            iconBgColor,
            iconBorderColor
          )}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${name} logo`}
              className="w-8 h-8 object-contain"
              onError={(e) => {
                // Hide image on error, fallback icon will show
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            fallbackIcon
          )}
        </div>
        <span
          className={cn(
            'px-2.5 py-1 border rounded-full text-xs font-semibold flex items-center gap-1.5',
            config.badge
          )}
        >
          {config.dot && (
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                status === 'active' && 'bg-emerald-500 animate-pulse',
                status === 'syncing' && 'bg-blue-500 animate-pulse'
              )}
            />
          )}
          {displayStatus}
        </span>
      </div>

      {/* Title and description */}
      <h3 className="text-lg font-semibold mb-1 text-gray-900 dark:text-white">{name}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{description}</p>

      {/* Optional footer (e.g. vote button) */}
      {footer && <div className="mb-4">{footer}</div>}

      {/* Action button */}
      {isComingSoon ? (
        <div className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-400 dark:text-gray-500 text-center cursor-not-allowed">
          Coming Soon
        </div>
      ) : isActive ? (
        <button
          onClick={onAction}
          disabled={actionLoading}
          className="w-full py-2 px-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          Configure
        </button>
      ) : (
        <button
          onClick={onAction}
          disabled={actionLoading}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          Connect
        </button>
      )}
    </div>
  );
}
