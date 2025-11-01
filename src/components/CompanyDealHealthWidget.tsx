/**
 * Company Deal Health Widget
 *
 * Shows aggregated health metrics for all deals associated with a company
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
  DollarSign,
} from 'lucide-react';
import { useCompanyDealHealth } from '@/lib/hooks/useDealHealth';
import { DealHealthBadge, DealHealthDot } from './DealHealthBadge';
import { motion, AnimatePresence } from 'framer-motion';

interface CompanyDealHealthWidgetProps {
  companyId: string;
  className?: string;
}

export function CompanyDealHealthWidget({
  companyId,
  className = '',
}: CompanyDealHealthWidgetProps) {
  const navigate = useNavigate();
  const { healthScores, aggregateStats, loading, refresh } = useCompanyDealHealth(companyId);
  const [expanded, setExpanded] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <div className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-20 bg-gray-100 dark:bg-gray-700/50 rounded" />
        </div>
      </div>
    );
  }

  if (aggregateStats.totalDeals === 0) {
    return (
      <div className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-5 w-5 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Deal Health
          </h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No active deals for this company
        </p>
      </div>
    );
  }

  const healthColor = aggregateStats.avgHealth >= 75 ? 'text-green-600 dark:text-green-400' :
                      aggregateStats.avgHealth >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-red-600 dark:text-red-400';

  const atRiskPercentage = aggregateStats.totalValue > 0
    ? Math.round((aggregateStats.atRiskValue / aggregateStats.totalValue) * 100)
    : 0;

  return (
    <div className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Pipeline Health
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refresh()}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              title="Refresh health scores"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Primary Stats */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-900/50">
            <div className={`text-2xl font-bold ${healthColor}`}>
              {aggregateStats.avgHealth}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Avg Health</div>
          </div>

          <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-900/50">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {aggregateStats.totalDeals}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Active Deals</div>
          </div>
        </div>

        {/* Pipeline Value */}
        <div className="p-3 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Total Pipeline</span>
            <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-lg font-bold text-blue-900 dark:text-blue-100">
            {formatCurrency(aggregateStats.totalValue)}
          </div>
          {aggregateStats.atRiskValue > 0 && (
            <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-800/50">
              <div className="flex items-center justify-between text-xs">
                <span className="text-red-700 dark:text-red-400 font-medium">At Risk</span>
                <span className="text-red-900 dark:text-red-300 font-semibold">
                  {formatCurrency(aggregateStats.atRiskValue)} ({atRiskPercentage}%)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Health Distribution */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          {aggregateStats.healthy > 0 && (
            <div className="flex items-center gap-1.5 p-2 rounded bg-green-50 dark:bg-green-900/20">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-green-700 dark:text-green-400 font-medium">{aggregateStats.healthy} Healthy</span>
            </div>
          )}
          {aggregateStats.warning > 0 && (
            <div className="flex items-center gap-1.5 p-2 rounded bg-yellow-50 dark:bg-yellow-900/20">
              <div className="h-2 w-2 rounded-full bg-yellow-500" />
              <span className="text-yellow-700 dark:text-yellow-400 font-medium">{aggregateStats.warning} Warning</span>
            </div>
          )}
          {aggregateStats.critical > 0 && (
            <div className="flex items-center gap-1.5 p-2 rounded bg-red-50 dark:bg-red-900/20">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-red-700 dark:text-red-400 font-medium">{aggregateStats.critical} Critical</span>
            </div>
          )}
          {aggregateStats.stalled > 0 && (
            <div className="flex items-center gap-1.5 p-2 rounded bg-gray-50 dark:bg-gray-900/20">
              <div className="h-2 w-2 rounded-full bg-gray-500" />
              <span className="text-gray-700 dark:text-gray-400 font-medium">{aggregateStats.stalled} Stalled</span>
            </div>
          )}
        </div>

        {/* Active Alerts */}
        {aggregateStats.activeAlerts > 0 && (
          <div className="mt-3 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400">
              <AlertTriangle className="h-3 w-3" />
              <span className="font-medium">{aggregateStats.activeAlerts} Active Alert{aggregateStats.activeAlerts > 1 ? 's' : ''} Requiring Attention</span>
            </div>
          </div>
        )}
      </div>

      {/* Expanded Deal List */}
      <AnimatePresence>
        {expanded && healthScores.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-gray-200 dark:border-gray-700"
          >
            <div className="max-h-80 overflow-y-auto">
              {healthScores
                .sort((a, b) => a.overall_health_score - b.overall_health_score) // Worst first
                .map((score) => (
                  <div
                    key={score.id}
                    className="p-3 border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors cursor-pointer"
                    onClick={() => navigate(`/crm/deals/${score.deal_id}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <DealHealthDot healthScore={score} size="sm" />
                          <span className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                            Deal {score.deal_id.slice(0, 8)}...
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className={`text-xs font-semibold ${
                            score.overall_health_score >= 75 ? 'text-green-600 dark:text-green-400' :
                            score.overall_health_score >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            Health: {score.overall_health_score}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {score.days_in_current_stage}d in stage
                          </span>
                        </div>
                        {score.risk_factors && score.risk_factors.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {score.risk_factors.slice(0, 2).map((factor, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                              >
                                {factor.replace(/_/g, ' ')}
                              </span>
                            ))}
                            {score.risk_factors.length > 2 && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                +{score.risk_factors.length - 2} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <ExternalLink className="h-3 w-3 text-gray-400 flex-shrink-0" />
                    </div>
                  </div>
                ))}
            </div>

            {/* View All Link */}
            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 text-center">
              <button
                onClick={() => navigate('/health')}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                View Full Health Dashboard →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
