import React from 'react';
import { PipelineForecastResponse as PipelineForecastResponseType } from '../types';
import { TrendingUp, Target, AlertCircle, CheckCircle2, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface PipelineForecastResponseProps {
  data: PipelineForecastResponseType;
  onActionClick?: (action: string, data?: any) => void;
}

export const PipelineForecastResponse: React.FC<PipelineForecastResponseProps> = ({ data, onActionClick }) => {
  const { period, forecast, coverage, likelyToClose, atRisk, metrics } = data.data;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);
  };

  const forecastData = [
    { name: 'Worst Case', value: forecast.worstCase },
    { name: 'Most Likely', value: forecast.mostLikely },
    { name: 'Best Case', value: forecast.bestCase },
    { name: 'Weighted', value: forecast.weightedPipeline },
    { name: 'Committed', value: forecast.committed },
  ];

  const getCoverageStatusColor = () => {
    switch (coverage.status) {
      case 'exceeded': return 'text-green-500';
      case 'adequate': return 'text-yellow-500';
      default: return 'text-red-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Period Header */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white capitalize">{period.type} Forecast</h3>
            <p className="text-sm text-gray-400 mt-1">
              {period.label} ({new Date(period.startDate).toLocaleDateString()} - {new Date(period.endDate).toLocaleDateString()})
            </p>
          </div>
        </div>
      </div>

      {/* Forecast Breakdown */}
      <div>
        <h4 className="text-md font-semibold text-white mb-3">Forecast Breakdown</h4>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={forecastData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" tickFormatter={(value) => `$${value / 1000}k`} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
              />
              <Bar dataKey="value" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Worst Case</div>
            <div className="text-lg font-bold text-white">{formatCurrency(forecast.worstCase)}</div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Most Likely</div>
            <div className="text-lg font-bold text-white">{formatCurrency(forecast.mostLikely)}</div>
          </div>
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Best Case</div>
            <div className="text-lg font-bold text-white">{formatCurrency(forecast.bestCase)}</div>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Weighted</div>
            <div className="text-lg font-bold text-white">{formatCurrency(forecast.weightedPipeline)}</div>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Committed</div>
            <div className="text-lg font-bold text-white">{formatCurrency(forecast.committed)}</div>
          </div>
        </div>
      </div>

      {/* Coverage Metrics */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-gray-400" />
            <h4 className="font-semibold text-white">Pipeline Coverage</h4>
          </div>
          <div className={`text-2xl font-bold ${getCoverageStatusColor()}`}>
            {coverage.pipelineCoverage}%
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Target Revenue:</span>
            <span className="text-white ml-2 font-semibold">{formatCurrency(coverage.targetRevenue)}</span>
          </div>
          <div>
            <span className="text-gray-400">Coverage Ratio:</span>
            <span className="text-white ml-2 font-semibold">{coverage.coverageRatio.toFixed(2)}x</span>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>Coverage Status</span>
            <span className="capitalize">{coverage.status}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                coverage.status === 'exceeded' ? 'bg-green-500' :
                coverage.status === 'adequate' ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{ width: `${Math.min(coverage.pipelineCoverage, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-400 mb-1">Total Pipeline</div>
          <div className="text-xl font-bold text-white">{formatCurrency(metrics.totalPipelineValue)}</div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-400 mb-1">Weighted Value</div>
          <div className="text-xl font-bold text-white">{formatCurrency(metrics.weightedValue)}</div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-400 mb-1">Deals in Pipeline</div>
          <div className="text-xl font-bold text-white">{metrics.dealsInPipeline}</div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-400 mb-1">Avg Deal Size</div>
          <div className="text-xl font-bold text-white">{formatCurrency(metrics.averageDealSize)}</div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-400 mb-1">Avg Close Time</div>
          <div className="text-xl font-bold text-white">{metrics.averageCloseTime} days</div>
        </div>
        {metrics.forecastAccuracy && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="text-sm font-medium text-gray-400 mb-1">Forecast Accuracy</div>
            <div className="text-xl font-bold text-white">{metrics.forecastAccuracy}%</div>
          </div>
        )}
      </div>

      {/* Likely to Close */}
      {likelyToClose.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            Likely to Close ({likelyToClose.length})
          </h4>
          <div className="space-y-3">
            {likelyToClose.map((deal) => (
              <div key={deal.id} className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h5 className="font-semibold text-white">{deal.name}</h5>
                    <p className="text-sm text-gray-400">{deal.stage}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-white">{formatCurrency(deal.value)}</div>
                    <div className="text-sm text-green-400">{deal.probability}% probability</div>
                    {deal.closeDate && (
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(deal.closeDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* At Risk */}
      {atRisk.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            At Risk ({atRisk.length})
          </h4>
          <div className="space-y-3">
            {atRisk.map((deal) => (
              <div key={deal.id} className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h5 className="font-semibold text-white">{deal.name}</h5>
                    <p className="text-sm text-gray-400">{deal.stage}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-white">{formatCurrency(deal.value)}</div>
                    <div className="text-sm text-red-400">{deal.probability}% probability</div>
                    {deal.closeDate && (
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(deal.closeDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

