/**
 * Sales Coach Response Component
 * Displays comprehensive performance review with comparisons, insights, and recommendations
 */

import React from 'react';
import { TrendingUp, TrendingDown, Minus, CheckCircle2, AlertTriangle, Lightbulb, Target, BarChart3, DollarSign, Users, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { ActionButtons } from '../ActionButtons';
import type { SalesCoachResponse, MetricComparison, Insight, Recommendation } from '../types';

interface SalesCoachResponseProps {
  data: SalesCoachResponse;
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

const formatPercentage = (value: number): string => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

const getChangeIcon = (changeType: 'increase' | 'decrease' | 'neutral') => {
  switch (changeType) {
    case 'increase':
      return <ArrowUpRight className="w-4 h-4 text-emerald-400" />;
    case 'decrease':
      return <ArrowDownRight className="w-4 h-4 text-red-400" />;
    default:
      return <Minus className="w-4 h-4 text-gray-400" />;
  }
};

const getChangeColor = (changeType: 'increase' | 'decrease' | 'neutral') => {
  switch (changeType) {
    case 'increase':
      return 'text-emerald-400';
    case 'decrease':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
};

const getOverallBadgeColor = (overall: string) => {
  switch (overall) {
    case 'significantly_better':
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'better':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'similar':
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    case 'worse':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'significantly_worse':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

const MetricCard: React.FC<{
  label: string;
  current: number;
  previous: number;
  comparison: MetricComparison;
  formatValue?: (value: number) => string;
  icon?: React.ReactNode;
}> = ({ label, current, previous, comparison, formatValue = (v) => v.toString(), icon }) => {
  const changeColor = getChangeColor(comparison.changeType);
  const ChangeIcon = getChangeIcon(comparison.changeType);

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h4 className="text-sm font-medium text-gray-300">{label}</h4>
        </div>
        <div className={`flex items-center gap-1 ${changeColor}`}>
          {ChangeIcon}
          <span className="text-xs font-medium">{formatPercentage(comparison.change)}</span>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-gray-500">Current</span>
          <span className="text-lg font-semibold text-gray-100">{formatValue(current)}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-gray-500">Previous</span>
          <span className="text-sm text-gray-400">{formatValue(previous)}</span>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-gray-800/50">
        <p className="text-xs text-gray-400">{comparison.verdict}</p>
      </div>
    </div>
  );
};

const InsightCard: React.FC<{ insight: Insight }> = ({ insight }) => {
  const iconColors = {
    positive: 'text-emerald-400 bg-emerald-500/10',
    warning: 'text-amber-400 bg-amber-500/10',
    opportunity: 'text-blue-400 bg-blue-500/10',
    neutral: 'text-gray-400 bg-gray-500/10'
  };

  const Icon = insight.type === 'positive' ? CheckCircle2 : 
               insight.type === 'warning' ? AlertTriangle : 
               Lightbulb;

  return (
    <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/40 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${iconColors[insight.type]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h5 className="text-sm font-semibold text-gray-100 mb-1">{insight.title}</h5>
          <p className="text-xs text-gray-400">{insight.description}</p>
          {insight.impact && (
            <div className="mt-2">
              <span className={`text-xs px-2 py-1 rounded ${
                insight.impact === 'high' ? 'bg-red-500/20 text-red-400' :
                insight.impact === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {insight.impact} impact
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const RecommendationCard: React.FC<{ recommendation: Recommendation }> = ({ recommendation }) => {
  const priorityColors = {
    high: 'border-l-red-500 bg-red-500/5',
    medium: 'border-l-amber-500 bg-amber-500/5',
    low: 'border-l-blue-500 bg-blue-500/5'
  };

  return (
    <div className={`bg-gray-900/80 backdrop-blur-sm border-l-4 border border-gray-800/50 rounded-lg p-4 ${priorityColors[recommendation.priority]}`}>
      <div className="flex items-start gap-3">
        <Target className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h5 className="text-sm font-semibold text-gray-100">{recommendation.title}</h5>
            <span className={`text-xs px-2 py-0.5 rounded capitalize ${
              recommendation.priority === 'high' ? 'bg-red-500/20 text-red-400' :
              recommendation.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
              'bg-blue-500/20 text-blue-400'
            }`}>
              {recommendation.priority}
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-2">{recommendation.description}</p>
          {recommendation.actionItems && recommendation.actionItems.length > 0 && (
            <ul className="space-y-1">
              {recommendation.actionItems.map((item, idx) => (
                <li key={idx} className="text-xs text-gray-500 flex items-start gap-2">
                  <span className="text-gray-600 mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export const SalesCoachResponse: React.FC<SalesCoachResponseProps> = ({ data, onActionClick }) => {
  const { comparison, metrics, insights, recommendations, period } = data.data;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <p className="text-sm text-gray-300">{data.summary}</p>

      {/* Period Header */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-100 mb-1">
              Performance Comparison
            </h3>
            <p className="text-sm text-gray-400">
              {period.current.month} {period.current.year} (through day {period.current.day}) vs {period.previous.month} {period.previous.year} (through day {period.previous.day})
            </p>
          </div>
          <div className={`px-4 py-2 rounded-lg border ${getOverallBadgeColor(comparison.overall)}`}>
            <span className="text-sm font-medium capitalize">
              {comparison.overall.replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div>
        <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Key Metrics
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            label="Sales Revenue"
            current={metrics.currentMonth.totalRevenue}
            previous={metrics.previousMonth.totalRevenue}
            comparison={comparison.sales}
            formatValue={formatCurrency}
            icon={<DollarSign className="w-4 h-4 text-gray-400" />}
          />
          <MetricCard
            label="Closed Deals"
            current={metrics.currentMonth.closedDeals}
            previous={metrics.previousMonth.closedDeals}
            comparison={comparison.sales}
            icon={<CheckCircle2 className="w-4 h-4 text-gray-400" />}
          />
          <MetricCard
            label="Total Activities"
            current={metrics.currentMonth.totalActivities}
            previous={metrics.previousMonth.totalActivities}
            comparison={comparison.activities}
            icon={<Activity className="w-4 h-4 text-gray-400" />}
          />
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/40 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Meetings</div>
          <div className="text-lg font-semibold text-gray-100">{metrics.currentMonth.meetings}</div>
          <div className="text-xs text-gray-500 mt-1">vs {metrics.previousMonth.meetings} previous</div>
        </div>
        <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/40 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Outbound</div>
          <div className="text-lg font-semibold text-gray-100">{metrics.currentMonth.outboundActivities}</div>
          <div className="text-xs text-gray-500 mt-1">vs {metrics.previousMonth.outboundActivities} previous</div>
        </div>
        <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/40 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Avg Deal Value</div>
          <div className="text-lg font-semibold text-gray-100">{formatCurrency(metrics.currentMonth.averageDealValue)}</div>
          <div className="text-xs text-gray-500 mt-1">vs {formatCurrency(metrics.previousMonth.averageDealValue)} previous</div>
        </div>
        <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/40 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Pipeline Value</div>
          <div className="text-lg font-semibold text-gray-100">{formatCurrency(metrics.currentMonth.pipelineValue)}</div>
          <div className="text-xs text-gray-500 mt-1">Active opportunities</div>
        </div>
      </div>

      {/* Closed Deals */}
      {metrics.currentMonth.deals.filter(d => d.closedDate).length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Closed Deals This Month
          </h4>
          <div className="space-y-2">
            {metrics.currentMonth.deals
              .filter(d => d.closedDate)
              .map(deal => (
                <div key={deal.id} className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-100">{deal.name}</div>
                    <div className="text-xs text-gray-400">{deal.stage}</div>
                  </div>
                  <div className="text-sm font-semibold text-emerald-400">{formatCurrency(deal.value)}</div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <Lightbulb className="w-4 h-4" />
            Key Insights
          </h4>
          <div className="space-y-3">
            {insights.map(insight => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Recommendations
          </h4>
          <div className="space-y-3">
            {recommendations.map(rec => (
              <RecommendationCard key={rec.id} recommendation={rec} />
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {data.actions && data.actions.length > 0 && (
        <ActionButtons actions={data.actions} onActionClick={onActionClick} />
      )}
    </div>
  );
};

export default SalesCoachResponse;







