import React from 'react';
import { X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface CSVUploadProgressProps {
  isOpen: boolean;
  onClose: () => void;
  stage: 'validating' | 'uploading' | 'processing' | 'complete' | 'error';
  progress: number; // 0-100
  currentRow?: number;
  totalRows?: number;
  message?: string;
  stats?: {
    processed: number;
    created: number;
    updated: number;
    skipped: number;
    errors: number;
  };
  error?: string;
}

const STAGE_CONFIG = {
  validating: {
    label: 'Validating CSV',
    icon: Loader2,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  uploading: {
    label: 'Uploading to server',
    icon: Loader2,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  processing: {
    label: 'Processing bookings',
    icon: Loader2,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
  },
  complete: {
    label: 'Import complete',
    icon: CheckCircle2,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
  },
  error: {
    label: 'Import failed',
    icon: AlertCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
  },
};

export function CSVUploadProgress({
  isOpen,
  onClose,
  stage,
  progress,
  currentRow,
  totalRows,
  message,
  stats,
  error,
}: CSVUploadProgressProps) {
  if (!isOpen) return null;

  const config = STAGE_CONFIG[stage];
  const Icon = config.icon;
  const isComplete = stage === 'complete';
  const hasError = stage === 'error';

  // Calculate estimated time remaining (rough estimate: ~100ms per row)
  const estimatedTimeRemaining = totalRows && currentRow
    ? Math.max(0, Math.ceil((totalRows - currentRow) * 0.1))
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', config.bgColor)}>
              <Icon className={cn('h-5 w-5', config.color, stage !== 'complete' && stage !== 'error' && 'animate-spin')} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {config.label}
              </h3>
              {message && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {message}
                </p>
              )}
            </div>
          </div>
          {isComplete && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          )}
        </div>

        {/* Progress Content */}
        <div className="p-6 space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Progress</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {Math.round(progress)}%
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Row Progress */}
          {currentRow !== undefined && totalRows !== undefined && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Processing rows</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {currentRow.toLocaleString()} / {totalRows.toLocaleString()}
                </span>
              </div>
              {estimatedTimeRemaining !== null && estimatedTimeRemaining > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Estimated time remaining: ~{estimatedTimeRemaining}s
                </p>
              )}
            </div>
          )}

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200 dark:border-gray-800">
              <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {stats.created}
                </div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                  Created
                </div>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-500/10">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.updated}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Updated
                </div>
              </div>
              {stats.skipped > 0 && (
                <div className="text-center p-3 rounded-lg bg-yellow-50 dark:bg-yellow-500/10">
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {stats.skipped}
                  </div>
                  <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                    Skipped
                  </div>
                </div>
              )}
              {stats.errors > 0 && (
                <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-500/10">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {stats.errors}
                  </div>
                  <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                    Errors
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          {hasError && (
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

