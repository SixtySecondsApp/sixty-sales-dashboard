/**
 * ContentTopics Page
 *
 * Global Topic Aggregator for content generation
 * Features:
 * - Browse aggregated topics from all meetings
 * - Filter by date, company, contact, meeting type, tags
 * - Sort by frequency, recency, relevance
 * - View topic sources and generate content
 * - Configure tone settings per content type
 */

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sparkles,
  TrendingUp,
  Clock,
  BarChart3,
  RefreshCw,
  Settings2,
  Grid3X3,
  List,
  Layers,
  AlertCircle,
  Building2,
  Users,
} from 'lucide-react';
import { useUser } from '@/lib/hooks/useUser';
import {
  useGlobalTopics,
  useGlobalTopicsStats,
  usePendingAggregationCount,
  useAggregateTopics,
  useGlobalTopicsFilters,
} from '@/lib/hooks/useGlobalTopics';
import { ContentTopicsFilters } from '@/components/content-topics/ContentTopicsFilters';
import { TopicsExplorer } from '@/components/content-topics/TopicsExplorer';
import { ToneSettingsPanel } from '@/components/content-topics/ToneSettingsPanel';
import { toast } from 'sonner';

type ViewMode = 'grid' | 'list' | 'clusters';

export default function ContentTopics() {
  const { userData: user } = useUser();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showToneSettings, setShowToneSettings] = useState(false);

  // Filter state management
  const {
    filters,
    sortBy,
    page,
    setFilter,
    clearFilters,
    setDateRange,
    setSearchQuery,
    setCompanyFilter,
    setContactFilter,
    setSortBy,
    setPage,
    buildParams,
  } = useGlobalTopicsFilters();

  // Data fetching
  const { data: topicsData, isLoading, error, refetch } = useGlobalTopics(
    buildParams(true),
    { enabled: !!user }
  );
  const { data: stats } = useGlobalTopicsStats();
  const { data: pendingCount } = usePendingAggregationCount();
  const aggregateMutation = useAggregateTopics();

  // Handle aggregation trigger
  const handleAggregate = useCallback(async () => {
    try {
      await aggregateMutation.mutateAsync({ mode: 'incremental' });
      toast.success('Topics aggregated successfully!');
      refetch();
    } catch (error) {
      toast.error('Failed to aggregate topics');
    }
  }, [aggregateMutation, refetch]);

  // Loading state
  if (isLoading && !topicsData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading global topics...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Error Loading Topics
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {error instanceof Error ? error.message : 'Failed to load topics'}
          </p>
          <Button onClick={() => refetch()}>Try Again</Button>
        </div>
      </div>
    );
  }

  const topics = topicsData?.topics || [];
  const pagination = topicsData?.pagination;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
              <Layers className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Content Topics
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Aggregated topics from all your meetings
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Pending aggregation badge */}
            {pendingCount && pendingCount > 0 && (
              <Badge
                variant="outline"
                className="text-amber-600 border-amber-600/30 bg-amber-50 dark:bg-amber-900/20"
              >
                {pendingCount} pending
              </Badge>
            )}

            {/* Aggregate button */}
            <Button
              onClick={handleAggregate}
              disabled={aggregateMutation.isPending}
              variant="outline"
              size="sm"
              className="gap-1 dark:text-white"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  aggregateMutation.isPending ? 'animate-spin' : ''
                }`}
              />
              {aggregateMutation.isPending ? 'Aggregating...' : 'Refresh'}
            </Button>

            {/* Tone settings toggle */}
            <Button
              onClick={() => setShowToneSettings(!showToneSettings)}
              variant={showToneSettings ? 'default' : 'outline'}
              size="sm"
              className="gap-1 dark:text-white"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Tone
            </Button>
          </div>
        </motion.div>

        {/* Stats Cards - matching dashboard style */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
          >
            <div className="bg-white dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                    Total Topics
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                    {stats.total_topics || 0}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                    Meetings
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                    {stats.total_meetings || 0}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-teal-600 dark:text-teal-400 uppercase tracking-wide">
                    Companies
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                    {stats.total_companies || 0}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    Avg Sources
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                    {stats.avg_sources_per_topic?.toFixed(1) || '0'}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center">
                  <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tone Settings Panel (Collapsible) */}
        {showToneSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6"
          >
            <ToneSettingsPanel onClose={() => setShowToneSettings(false)} />
          </motion.div>
        )}

        {/* Filters and Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <div className="bg-white dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700/50">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Filters */}
              <ContentTopicsFilters
                filters={filters}
                onSearchChange={setSearchQuery}
                onDateRangeChange={setDateRange}
                onCompanyChange={setCompanyFilter}
                onContactChange={setContactFilter}
                onClearFilters={clearFilters}
              />

              {/* View and Sort Controls */}
              <div className="flex items-center gap-4">
                {/* Sort dropdown */}
                <Tabs
                  value={sortBy}
                  onValueChange={(v) => setSortBy(v as typeof sortBy)}
                  className="hidden sm:block"
                >
                  <TabsList className="h-9 bg-gray-100 dark:bg-gray-800">
                    <TabsTrigger value="relevance" className="text-xs px-3">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Relevance
                    </TabsTrigger>
                    <TabsTrigger value="frequency" className="text-xs px-3">
                      <BarChart3 className="w-3 h-3 mr-1" />
                      Frequency
                    </TabsTrigger>
                    <TabsTrigger value="recency" className="text-xs px-3">
                      <Clock className="w-3 h-3 mr-1" />
                      Recent
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* View mode toggle */}
                <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-md transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-white dark:bg-gray-700 shadow-sm text-emerald-600 dark:text-emerald-400'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                    aria-label="Grid view"
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-md transition-colors ${
                      viewMode === 'list'
                        ? 'bg-white dark:bg-gray-700 shadow-sm text-emerald-600 dark:text-emerald-400'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                    aria-label="List view"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('clusters')}
                    className={`p-2 rounded-md transition-colors ${
                      viewMode === 'clusters'
                        ? 'bg-white dark:bg-gray-700 shadow-sm text-emerald-600 dark:text-emerald-400'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                    aria-label="Cluster view"
                  >
                    <Layers className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Topics Explorer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <TopicsExplorer
            topics={topics}
            viewMode={viewMode}
            isLoading={isLoading}
            pagination={pagination}
            onPageChange={setPage}
          />
        </motion.div>
      </div>
    </div>
  );
}
