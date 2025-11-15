/**
 * Lead Response Component
 * Displays new leads, hot leads, and qualification needs
 */

import React from 'react';
import { TrendingUp, Users, AlertCircle } from 'lucide-react';
import { ActionButtons } from '../ActionButtons';
import type { LeadResponse, Lead } from '../types';

interface LeadResponseProps {
  data: LeadResponse;
  onActionClick?: (action: any) => void;
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const today = new Date();
  const daysDiff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff === 0) return 'Today';
  if (daysDiff === 1) return 'Yesterday';
  if (daysDiff < 7) return `${daysDiff} days ago`;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short'
  });
};

const getScoreColor = (score: number): string => {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-gray-400';
};

const LeadCard: React.FC<{ lead: Lead }> = ({ lead }) => {
  return (
    <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-lg p-4 border-l-4 border-l-blue-500">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h5 className="text-sm font-medium text-gray-100">{lead.name}</h5>
          <p className="text-xs text-gray-500">{lead.company}</p>
        </div>
        <div className="text-right ml-4">
          <div className={`text-lg font-semibold ${getScoreColor(lead.score)}`}>
            {lead.score}
          </div>
          <div className="text-xs text-gray-500">Score</div>
        </div>
      </div>
      
      <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
        <span>📧 {lead.email}</span>
        {lead.phone && <span>📞 {lead.phone}</span>}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Source:</span>
          <span className="text-xs text-gray-400">{lead.source}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Added:</span>
          <span className="text-xs text-gray-400">{formatDate(lead.createdAt)}</span>
        </div>
      </div>

      {lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {lead.tags.map((tag, i) => (
            <span
              key={i}
              className="px-2 py-1 text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: string | number; variant?: 'default' | 'success' }> = ({
  label,
  value,
  variant = 'default'
}) => {
  const variantColors = {
    success: 'text-emerald-400',
    default: 'text-gray-100'
  };

  return (
    <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/40 rounded-lg p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${variantColors[variant]}`}>{value}</div>
    </div>
  );
};

export const LeadResponse: React.FC<LeadResponseProps> = ({ data, onActionClick }) => {
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-300">{data.summary}</p>

      {/* Metrics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard 
          label="Total New" 
          value={data.data.metrics.totalNew} 
        />
        <MetricCard 
          label="Avg Score" 
          value={Math.round(data.data.metrics.avgScore)}
          variant="success"
        />
        <MetricCard 
          label="Conversion Rate" 
          value={`${data.data.metrics.conversionRate}%`}
        />
        <MetricCard 
          label="Needing Action" 
          value={data.data.metrics.needingAction}
        />
      </div>

      {/* Hot Leads */}
      {data.data.hotLeads.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Hot Leads ({data.data.hotLeads.length})
          </h4>
          {data.data.hotLeads.map(lead => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      )}

      {/* New Leads */}
      {data.data.newLeads.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
            <Users className="w-4 h-4" />
            New Leads ({data.data.newLeads.length})
          </h4>
          {data.data.newLeads.slice(0, 5).map(lead => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
          {data.data.newLeads.length > 5 && (
            <p className="text-xs text-gray-500">
              +{data.data.newLeads.length - 5} more leads
            </p>
          )}
        </div>
      )}

      {/* Needs Qualification */}
      {data.data.needsQualification.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Needs Qualification ({data.data.needsQualification.length})
          </h4>
          {data.data.needsQualification.slice(0, 5).map(lead => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
          {data.data.needsQualification.length > 5 && (
            <p className="text-xs text-gray-500">
              +{data.data.needsQualification.length - 5} more leads
            </p>
          )}
        </div>
      )}

      <ActionButtons actions={data.actions} onActionClick={onActionClick} />
    </div>
  );
};

export default LeadResponse;

