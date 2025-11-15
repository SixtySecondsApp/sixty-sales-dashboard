/**
 * Pipeline Response Component
 * Displays pipeline analysis with critical deals, metrics, and actions
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, AlertTriangle, Calendar } from 'lucide-react';
import { ActionButtons } from '../ActionButtons';
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

const DealCard: React.FC<{ deal: Deal; urgency: 'critical' | 'high' | 'medium' | 'low' }> = ({
  deal,
  urgency
}) => {
  const navigate = useNavigate();
  const urgencyColors = {
    critical: 'border-l-red-500 bg-red-500/5',
    high: 'border-l-amber-500 bg-amber-500/5',
    medium: 'border-l-blue-500 bg-blue-500/5',
    low: 'border-l-gray-500 bg-gray-500/5'
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(`/crm/deals/${deal.id}?returnTo=${encodeURIComponent(window.location.pathname)}`);
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
      <p className="text-xs text-gray-400 mb-3">{deal.reason}</p>
      {deal.closeDate && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Calendar className="w-3 h-3" />
          Closes {formatDate(deal.closeDate)} ({deal.daysUntilClose} days)
        </div>
      )}
    </div>
  );
};

export const PipelineResponse: React.FC<PipelineResponseProps> = ({ data, onActionClick }) => {
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
      {data.data.criticalDeals.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Critical - Immediate Action Needed
          </h4>
          {data.data.criticalDeals.map(deal => (
            <DealCard key={deal.id} deal={deal} urgency="critical" />
          ))}
        </div>
      )}

      {/* High Priority Deals */}
      {data.data.highPriorityDeals.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            High Priority
          </h4>
          {data.data.highPriorityDeals.slice(0, 5).map(deal => (
            <DealCard key={deal.id} deal={deal} urgency="high" />
          ))}
          {data.data.highPriorityDeals.length > 5 && (
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
};

export default PipelineResponse;

