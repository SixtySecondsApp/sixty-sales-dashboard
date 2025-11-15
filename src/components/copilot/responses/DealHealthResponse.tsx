import React from 'react';
import { DealHealthResponse as DealHealthResponseType } from '../types';
import { AlertTriangle, Clock, TrendingUp, CheckCircle2, BarChart3 } from 'lucide-react';

interface DealHealthResponseProps {
  data: DealHealthResponseType;
  onActionClick?: (action: string, data?: any) => void;
}

export const DealHealthResponse: React.FC<DealHealthResponseProps> = ({ data, onActionClick }) => {
  const { atRiskDeals, staleDeals, highValueDeals, likelyToClose, metrics } = data.data;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Metrics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm font-medium text-gray-400">At Risk</span>
          </div>
          <div className="text-2xl font-bold text-white">{metrics.totalAtRisk}</div>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-medium text-gray-400">Stale</span>
          </div>
          <div className="text-2xl font-bold text-white">{metrics.totalStale}</div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-gray-400">High Value</span>
          </div>
          <div className="text-2xl font-bold text-white">{metrics.totalHighValue}</div>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-sm font-medium text-gray-400">Likely to Close</span>
          </div>
          <div className="text-2xl font-bold text-white">{metrics.totalLikelyToClose}</div>
        </div>
      </div>

      {/* Average Health Score */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-400">Average Health Score</span>
          </div>
          <div className={`text-2xl font-bold ${getHealthScoreColor(metrics.averageHealthScore)}`}>
            {metrics.averageHealthScore}
          </div>
        </div>
      </div>

      {/* At Risk Deals */}
      {atRiskDeals.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            At Risk Deals ({atRiskDeals.length})
          </h3>
          <div className="space-y-3">
            {atRiskDeals.map((deal) => (
              <div key={deal.id} className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-white">{deal.name}</h4>
                    <p className="text-sm text-gray-400">{deal.stage}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-white">{formatCurrency(deal.value)}</div>
                    <div className={`text-sm ${getHealthScoreColor(deal.healthScore)}`}>
                      Score: {deal.healthScore}
                    </div>
                  </div>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="text-xs text-gray-400">
                    {deal.daysSinceActivity > 0 ? `${deal.daysSinceActivity} days since last activity` : 'No recent activity'}
                  </div>
                  {deal.riskFactors.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {deal.riskFactors.map((factor, idx) => (
                        <span key={idx} className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">
                          {factor}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 text-sm text-gray-300">{deal.recommendation}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stale Deals */}
      {staleDeals.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-500" />
            Stale Deals ({staleDeals.length})
          </h3>
          <div className="space-y-3">
            {staleDeals.map((deal) => (
              <div key={deal.id} className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-white">{deal.name}</h4>
                    <p className="text-sm text-gray-400">{deal.stage}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-white">{formatCurrency(deal.value)}</div>
                    <div className="text-sm text-yellow-400">{deal.daysInStage} days in stage</div>
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-300">{deal.recommendation}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* High Value Deals */}
      {highValueDeals.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            High Value Deals ({highValueDeals.length})
          </h3>
          <div className="space-y-3">
            {highValueDeals.map((deal) => (
              <div key={deal.id} className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-white">{deal.name}</h4>
                    <p className="text-sm text-gray-400">{deal.stage}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-white">{formatCurrency(deal.value)}</div>
                    <div className={`text-sm ${getHealthScoreColor(deal.healthScore)}`}>
                      Score: {deal.healthScore}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Likely to Close */}
      {likelyToClose.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            Likely to Close ({likelyToClose.length})
          </h3>
          <div className="space-y-3">
            {likelyToClose.map((deal) => (
              <div key={deal.id} className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-white">{deal.name}</h4>
                    <p className="text-sm text-gray-400">{deal.stage}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-white">{formatCurrency(deal.value)}</div>
                    <div className="text-sm text-green-400">
                      {deal.probability}% probability
                    </div>
                  </div>
                </div>
                {deal.closeDate && (
                  <div className="text-sm text-gray-400 mt-2">
                    Expected close: {new Date(deal.closeDate).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

