/**
 * Pipeline Response Component
 * Displays pipeline analysis with critical deals, metrics, and actions
 */

import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, Calendar, Mail } from 'lucide-react';
import { ActionButtons } from '../ActionButtons';
import { DealDetailsView } from './DealDetailsView';
import { StatsFirstView } from './StatsFirstView';
import type { PipelineResponse, Deal } from '../types';

interface PipelineResponseProps {
  data: PipelineResponse;
  onActionClick?: (action: any) => void;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

const MetricCard: React.FC<{ label: string; value: string | number; variant?: 'danger' | 'warning' | 'success' | 'default' }> = ({
  label,
  value,
  variant = 'default'
}) => {
  const variantColors = {
    danger: 'text-red-400',
    warning: 'text-amber-400',
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

const DealCard: React.FC<{ 
  deal: Deal; 
  urgency: 'critical' | 'high' | 'medium' | 'low';
  onDealClick?: (dealId: string) => void;
}> = ({
  deal,
  urgency,
  onDealClick
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const urgencyColors = {
    critical: 'border-l-red-500 bg-red-500/5',
    high: 'border-l-amber-500 bg-amber-500/5',
    medium: 'border-l-blue-500 bg-blue-500/5',
    low: 'border-l-gray-500 bg-gray-500/5'
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // If clicking the email button, don't expand
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    
    if (onDealClick) {
      onDealClick(deal.id);
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div 
      onClick={handleClick}
      className={`bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-lg p-4 border-l-4 ${urgencyColors[urgency]} cursor-pointer hover:bg-gray-900/90 hover:border-gray-700/50 transition-all group`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h5 className="text-sm font-medium text-gray-100 group-hover:text-blue-400 transition-colors">{deal.name}</h5>
          <p className="text-xs text-gray-500">
            {formatCurrency(deal.value)} · {deal.stage} · {deal.probability}% probability
          </p>
        </div>
        <div className="text-right ml-4">
          <div className="text-lg font-semibold text-gray-100">{deal.healthScore}</div>
          <div className="text-xs text-gray-500">Health</div>
        </div>
      </div>
      <p className={`text-xs text-gray-400 mb-3 ${isExpanded ? '' : 'line-clamp-2'}`}>
        {deal.reason}
      </p>
      
      {/* Expanded details */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-gray-800/50 space-y-2">
          <div className="text-xs text-gray-500">
            <div className="flex items-center justify-between mb-1">
              <span>Deal ID:</span>
              <span className="text-gray-300 font-mono text-[10px]">{deal.id.slice(0, 8)}...</span>
            </div>
            <div className="flex items-center justify-between mb-1">
              <span>Value:</span>
              <span className="text-gray-300">{formatCurrency(deal.value)}</span>
            </div>
            <div className="flex items-center justify-between mb-1">
              <span>Probability:</span>
              <span className="text-gray-300">{deal.probability}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Health Score:</span>
              <span className={`font-semibold ${
                deal.healthScore >= 70 ? 'text-emerald-400' :
                deal.healthScore >= 50 ? 'text-amber-400' :
                'text-red-400'
              }`}>
                {deal.healthScore}
              </span>
            </div>
          </div>
        </div>
      )}
      
      {deal.closeDate && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Calendar className="w-3 h-3" />
          Closes {formatDate(deal.closeDate)} ({deal.daysUntilClose} days)
        </div>
      )}
      
      <div className="mt-3 pt-3 border-t border-gray-800/50 flex items-center justify-between">
        {!isExpanded && (
          <div className="text-xs text-gray-600 cursor-pointer hover:text-gray-400">
            Click to view details
          </div>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onDealClick) {
              onDealClick(deal.id);
            }
          }}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg text-xs font-medium transition-colors"
        >
          <Mail className="w-3 h-3" />
          View & Email
        </button>
      </div>
    </div>
  );
};

export const PipelineResponse: React.FC<PipelineResponseProps> = React.memo(({ data, onActionClick }) => {
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState<{ subject: string; body: string } | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [showAllResults, setShowAllResults] = useState(false);

  const handleDealClick = (dealId: string) => {
    setSelectedDealId(dealId);
    setEmailDraft(null);
  };

  const handleCloseDealDetails = () => {
    setSelectedDealId(null);
    setEmailDraft(null);
  };

  const handleFilterSelect = (filterId: string, count: number) => {
    setSelectedFilter(filterId);
    setShowAllResults(true);
    // Scroll to the relevant section
    setTimeout(() => {
      const element = document.getElementById(`filter-${filterId}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleViewAll = () => {
    setShowAllResults(true);
    setSelectedFilter(null);
  };

  // If a deal is selected, show deal details view
  if (selectedDealId) {
    return (
      <div className="space-y-4">
        <DealDetailsView
          dealId={selectedDealId}
          onClose={handleCloseDealDetails}
          onEmailGenerated={setEmailDraft}
        />
        <button
          onClick={handleCloseDealDetails}
          className="text-sm text-gray-400 hover:text-gray-300"
        >
          ← Back to pipeline
        </button>
      </div>
    );
  }

  // Show stats-first view if enabled and user hasn't selected a filter yet
  if (data.data.showStatsFirst && !showAllResults) {
    const stats = [
      { label: 'Total Value', value: formatCurrency(data.data.metrics.totalValue) },
      { label: 'At Risk', value: data.data.metrics.dealsAtRisk, variant: 'danger' as const },
      { label: 'Closing This Week', value: data.data.metrics.closingThisWeek, variant: 'warning' as const },
      { label: 'Avg Health', value: data.data.metrics.avgHealthScore, variant: 'success' as const }
    ];

    const filterOptions = [
      { id: 'critical', label: 'Critical Deals', count: data.data.criticalDeals.length },
      { id: 'high-priority', label: 'High Priority Deals', count: data.data.highPriorityDeals.length },
      { id: 'all', label: 'All Deals', count: data.data.metrics.totalDeals }
    ];

    return (
      <div className="space-y-6">
        <p className="text-sm text-gray-300">{data.summary}</p>
        <StatsFirstView
          stats={stats}
          filterOptions={filterOptions}
          onFilterSelect={handleFilterSelect}
          onViewAll={handleViewAll}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <p className="text-sm text-gray-300">{data.summary}</p>

      {/* Metrics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard 
          label="Total Value" 
          value={formatCurrency(data.data.metrics.totalValue)} 
        />
        <MetricCard 
          label="At Risk" 
          value={data.data.metrics.dealsAtRisk}
          variant="danger"
        />
        <MetricCard 
          label="Closing This Week" 
          value={data.data.metrics.closingThisWeek}
          variant="warning"
        />
        <MetricCard 
          label="Avg Health" 
          value={data.data.metrics.avgHealthScore}
          variant="success"
        />
      </div>

      {/* Critical Deals */}
      {data.data.criticalDeals.length > 0 && (!selectedFilter || selectedFilter === 'critical' || selectedFilter === 'all') && (
        <div id="filter-critical" className="space-y-3">
          <h4 className="text-sm font-semibold text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Critical - Immediate Action Needed
          </h4>
          {data.data.criticalDeals.map(deal => (
            <DealCard key={deal.id} deal={deal} urgency="critical" onDealClick={handleDealClick} />
          ))}
        </div>
      )}

      {/* High Priority Deals */}
      {data.data.highPriorityDeals.length > 0 && (!selectedFilter || selectedFilter === 'high-priority' || selectedFilter === 'all') && (
        <div id="filter-high-priority" className="space-y-3">
          <h4 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            High Priority
          </h4>
          {data.data.highPriorityDeals.slice(0, selectedFilter === 'all' ? undefined : 5).map(deal => (
            <DealCard key={deal.id} deal={deal} urgency="high" onDealClick={handleDealClick} />
          ))}
          {!selectedFilter && data.data.highPriorityDeals.length > 5 && (
            <p className="text-xs text-gray-500">
              +{data.data.highPriorityDeals.length - 5} more deals
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <ActionButtons actions={data.actions} onActionClick={onActionClick} />
    </div>
  );
});

PipelineResponse.displayName = 'PipelineResponse';

export default PipelineResponse;

