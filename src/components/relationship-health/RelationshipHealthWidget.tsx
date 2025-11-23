/**
 * RelationshipHealthWidget Component
 *
 * Displays relationship health information on contact and company profile pages.
 * Shows health score, ghost risk alerts, and quick intervention access.
 */

import { useState } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useRelationshipHealthScore, useGhostDetection } from '@/lib/hooks/useRelationshipHealth';
import { HealthScoreBadge } from './HealthScoreBadge';
import { InterventionModal } from './InterventionModal';
import {
  Activity,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Send,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RelationshipHealthWidgetProps {
  relationshipType: 'contact' | 'company';
  relationshipId: string;
  relationshipName?: string;
  compact?: boolean;
}

export function RelationshipHealthWidget({
  relationshipType,
  relationshipId,
  relationshipName,
  compact = false,
}: RelationshipHealthWidgetProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showInterventionModal, setShowInterventionModal] = useState(false);

  const { healthScore, isLoading: loadingHealth } = useRelationshipHealthScore(
    relationshipType,
    relationshipId
  );

  const { signals, isLoading: loadingSignals } = useGhostDetection(
    healthScore?.id || null
  );

  if (!user || loadingHealth) {
    return (
      <div className="p-4 bg-white/5 border border-white/10 rounded-lg animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/2 mb-2" />
        <div className="h-8 bg-white/10 rounded" />
      </div>
    );
  }

  if (!healthScore) {
    return null; // No health data available yet
  }

  const activeSignals = signals?.filter((s) => !s.resolved_at) || [];
  const hasGhostRisk = activeSignals.length > 0;
  const highSeveritySignals = activeSignals.filter(
    (s) => s.severity === 'critical' || s.severity === 'high'
  );

  // Determine if intervention is urgently needed
  const needsIntervention =
    healthScore.health_status === 'ghost' ||
    healthScore.health_status === 'critical' ||
    highSeveritySignals.length > 0;

  const handleViewDetails = () => {
    navigate(`/crm/relationship-health?relationship=${relationshipId}&type=${relationshipType}`);
  };

  if (compact) {
    return (
      <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Relationship Health</span>
          <HealthScoreBadge
            score={healthScore.overall_health_score}
            status={healthScore.health_status}
            trend={healthScore.health_trend}
            size="sm"
          />
        </div>
        {hasGhostRisk && (
          <button
            onClick={() => setShowInterventionModal(true)}
            className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-400 rounded text-xs hover:bg-red-500/20 transition-colors"
          >
            <AlertTriangle className="w-3 h-3" />
            Send Intervention
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="section-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            Relationship Health
          </h2>
          <button
            onClick={handleViewDetails}
            className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <Eye className="w-3 h-3" />
            View Details
          </button>
        </div>

        {/* Health Score */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Overall Score</span>
            <HealthScoreBadge
              score={healthScore.overall_health_score}
              status={healthScore.health_status}
              trend={healthScore.health_trend}
              size="md"
            />
          </div>
        </div>

        {/* Signal Breakdown */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="p-2 bg-white/5 rounded">
            <p className="text-xs text-gray-400 mb-1">Communication</p>
            <p className="text-sm font-medium text-white">
              {healthScore.communication_frequency_score || 0}
            </p>
          </div>
          <div className="p-2 bg-white/5 rounded">
            <p className="text-xs text-gray-400 mb-1">Response</p>
            <p className="text-sm font-medium text-white">
              {healthScore.response_behavior_score || 0}
            </p>
          </div>
          <div className="p-2 bg-white/5 rounded">
            <p className="text-xs text-gray-400 mb-1">Engagement</p>
            <p className="text-sm font-medium text-white">
              {healthScore.engagement_quality_score || 0}
            </p>
          </div>
          <div className="p-2 bg-white/5 rounded">
            <p className="text-xs text-gray-400 mb-1">Sentiment</p>
            <p className="text-sm font-medium text-white">
              {healthScore.sentiment_score || 0}
            </p>
          </div>
        </div>

        {/* Ghost Risk Warning */}
        {hasGhostRisk && (
          <div
            className={`p-3 rounded-lg border mb-4 ${
              needsIntervention
                ? 'bg-red-500/10 border-red-500/30'
                : 'bg-yellow-500/10 border-yellow-500/30'
            }`}
          >
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle
                className={`w-4 h-4 mt-0.5 ${
                  needsIntervention ? 'text-red-400' : 'text-yellow-400'
                }`}
              />
              <div className="flex-1">
                <p
                  className={`text-sm font-medium ${
                    needsIntervention ? 'text-red-400' : 'text-yellow-400'
                  }`}
                >
                  {needsIntervention ? 'Critical' : 'Warning'}: Ghost Risk Detected
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {activeSignals.length} signal{activeSignals.length !== 1 ? 's' : ''} detected
                  {highSeveritySignals.length > 0 &&
                    ` (${highSeveritySignals.length} high severity)`}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowInterventionModal(true)}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${
                needsIntervention
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-yellow-500 text-gray-900 hover:bg-yellow-600'
              }`}
            >
              <Send className="w-4 h-4" />
              Send Intervention
            </button>
          </div>
        )}

        {/* Key Metrics */}
        {healthScore.days_since_last_contact !== null && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Last Contact</span>
              <span className="text-white">
                {healthScore.days_since_last_contact === 0
                  ? 'Today'
                  : `${healthScore.days_since_last_contact} days ago`}
              </span>
            </div>
            {healthScore.baseline_contact_frequency_days && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Expected Frequency</span>
                <span className="text-white">
                  Every {Math.round(healthScore.baseline_contact_frequency_days)} days
                </span>
              </div>
            )}
          </div>
        )}

        {/* View Full Dashboard Link */}
        <button
          onClick={handleViewDetails}
          className="w-full mt-4 flex items-center justify-center gap-2 px-3 py-2 bg-white/5 text-gray-300 rounded hover:bg-white/10 transition-colors text-sm"
        >
          <ExternalLink className="w-4 h-4" />
          Open Relationship Dashboard
        </button>
      </div>

      {/* Intervention Modal */}
      {showInterventionModal && healthScore && (
        <InterventionModal
          isOpen={showInterventionModal}
          onClose={() => setShowInterventionModal(false)}
          relationshipHealth={healthScore}
          ghostRisk={
            activeSignals.length > 0
              ? {
                  id: healthScore.id,
                  relationshipHealthId: healthScore.id,
                  contactId: relationshipType === 'contact' ? relationshipId : null,
                  companyId: relationshipType === 'company' ? relationshipId : null,
                  riskLevel: healthScore.health_status === 'ghost' ? 'critical' : 'high',
                  highestSeverity:
                    highSeveritySignals.length > 0
                      ? highSeveritySignals[0].severity
                      : activeSignals[0]?.severity || 'medium',
                  signalCount: activeSignals.length,
                  daysSinceLastContact: healthScore.days_since_last_contact || 0,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }
              : null
          }
          personalizedTemplate={null}
          onSendIntervention={async () => {
            setShowInterventionModal(false);
          }}
        />
      )}
    </>
  );
}
