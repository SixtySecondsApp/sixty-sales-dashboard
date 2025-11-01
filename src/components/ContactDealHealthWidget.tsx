/**
 * Contact Deal Health Widget
 *
 * Shows aggregated health metrics for all deals associated with a contact
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
} from 'lucide-react';
import { useContactDealHealth } from '@/lib/hooks/useDealHealth';
import { DealHealthBadge, DealHealthDot } from './DealHealthBadge';
import { motion, AnimatePresence } from 'framer-motion';

interface ContactDealHealthWidgetProps {
  contactId: string;
  className?: string;
}

export function ContactDealHealthWidget({
  contactId,
  className = '',
}: ContactDealHealthWidgetProps) {
  const navigate = useNavigate();
  const { healthScores, aggregateStats, loading, refresh } = useContactDealHealth(contactId);
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-16 bg-gray-100 dark:bg-gray-700/50 rounded" />
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
          No active deals for this contact
        </p>
      </div>
    );
  }

  const healthColor = aggregateStats.avgHealth >= 75 ? 'text-green-600 dark:text-green-400' :
                      aggregateStats.avgHealth >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-red-600 dark:text-red-400';

  return (
    <div className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Deal Health
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

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
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

        {/* Health Distribution */}
        <div className="mt-3 flex items-center justify-between text-xs">
          {aggregateStats.healthy > 0 && (
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-gray-600 dark:text-gray-400">{aggregateStats.healthy} Healthy</span>
            </div>
          )}
          {aggregateStats.warning > 0 && (
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-yellow-500" />
              <span className="text-gray-600 dark:text-gray-400">{aggregateStats.warning} At Risk</span>
            </div>
          )}
          {aggregateStats.critical > 0 && (
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-gray-600 dark:text-gray-400">{aggregateStats.critical} Critical</span>
            </div>
          )}
        </div>

        {/* Active Alerts */}
        {aggregateStats.activeAlerts > 0 && (
          <div className="mt-3 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400">
              <AlertTriangle className="h-3 w-3" />
              <span className="font-medium">{aggregateStats.activeAlerts} Active Alert{aggregateStats.activeAlerts > 1 ? 's' : ''}</span>
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
            <div className="max-h-64 overflow-y-auto">
              {healthScores.map((score) => (
                <div
                  key={score.id}
                  className="p-3 border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/crm/deals/${score.deal_id}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <DealHealthDot healthScore={score} size="sm" />
                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          Deal {score.deal_id.slice(0, 8)}...
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${
                          score.overall_health_score >= 75 ? 'text-green-600 dark:text-green-400' :
                          score.overall_health_score >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>
                          {score.overall_health_score}
                        </span>
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {score.days_in_current_stage} days in stage
                        </span>
                      </div>
                      {score.risk_factors && score.risk_factors.length > 0 && (
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {score.risk_factors[0].replace(/_/g, ' ')}
                        </div>
                      )}
                    </div>
                    <ExternalLink className="h-3 w-3 text-gray-400 flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
