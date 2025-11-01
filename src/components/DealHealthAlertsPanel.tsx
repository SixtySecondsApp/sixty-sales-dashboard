/**
 * Deal Health Alerts Panel
 *
 * Displays active health alerts with action buttons
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  TrendingDown,
  Users,
  PhoneOff,
  Calendar,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  ExternalLink,
} from 'lucide-react';
import { useActiveAlerts } from '@/lib/hooks/useDealHealth';
import type { DealHealthAlert } from '@/lib/services/dealHealthAlertService';
import { motion, AnimatePresence } from 'framer-motion';

export function DealHealthAlertsPanel() {
  const { alerts, stats, loading, acknowledge, resolve, dismiss } = useActiveAlerts();
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="space-y-2">
            <div className="h-16 bg-gray-100 dark:bg-gray-700/50 rounded" />
            <div className="h-16 bg-gray-100 dark:bg-gray-700/50 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <div className="text-center py-8">
          <Check className="mx-auto h-12 w-12 text-green-500 mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            All Clear!
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No active health alerts. Your deals are looking good.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      {/* Header with stats */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Deal Health Alerts
          </h2>
          <div className="flex items-center gap-3">
            {stats.critical > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                  {stats.critical} Critical
                </span>
              </div>
            )}
            {stats.warning > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-yellow-500" />
                <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                  {stats.warning} Warning
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alerts list */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
        <AnimatePresence>
          {alerts.map((alert) => (
            <DealHealthAlertCard
              key={alert.id}
              alert={alert}
              isExpanded={expandedAlertId === alert.id}
              onToggleExpand={() =>
                setExpandedAlertId(expandedAlertId === alert.id ? null : alert.id)
              }
              onAcknowledge={() => acknowledge(alert.id)}
              onResolve={() => resolve(alert.id)}
              onDismiss={() => dismiss(alert.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// =====================================================
// Alert Card Component
// =====================================================

interface DealHealthAlertCardProps {
  alert: DealHealthAlert & { deals?: any };
  isExpanded: boolean;
  onToggleExpand: () => void;
  onAcknowledge: () => void;
  onResolve: () => void;
  onDismiss: () => void;
}

function DealHealthAlertCard({
  alert,
  isExpanded,
  onToggleExpand,
  onAcknowledge,
  onResolve,
  onDismiss,
}: DealHealthAlertCardProps) {
  // Alert type icons
  const typeIcons = {
    stage_stall: Clock,
    sentiment_drop: TrendingDown,
    engagement_decline: Users,
    no_activity: PhoneOff,
    missed_follow_up: Calendar,
    close_date_approaching: Calendar,
    high_risk: AlertCircle,
  };

  const TypeIcon = typeIcons[alert.alert_type] || AlertCircle;

  // Severity configuration
  const severityConfig = {
    critical: {
      bgColor: 'bg-red-50 dark:bg-red-900/10',
      borderColor: 'border-l-red-500',
      iconColor: 'text-red-600 dark:text-red-400',
      icon: AlertTriangle,
    },
    warning: {
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/10',
      borderColor: 'border-l-yellow-500',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      icon: AlertCircle,
    },
    info: {
      bgColor: 'bg-blue-50 dark:bg-blue-900/10',
      borderColor: 'border-l-blue-500',
      iconColor: 'text-blue-600 dark:text-blue-400',
      icon: Info,
    },
  };

  const config = severityConfig[alert.severity];
  const SeverityIcon = config.icon;

  const dealName = alert.deals?.name || 'Deal';
  const stageName = alert.deals?.deal_stages?.name || '';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className={`border-l-4 ${config.borderColor} ${config.bgColor} hover:bg-opacity-80 transition-colors`}
    >
      <div className="p-4">
        {/* Alert header */}
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 ${config.iconColor}`}>
            <SeverityIcon className="h-5 w-5" />
          </div>

          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                {alert.title}
              </h3>
              <button
                onClick={onToggleExpand}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Deal info */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {dealName}
              </span>
              {stageName && (
                <>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {stageName}
                  </span>
                </>
              )}
            </div>

            {/* Message */}
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {alert.message}
            </p>

            {/* Expanded content */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 mb-3"
                >
                  {/* Suggested actions */}
                  {alert.suggested_actions && alert.suggested_actions.length > 0 && (
                    <div className="bg-white dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                      <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                        <Info className="h-3 w-3" />
                        Suggested Actions
                      </h4>
                      <ul className="space-y-1.5">
                        {alert.suggested_actions.map((action, index) => (
                          <li
                            key={index}
                            className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2"
                          >
                            <span className="text-gray-400 mt-0.5">→</span>
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Metadata */}
                  {alert.metadata && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {alert.metadata.health_score && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-500">Health Score:</span>
                          <span className="ml-1 font-medium text-gray-700 dark:text-gray-300">
                            {alert.metadata.health_score}/100
                          </span>
                        </div>
                      )}
                      {alert.metadata.risk_level && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-500">Risk Level:</span>
                          <span className="ml-1 font-medium text-gray-700 dark:text-gray-300 capitalize">
                            {alert.metadata.risk_level}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {alert.action_url && (
                <a
                  href={alert.action_url}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  View Deal
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}

              <button
                onClick={onAcknowledge}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                <Check className="h-3 w-3" />
                Acknowledge
              </button>

              <button
                onClick={onResolve}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
              >
                <Check className="h-3 w-3" />
                Resolve
              </button>

              <button
                onClick={onDismiss}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-3 w-3" />
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
