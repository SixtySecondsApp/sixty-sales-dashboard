/**
 * Intervention Alert Card Component
 *
 * Displays a ghost risk alert with recommended actions and one-click intervention deployment.
 */

import React, { useState } from 'react';
import { AlertTriangle, TrendingDown, Clock, Mail, Eye, MousePointerClick } from 'lucide-react';
import { HealthScoreBadge } from './HealthScoreBadge';
import type { RelationshipHealthScore } from '@/lib/services/relationshipHealthService';
import type { GhostRiskAssessment } from '@/lib/services/ghostDetectionService';

interface InterventionAlertCardProps {
  relationshipHealth: RelationshipHealthScore;
  ghostRisk: GhostRiskAssessment;
  contactName: string;
  companyName?: string;
  dealValue?: number;
  onSendIntervention: () => void;
  onSnooze: () => void;
  onMarkHandled: () => void;
}

/**
 * Render a ghost-risk intervention alert card showing health metrics, prioritized risk signals, suggested actions, and controls for sending or deferring an intervention.
 *
 * Displays contact and company details, a health score badge with trend, up to two prominent risk signals (with an expandable list for additional signals), last-contact indicator, key engagement metrics (response, opens, meetings), a suggested template action, and three action buttons (Send Template, Snooze, Mark Handled). The card styling and urgency indicator reflect the highest signal severity.
 *
 * @param relationshipHealth - Object containing relationship metrics such as overall_health_score, health_status, days_since_last_contact, response_rate_percent, email_open_rate_percent, and meeting_count_30_days.
 * @param ghostRisk - Object describing ghost-risk assessment including signals (with severity and context), ghostProbabilityPercent, highestSeverity, recommendedAction, contextTrigger, and daysUntilPredictedGhost.
 * @param contactName - Display name for the contact associated with this alert.
 * @param companyName - Optional company name to display beneath the contact name.
 * @param dealValue - Optional numeric deal value; when provided and greater than zero it is displayed formatted in GBP.
 * @param onSendIntervention - Callback invoked when the "Send Template" action is triggered.
 * @param onSnooze - Callback invoked when the "Snooze" action is triggered.
 * @param onMarkHandled - Callback invoked when the "Mark Handled" action is triggered.
 * @returns The rendered intervention alert card as a JSX element.
 */
export function InterventionAlertCard({
  relationshipHealth,
  ghostRisk,
  contactName,
  companyName,
  dealValue,
  onSendIntervention,
  onSnooze,
  onMarkHandled,
}: InterventionAlertCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Get severity styling
  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500 bg-red-500/5';
      case 'high':
        return 'border-orange-500 bg-orange-500/5';
      case 'medium':
        return 'border-yellow-500 bg-yellow-500/5';
      default:
        return 'border-gray-300 bg-gray-50';
    }
  };

  // Calculate trend
  const scoreDelta = relationshipHealth.overall_health_score - 78; // Mock previous score
  const trend = scoreDelta > 0 ? 'improving' : scoreDelta < 0 ? 'declining' : 'stable';

  return (
    <div
      className={`
        relative rounded-lg border-2 p-4 transition-all
        ${getSeverityStyle(ghostRisk.highestSeverity)}
        hover:shadow-lg
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {contactName}
            </h3>
            <HealthScoreBadge
              score={relationshipHealth.overall_health_score}
              status={relationshipHealth.health_status}
              trend={trend}
              size="sm"
            />
          </div>

          {companyName && (
            <p className="text-sm text-gray-600">{companyName}</p>
          )}

          {dealValue && dealValue > 0 && (
            <p className="text-sm font-medium text-gray-900">
              Deal Value: {formatCurrency(dealValue)}
            </p>
          )}
        </div>

        {/* Priority indicator */}
        {ghostRisk.recommendedAction === 'urgent' && (
          <div className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
            <AlertTriangle className="h-3 w-3" />
            Urgent
          </div>
        )}
      </div>

      {/* Warning Signs */}
      <div className="mt-3 space-y-2">
        <div className="flex items-start gap-2">
          <TrendingDown className="h-4 w-4 text-orange-500 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">
              Health Score: {relationshipHealth.overall_health_score} (
              {trend === 'declining' ? '↓' : trend === 'improving' ? '↑' : '→'}{' '}
              {Math.abs(scoreDelta)} pts)
            </p>
            <p className="text-xs text-gray-600">
              Ghost Probability: {ghostRisk.ghostProbabilityPercent}%
            </p>
          </div>
        </div>

        {/* Key warning signals */}
        {ghostRisk.signals.slice(0, 2).map((signal, index) => (
          <div key={index} className="flex items-start gap-2">
            <AlertTriangle className={`h-4 w-4 mt-0.5 ${
              signal.severity === 'critical' ? 'text-red-500' :
              signal.severity === 'high' ? 'text-orange-500' :
              'text-yellow-500'
            }`} />
            <p className="text-sm text-gray-700">{signal.signal_context}</p>
          </div>
        ))}

        {ghostRisk.signals.length > 2 && !isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            +{ghostRisk.signals.length - 2} more signals
          </button>
        )}

        {isExpanded && ghostRisk.signals.slice(2).map((signal, index) => (
          <div key={index + 2} className="flex items-start gap-2">
            <AlertTriangle className={`h-4 w-4 mt-0.5 ${
              signal.severity === 'critical' ? 'text-red-500' :
              signal.severity === 'high' ? 'text-orange-500' :
              'text-yellow-500'
            }`} />
            <p className="text-sm text-gray-700">{signal.signal_context}</p>
          </div>
        ))}
      </div>

      {/* Last Interaction */}
      {relationshipHealth.days_since_last_contact && (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-gray-100 px-3 py-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <p className="text-sm text-gray-700">
            Last contact: {relationshipHealth.days_since_last_contact} days ago
          </p>
        </div>
      )}

      {/* Metrics */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-md bg-white p-2 text-center">
          <Mail className="mx-auto h-4 w-4 text-gray-400 mb-1" />
          <p className="text-xs text-gray-500">Response</p>
          <p className="text-sm font-semibold text-gray-900">
            {relationshipHealth.response_rate_percent || 0}%
          </p>
        </div>
        <div className="rounded-md bg-white p-2 text-center">
          <Eye className="mx-auto h-4 w-4 text-gray-400 mb-1" />
          <p className="text-xs text-gray-500">Opens</p>
          <p className="text-sm font-semibold text-gray-900">
            {relationshipHealth.email_open_rate_percent || 0}%
          </p>
        </div>
        <div className="rounded-md bg-white p-2 text-center">
          <MousePointerClick className="mx-auto h-4 w-4 text-gray-400 mb-1" />
          <p className="text-xs text-gray-500">Meetings</p>
          <p className="text-sm font-semibold text-gray-900">
            {relationshipHealth.meeting_count_30_days}
          </p>
        </div>
      </div>

      {/* Suggested Action */}
      <div className="mt-4 rounded-md bg-blue-50 p-3">
        <p className="text-xs font-medium text-blue-900 mb-1">Suggested Action:</p>
        <p className="text-sm text-blue-800">
          Deploy "Permission to Close" template
          {ghostRisk.contextTrigger && ` (${ghostRisk.contextTrigger.replace('_', ' ')})`}
        </p>
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={onSendIntervention}
          className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Send Template
        </button>
        <button
          onClick={onSnooze}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Snooze
        </button>
        <button
          onClick={onMarkHandled}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Mark Handled
        </button>
      </div>

      {/* Prediction */}
      {ghostRisk.daysUntilPredictedGhost && (
        <div className="mt-3 text-xs text-center text-gray-500">
          Predicted ghost in ~{ghostRisk.daysUntilPredictedGhost} days without intervention
        </div>
      )}
    </div>
  );
}