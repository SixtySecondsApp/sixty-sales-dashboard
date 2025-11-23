/**
 * Ghost Detection Panel Component
 *
 * Displays all detected ghost signals with severity, context, and resolution tracking.
 */

import React from 'react';
import {
  AlertTriangle,
  Mail,
  Clock,
  Calendar,
  TrendingDown,
  MessageSquare,
  UserX,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import type { GhostDetectionSignal } from '@/lib/services/ghostDetectionService';

interface GhostDetectionPanelProps {
  signals: GhostDetectionSignal[];
  onResolveSignal?: (signalId: string) => void;
  onResolveAll?: () => void;
}

/**
 * Renders a panel showing ghost-detection signals, grouping them into active warnings and resolved signals and providing optional resolve actions.
 *
 * @param signals - Array of ghost detection signals. Signals with a `resolved_at` timestamp are treated as resolved.
 * @param onResolveSignal - Optional handler called with a signal `id` when an individual signal is marked resolved.
 * @param onResolveAll - Optional handler called when the "Resolve All" action is triggered.
 * @returns The UI element that displays active warnings, resolved signals (collapsible), and appropriate empty states.
 */
export function GhostDetectionPanel({
  signals,
  onResolveSignal,
  onResolveAll,
}: GhostDetectionPanelProps) {
  // Get icon for signal type
  const getSignalIcon = (type: string) => {
    switch (type) {
      case 'email_no_response':
        return Mail;
      case 'response_time_increased':
        return Clock;
      case 'email_opens_declined':
        return TrendingDown;
      case 'meeting_cancelled':
      case 'meeting_rescheduled_repeatedly':
        return Calendar;
      case 'thread_dropout':
        return MessageSquare;
      case 'sentiment_declining':
        return TrendingDown;
      case 'engagement_pattern_break':
        return UserX;
      default:
        return AlertTriangle;
    }
  };

  // Get severity styling
  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-700',
          badge: 'bg-red-100 text-red-800',
        };
      case 'high':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          text: 'text-orange-700',
          badge: 'bg-orange-100 text-orange-800',
        };
      case 'medium':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          text: 'text-yellow-700',
          badge: 'bg-yellow-100 text-yellow-800',
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          text: 'text-gray-700',
          badge: 'bg-gray-100 text-gray-800',
        };
    }
  };

  // Format signal type for display
  const formatSignalType = (type: string) => {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffDays === 0) {
      if (diffHours === 0) return 'Just now';
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString('en-GB', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  // Active signals (not resolved)
  const activeSignals = signals.filter((s) => !s.resolved_at);
  const resolvedSignals = signals.filter((s) => s.resolved_at);

  if (signals.length === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <CheckCircle className="mx-auto h-12 w-12 text-green-600 mb-3" />
        <h3 className="text-lg font-semibold text-green-900 mb-1">
          No Ghost Signals Detected
        </h3>
        <p className="text-sm text-green-700">
          This relationship is healthy with no warning signs
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Ghost Detection Signals
          </h3>
          <p className="text-sm text-gray-600">
            {activeSignals.length} active warning{activeSignals.length !== 1 ? 's' : ''}
            {resolvedSignals.length > 0 && `, ${resolvedSignals.length} resolved`}
          </p>
        </div>

        {activeSignals.length > 0 && onResolveAll && (
          <button
            onClick={onResolveAll}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Resolve All
          </button>
        )}
      </div>

      {/* Active Signals */}
      {activeSignals.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Active Warnings</h4>
          {activeSignals.map((signal) => {
            const Icon = getSignalIcon(signal.signal_type);
            const style = getSeverityStyle(signal.severity);

            return (
              <div
                key={signal.id}
                className={`rounded-lg border p-4 ${style.bg} ${style.border}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`rounded-full p-2 ${style.badge}`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Signal type and severity */}
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className={`font-semibold ${style.text}`}>
                        {formatSignalType(signal.signal_type)}
                      </h4>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}
                      >
                        {signal.severity}
                      </span>
                    </div>

                    {/* Signal context */}
                    <p className="text-sm text-gray-700 mb-2">
                      {signal.signal_context}
                    </p>

                    {/* Signal data (if available) */}
                    {signal.signal_data && (
                      <div className="rounded-md bg-white/50 p-2 text-xs text-gray-600">
                        {typeof signal.signal_data === 'object' && (
                          <pre className="whitespace-pre-wrap font-mono">
                            {JSON.stringify(signal.signal_data, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                      <span>Detected {formatDate(signal.detected_at)}</span>
                    </div>
                  </div>

                  {/* Resolve button */}
                  {onResolveSignal && (
                    <button
                      onClick={() => onResolveSignal(signal.id)}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-white"
                      title="Mark as resolved"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resolved Signals (collapsible) */}
      {resolvedSignals.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
            <span className="inline-flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              {resolvedSignals.length} Resolved Signal{resolvedSignals.length !== 1 ? 's' : ''}
            </span>
          </summary>

          <div className="mt-2 space-y-2">
            {resolvedSignals.map((signal) => {
              const Icon = getSignalIcon(signal.signal_type);

              return (
                <div
                  key={signal.id}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-3 opacity-60"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-gray-200 p-2">
                      <Icon className="h-4 w-4 text-gray-600" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-gray-900">
                          {formatSignalType(signal.signal_type)}
                        </h4>
                        <CheckCircle className="h-3 w-3 text-green-600" />
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {signal.signal_context}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Resolved {signal.resolved_at && formatDate(signal.resolved_at)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}

      {/* Empty state for no active signals */}
      {activeSignals.length === 0 && resolvedSignals.length > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
          <CheckCircle className="mx-auto h-8 w-8 text-green-600 mb-2" />
          <p className="text-sm font-medium text-green-900">
            All signals have been resolved
          </p>
        </div>
      )}
    </div>
  );
}