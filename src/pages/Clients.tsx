import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, List, TrendingUp, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AggregatedClientsTable } from '@/components/AggregatedClientsTable';
import { PaymentsTable } from '@/components/PaymentsTable';
import { SubscriptionStats } from '@/components/SubscriptionStats';
import logger from '@/lib/utils/logger';

export default function Clients() {
  const [viewMode, setViewMode] = useState<'aggregated' | 'detailed'>('aggregated');

  const handleStatsCardClick = (cardTitle: string) => {
    // Optional: Add filtering logic here
    logger.log(`Clicked on ${cardTitle} card`);
  };

  return (
    <div className="min-h-screen text-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white">
              Client & Payment Management
            </h1>
            <p className="text-gray-400">
              {viewMode === 'aggregated' 
                ? 'Aggregated view of unique clients with totals and metrics'
                : 'Detailed payment records with revenue tracking and individual deal management'
              }
            </p>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 bg-gray-900/50 rounded-lg p-1 border border-gray-800/50">
            <Button
              variant={viewMode === 'aggregated' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('aggregated')}
              className={`${
                viewMode === 'aggregated'
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Client Overview
            </Button>
            <Button
              variant={viewMode === 'detailed' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('detailed')}
              className={`${
                viewMode === 'detailed'
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <List className="w-4 h-4 mr-2" />
              Payment Records
            </Button>
          </div>
        </div>

        {/* Description based on view mode */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`description-${viewMode}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="bg-gray-900/30 rounded-lg p-4 border border-gray-800/30"
          >
            {viewMode === 'aggregated' ? (
              <div className="flex items-start gap-3">
                <BarChart3 className="w-5 h-5 text-emerald-400 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-white mb-1">Client Overview Mode</h3>
                  <p className="text-sm text-gray-400">
                    Shows unique clients with aggregated data including total payments, lifetime value, 
                    monthly MRR, active subscriptions, churn tracking, and last payment date. Perfect for high-level 
                    client relationship management and performance tracking.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <List className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-white mb-1">Payment Records Mode</h3>
                  <p className="text-sm text-gray-400">
                    Shows individual payment records and deals with comprehensive revenue tracking. 
                    Includes subscription management, one-off payments, deal values, and detailed 
                    financial analytics for precise transaction-level analysis.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Revenue Overview Stats - Only shown in Payment Records mode */}
        {viewMode === 'detailed' && (
          <motion.div
            key="revenue-stats"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <h2 className="text-xl font-semibold text-white">
              Revenue Overview
            </h2>
            <SubscriptionStats 
              onClick={handleStatsCardClick}
              className="w-full"
            />
          </motion.div>
        )}

        {/* Table Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`table-${viewMode}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
          >
            {viewMode === 'aggregated' ? (
              <AggregatedClientsTable className="w-full" />
            ) : (
              <PaymentsTable className="w-full" />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}