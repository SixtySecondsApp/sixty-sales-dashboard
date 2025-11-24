/**
 * Error State Component
 *
 * Displays user-friendly error messages with retry functionality.
 * Provides actionable guidance and support for common error scenarios.
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  RefreshCw,
  Wifi,
  WifiOff,
  ServerCrash,
  ShieldAlert,
  HelpCircle,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export type ErrorType =
  | 'network'
  | 'server'
  | 'authentication'
  | 'permission'
  | 'not-found'
  | 'generic';

export interface ErrorStateProps {
  type?: ErrorType;
  title?: string;
  message?: string;
  error?: Error | string;
  onRetry?: () => void;
  onGoBack?: () => void;
  retryText?: string;
  isRetrying?: boolean;
  showSupport?: boolean;
  className?: string;
}

const errorConfig: Record<
  ErrorType,
  {
    icon: React.ComponentType<{ className?: string }>;
    defaultTitle: string;
    defaultMessage: string;
    color: string;
  }
> = {
  network: {
    icon: WifiOff,
    defaultTitle: 'Connection Lost',
    defaultMessage:
      'Unable to connect to the server. Please check your internet connection and try again.',
    color: 'text-orange-500 dark:text-orange-400',
  },
  server: {
    icon: ServerCrash,
    defaultTitle: 'Server Error',
    defaultMessage:
      'Something went wrong on our end. Our team has been notified. Please try again in a moment.',
    color: 'text-red-500 dark:text-red-400',
  },
  authentication: {
    icon: ShieldAlert,
    defaultTitle: 'Authentication Required',
    defaultMessage:
      'Your session has expired. Please sign in again to continue.',
    color: 'text-yellow-500 dark:text-yellow-400',
  },
  permission: {
    icon: ShieldAlert,
    defaultTitle: 'Permission Denied',
    defaultMessage:
      "You don't have permission to access this resource. Please contact your administrator if you believe this is an error.",
    color: 'text-red-500 dark:text-red-400',
  },
  'not-found': {
    icon: HelpCircle,
    defaultTitle: 'Not Found',
    defaultMessage:
      "The resource you're looking for doesn't exist or has been removed.",
    color: 'text-gray-500 dark:text-gray-400',
  },
  generic: {
    icon: AlertCircle,
    defaultTitle: 'Something Went Wrong',
    defaultMessage:
      'An unexpected error occurred. Please try again or contact support if the problem persists.',
    color: 'text-red-500 dark:text-red-400',
  },
};

export const ErrorState: React.FC<ErrorStateProps> = ({
  type = 'generic',
  title,
  message,
  error,
  onRetry,
  onGoBack,
  retryText = 'Try Again',
  isRetrying = false,
  showSupport = true,
  className = '',
}) => {
  const config = errorConfig[type];
  const Icon = config.icon;

  const displayTitle = title || config.defaultTitle;
  const displayMessage = message || config.defaultMessage;

  // Extract error message if error object is provided
  const errorDetails =
    error instanceof Error ? error.message : typeof error === 'string' ? error : null;

  return (
    <Card
      className={`flex flex-col items-center justify-center p-8 space-y-6 bg-gray-50 dark:bg-gray-900/50 border-2 border-dashed border-gray-300 dark:border-gray-700 ${className}`}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="text-center space-y-4"
      >
        {/* Icon */}
        <div className="flex justify-center">
          <div
            className={`p-4 rounded-full bg-gray-100 dark:bg-gray-800 ${config.color}`}
          >
            <Icon className="w-12 h-12" />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {displayTitle}
        </h3>

        {/* Message */}
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
          {displayMessage}
        </p>

        {/* Error Details (for development/debugging) */}
        {errorDetails && process.env.NODE_ENV === 'development' && (
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-xs text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              Error Details (dev only)
            </summary>
            <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-md text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">
              {errorDetails}
            </pre>
          </details>
        )}
      </motion.div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {onGoBack && (
          <Button
            onClick={onGoBack}
            variant="outline"
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
        )}

        {onRetry && (
          <Button
            onClick={onRetry}
            disabled={isRetrying}
            variant="default"
            className="gap-2 bg-[#37bd7e] hover:bg-[#2da868] text-white"
          >
            {isRetrying ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                {retryText}
              </>
            )}
          </Button>
        )}
      </div>

      {/* Support Link */}
      {showSupport && (
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-4">
          Need help?{' '}
          <a
            href="mailto:support@sixty.com"
            className="text-[#37bd7e] hover:text-[#2da868] underline"
          >
            Contact Support
          </a>
        </p>
      )}
    </Card>
  );
};

/**
 * Inline Error Message
 *
 * Smaller, inline error display for use within forms or components
 */
export interface InlineErrorProps {
  message: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
}

export const InlineError: React.FC<InlineErrorProps> = ({
  message,
  onRetry,
  isRetrying = false,
  className = '',
}) => {
  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 ${className}`}
    >
      <div className="flex items-center gap-2 flex-1">
        <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
        <p className="text-sm text-red-700 dark:text-red-300">{message}</p>
      </div>

      {onRetry && (
        <Button
          onClick={onRetry}
          disabled={isRetrying}
          size="sm"
          variant="ghost"
          className="ml-3 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30"
        >
          {isRetrying ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
        </Button>
      )}
    </div>
  );
};

/**
 * Empty State Component
 *
 * For when there's no data to display (not an error)
 */
export interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ComponentType<{ className?: string }>;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  message,
  action,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 space-y-4 ${className}`}
    >
      {Icon && (
        <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-800">
          <Icon className="w-12 h-12 text-gray-400 dark:text-gray-600" />
        </div>
      )}

      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-sm">
          {message}
        </p>
      </div>

      {action && (
        <Button
          onClick={action.onClick}
          className="gap-2 bg-[#37bd7e] hover:bg-[#2da868] text-white"
        >
          {action.icon && <action.icon className="w-4 h-4" />}
          {action.label}
        </Button>
      )}
    </div>
  );
};
