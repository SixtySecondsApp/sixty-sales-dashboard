/**
 * Relationship Detail Modal Component
 *
 * Shows detailed information about a relationship including timeline, health metrics, and actions.
 */

import React from 'react';
import { X, ExternalLink, User, Building2 } from 'lucide-react';
import { RelationshipTimeline } from './RelationshipTimeline';
import { HealthScoreBadge } from './HealthScoreBadge';
import { RelationshipAvatar } from './RelationshipAvatar';
import type { RelationshipHealthScore } from '@/lib/services/relationshipHealthService';

interface RelationshipDetailModalProps {
  relationship: RelationshipHealthScore;
  relationshipName: string;
  userId: string;
  relationshipInfo?: { name: string; type: 'contact' | 'company'; email?: string; domain?: string };
  onClose: () => void;
  onViewContact?: () => void;
  onViewCompany?: () => void;
}

export function RelationshipDetailModal({
  relationship,
  relationshipName,
  userId,
  relationshipInfo,
  onClose,
  onViewContact,
  onViewCompany,
}: RelationshipDetailModalProps) {
  const contactId = relationship.relationship_type === 'contact' ? relationship.contact_id : null;
  const companyId = relationship.relationship_type === 'company' ? relationship.company_id : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-6xl max-h-[90vh] bg-gray-900 border border-white/10 rounded-lg shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-4">
            <RelationshipAvatar
              name={relationshipName}
              type={relationship.relationship_type}
              domain={relationshipInfo?.domain}
              email={relationshipInfo?.email}
              size="lg"
            />
            <div>
              <h2 className="text-2xl font-bold text-white">{relationshipName}</h2>
              <p className="text-sm text-gray-400 mt-1">
                {relationship.relationship_type === 'contact' ? 'Contact' : 'Company'} Relationship Health
                {relationshipInfo?.email && (
                  <span className="ml-2 text-gray-500">• {relationshipInfo.email}</span>
                )}
              </p>
            </div>
            <HealthScoreBadge
              score={relationship.overall_health_score}
              status={relationship.health_status}
              trend={relationship.sentiment_trend === 'improving' ? 'improving' :
                     relationship.sentiment_trend === 'declining' ? 'declining' : 'stable'}
              size="md"
            />
          </div>
          <div className="flex items-center gap-2">
            {relationship.relationship_type === 'contact' && onViewContact && (
              <button
                onClick={onViewContact}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <User className="w-4 h-4" />
                View Contact
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
            {relationship.relationship_type === 'company' && onViewCompany && (
              <button
                onClick={onViewCompany}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Building2 className="w-4 h-4" />
                View Company
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Health Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <MetricBox label="Communication" value={relationship.communication_frequency_score || 0} />
              <MetricBox label="Response" value={relationship.response_behavior_score || 0} />
              <MetricBox label="Engagement" value={relationship.engagement_quality_score || 0} />
              <MetricBox label="Sentiment" value={relationship.sentiment_score || 0} />
              <MetricBox label="Meetings" value={relationship.meeting_pattern_score || 0} />
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InfoBox
                label="Days Since Last Contact"
                value={relationship.days_since_last_contact !== null ? `${relationship.days_since_last_contact} days` : 'N/A'}
              />
              <InfoBox
                label="Days Since Last Response"
                value={relationship.days_since_last_response !== null ? `${relationship.days_since_last_response} days` : 'N/A'}
              />
              <InfoBox
                label="Response Rate"
                value={relationship.response_rate_percent !== null ? `${relationship.response_rate_percent}%` : 'N/A'}
              />
              <InfoBox
                label="Email Open Rate"
                value={relationship.email_open_rate_percent !== null ? `${relationship.email_open_rate_percent}%` : 'N/A'}
              />
            </div>

            {/* Timeline */}
            {contactId && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Communication Timeline</h3>
                <RelationshipTimeline
                  contactId={contactId}
                  userId={userId}
                  showHealthChanges={true}
                  showGhostSignals={true}
                  showInterventions={true}
                />
              </div>
            )}
            {!contactId && companyId && (
              <div className="text-center py-12 bg-white/5 border border-white/10 rounded-lg">
                <p className="text-gray-400">Timeline view is currently available for contacts only</p>
                <p className="text-sm text-gray-500 mt-2">Company timeline coming soon</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface MetricBoxProps {
  label: string;
  value: number;
}

function MetricBox({ label, value }: MetricBoxProps) {
  return (
    <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

interface InfoBoxProps {
  label: string;
  value: string;
}

function InfoBox({ label, value }: InfoBoxProps) {
  return (
    <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className="text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

