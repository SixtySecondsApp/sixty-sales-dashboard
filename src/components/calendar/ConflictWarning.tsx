/**
 * Conflict Warning Component
 *
 * Displays warnings about calendar event conflicts (overlapping events)
 * with detailed information about each conflict.
 */

import React from 'react';
import { EventConflict, formatConflictMessage } from '@/lib/utils/conflictDetection';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format } from 'date-fns';

export interface ConflictWarningProps {
  conflicts: EventConflict[];
  onDismiss?: () => void;
  showDetails?: boolean;
}

export const ConflictWarning: React.FC<ConflictWarningProps> = ({
  conflicts,
  onDismiss,
  showDetails = true,
}) => {
  if (conflicts.length === 0) {
    return null;
  }

  // Determine highest severity
  const hasHighSeverity = conflicts.some(c => c.severity === 'high');
  const hasMediumSeverity = conflicts.some(c => c.severity === 'medium');

  const severityLevel = hasHighSeverity ? 'high' : hasMediumSeverity ? 'medium' : 'low';

  const getIcon = () => {
    switch (severityLevel) {
      case 'high':
        return <AlertCircle className="w-5 h-5" />;
      case 'medium':
        return <AlertTriangle className="w-5 h-5" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getAlertVariant = () => {
    switch (severityLevel) {
      case 'high':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const getTitle = () => {
    if (severityLevel === 'high') {
      return 'Double-Booking Detected';
    }
    if (conflicts.length === 1) {
      return 'Event Conflict Detected';
    }
    return `${conflicts.length} Event Conflicts Detected`;
  };

  const getSummary = () => {
    if (severityLevel === 'high') {
      return 'This event has the same time as one or more existing events.';
    }
    if (conflicts.length === 1) {
      return 'This event overlaps with an existing event.';
    }
    return 'This event overlaps with multiple existing events.';
  };

  return (
    <Alert
      variant={getAlertVariant()}
      className={`mb-4 ${
        severityLevel === 'high'
          ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
          : severityLevel === 'medium'
          ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
          : 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex-shrink-0 ${
            severityLevel === 'high'
              ? 'text-red-600 dark:text-red-400'
              : severityLevel === 'medium'
              ? 'text-yellow-600 dark:text-yellow-400'
              : 'text-blue-600 dark:text-blue-400'
          }`}
        >
          {getIcon()}
        </div>
        <div className="flex-1">
          <AlertTitle className="mb-2 font-semibold">{getTitle()}</AlertTitle>
          <AlertDescription>
            <p className="text-sm mb-3">{getSummary()}</p>

            {showDetails && (
              <div className="space-y-2">
                {conflicts.map((conflict, index) => (
                  <div
                    key={index}
                    className="text-sm p-3 rounded-md bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                          {conflict.conflictingEvent.title}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {formatConflictMessage(conflict)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {format(conflict.conflictingEvent.start, 'MMM d, h:mm a')} -{' '}
                          {format(
                            conflict.conflictingEvent.end || conflict.conflictingEvent.start,
                            'h:mm a'
                          )}
                        </div>
                        {conflict.conflictingEvent.location && (
                          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            📍 {conflict.conflictingEvent.location}
                          </div>
                        )}
                      </div>
                      <div
                        className={`text-xs font-medium px-2 py-1 rounded ${
                          conflict.severity === 'high'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                            : conflict.severity === 'medium'
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        }`}
                      >
                        {conflict.severity}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
              {severityLevel === 'high' ? (
                <strong>⚠️ You may want to reschedule this event to avoid double-booking.</strong>
              ) : (
                'You can still save this event, but you may want to adjust the time.'
              )}
            </div>
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
};
