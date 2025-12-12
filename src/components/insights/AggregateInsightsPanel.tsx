/**
 * Aggregate Insights Panel Component
 *
 * Allows users to query aggregate meeting insights:
 * - Natural language queries
 * - Quick stat filters
 * - Meeting list results
 * - Statistical breakdowns
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  TrendingUp,
  DollarSign,
  Users,
  MessageSquare,
  Shield,
  Target,
  Calendar,
  Loader2,
  Filter,
  ChevronRight,
  BarChart3,
  List,
  Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAggregateInsights, useQuickStats } from '@/lib/hooks/useAggregateInsights';

interface AggregateInsightsPanelProps {
  className?: string;
}

export function AggregateInsightsPanel({ className }: AggregateInsightsPanelProps) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'quick' | 'search' | 'filter'>('quick');
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    from: '',
    to: '',
  });

  const { stats, loading: statsLoading, refresh: refreshStats } = useQuickStats(30);
  const {
    result,
    loading,
    error,
    queryNatural,
    queryInsights,
    reset,
  } = useAggregateInsights();

  useEffect(() => {
    refreshStats();
  }, []);

  const handleNaturalQuery = async () => {
    if (!query.trim()) return;
    await queryNatural(query);
  };

  const handleQuickFilter = async (filterType: string) => {
    setSelectedFilter(filterType);

    const filters: Record<string, any> = {
      forward_movement: { has_forward_movement: true },
      proposal_request: { has_proposal_request: true },
      competitor: { has_competitor_mention: true },
      pricing: { has_pricing_discussion: true },
      objection: { has_objection: true },
      positive: { outcome: 'positive' },
      negative: { outcome: 'negative' },
    };

    const filter = filters[filterType] || {};
    if (dateRange.from) filter.date_from = dateRange.from;
    if (dateRange.to) filter.date_to = dateRange.to;

    await queryInsights('list', filter, 20);
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b">
        <TabButton
          active={activeTab === 'quick'}
          onClick={() => { setActiveTab('quick'); reset(); }}
          icon={BarChart3}
          label="Quick Stats"
        />
        <TabButton
          active={activeTab === 'search'}
          onClick={() => { setActiveTab('search'); reset(); }}
          icon={Search}
          label="Ask a Question"
        />
        <TabButton
          active={activeTab === 'filter'}
          onClick={() => { setActiveTab('filter'); reset(); }}
          icon={Filter}
          label="Filter Meetings"
        />
      </div>

      {/* Quick Stats View */}
      {activeTab === 'quick' && (
        <QuickStatsView stats={stats} loading={statsLoading} />
      )}

      {/* Natural Language Search */}
      {activeTab === 'search' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNaturalQuery()}
              placeholder="Ask a question like 'How many calls this month mentioned competitors?'"
              className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <ExampleQuery
              query="How many calls this month had forward movement?"
              onClick={() => { setQuery("How many calls this month had forward movement?"); }}
            />
            <ExampleQuery
              query="Show me calls where pricing was discussed"
              onClick={() => { setQuery("Show me calls where pricing was discussed"); }}
            />
            <ExampleQuery
              query="What % of calls had objections?"
              onClick={() => { setQuery("What % of calls had objections?"); }}
            />
          </div>

          <button
            onClick={handleNaturalQuery}
            disabled={loading || !query.trim()}
            className="w-full py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Search
              </>
            )}
          </button>
        </div>
      )}

      {/* Filter View */}
      {activeTab === 'filter' && (
        <div className="space-y-4">
          {/* Date Range */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm text-muted-foreground mb-1 block">From</label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm text-muted-foreground mb-1 block">To</label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          </div>

          {/* Quick Filters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <FilterButton
              label="Forward Movement"
              icon={TrendingUp}
              active={selectedFilter === 'forward_movement'}
              onClick={() => handleQuickFilter('forward_movement')}
              color="green"
            />
            <FilterButton
              label="Proposals"
              icon={Target}
              active={selectedFilter === 'proposal_request'}
              onClick={() => handleQuickFilter('proposal_request')}
              color="blue"
            />
            <FilterButton
              label="Competitors"
              icon={Shield}
              active={selectedFilter === 'competitor'}
              onClick={() => handleQuickFilter('competitor')}
              color="orange"
            />
            <FilterButton
              label="Pricing"
              icon={DollarSign}
              active={selectedFilter === 'pricing'}
              onClick={() => handleQuickFilter('pricing')}
              color="purple"
            />
            <FilterButton
              label="Objections"
              icon={MessageSquare}
              active={selectedFilter === 'objection'}
              onClick={() => handleQuickFilter('objection')}
              color="yellow"
            />
            <FilterButton
              label="Positive"
              icon={TrendingUp}
              active={selectedFilter === 'positive'}
              onClick={() => handleQuickFilter('positive')}
              color="green"
            />
            <FilterButton
              label="Negative"
              icon={Users}
              active={selectedFilter === 'negative'}
              onClick={() => handleQuickFilter('negative')}
              color="red"
            />
          </div>
        </div>
      )}

      {/* Results */}
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center py-8"
          >
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </motion.div>
        )}

        {!loading && result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Counts Result */}
            {result.counts && <CountsResult counts={result.counts} />}

            {/* Meetings List */}
            {result.meetings && result.meetings.length > 0 && (
              <MeetingsList meetings={result.meetings} />
            )}

            {/* Stats Result */}
            {result.stats && <StatsResult stats={result.stats} />}
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg"
          >
            <p className="text-sm text-red-600">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-components

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2 text-sm border-b-2 transition-colors',
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function QuickStatsView({ stats, loading }: { stats: any; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-24 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        label="Total Meetings"
        value={stats.totalMeetings}
        icon={Calendar}
        color="blue"
      />
      <StatCard
        label="Forward Movement"
        value={stats.forwardMovementCount}
        subValue={`${stats.forwardMovementRate}%`}
        icon={TrendingUp}
        color="green"
      />
      <StatCard
        label="Proposals Requested"
        value={stats.proposalRequestCount}
        icon={Target}
        color="purple"
      />
      <StatCard
        label="Competitors Mentioned"
        value={stats.competitorMentionCount}
        icon={Shield}
        color="orange"
      />
      <StatCard
        label="Objections Raised"
        value={stats.objectionCount}
        icon={MessageSquare}
        color="yellow"
      />
      <StatCard
        label="Positive Outcomes"
        value={stats.positiveOutcomeCount}
        subValue={`${stats.positiveOutcomeRate}%`}
        icon={TrendingUp}
        color="green"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  subValue,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | string;
  subValue?: string;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'yellow' | 'red';
}) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-600',
    green: 'bg-green-500/10 text-green-600',
    purple: 'bg-purple-500/10 text-purple-600',
    orange: 'bg-orange-500/10 text-orange-600',
    yellow: 'bg-yellow-500/10 text-yellow-600',
    red: 'bg-red-500/10 text-red-600',
  };

  return (
    <div className="p-4 rounded-lg border bg-muted/30">
      <div className={cn('inline-flex p-2 rounded-lg mb-2', colorClasses[color])}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {subValue && <p className="text-sm text-muted-foreground">{subValue}</p>}
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function FilterButton({
  label,
  icon: Icon,
  active,
  onClick,
  color,
}: {
  label: string;
  icon: React.ElementType;
  active: boolean;
  onClick: () => void;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'yellow' | 'red';
}) {
  const colorClasses = {
    blue: 'border-blue-500 bg-blue-500/10 text-blue-600',
    green: 'border-green-500 bg-green-500/10 text-green-600',
    purple: 'border-purple-500 bg-purple-500/10 text-purple-600',
    orange: 'border-orange-500 bg-orange-500/10 text-orange-600',
    yellow: 'border-yellow-500 bg-yellow-500/10 text-yellow-600',
    red: 'border-red-500 bg-red-500/10 text-red-600',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all',
        active ? colorClasses[color] : 'border-muted hover:bg-muted/50'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function ExampleQuery({ query, onClick }: { query: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 text-xs bg-muted rounded-full hover:bg-muted/80 transition-colors"
    >
      {query}
    </button>
  );
}

function CountsResult({ counts }: { counts: any }) {
  return (
    <div className="p-4 bg-muted/30 rounded-lg">
      <h4 className="font-medium mb-3 flex items-center gap-2">
        <Hash className="h-4 w-4" />
        Results Summary
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="text-center">
          <p className="text-xl font-bold">{counts.total_meetings || counts.filtered_count}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-green-600">{counts.forward_movement_count}</p>
          <p className="text-xs text-muted-foreground">Forward</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-blue-600">{counts.proposal_request_count}</p>
          <p className="text-xs text-muted-foreground">Proposals</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-orange-600">{counts.competitor_mention_count}</p>
          <p className="text-xs text-muted-foreground">Competitors</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-yellow-600">{counts.objection_count}</p>
          <p className="text-xs text-muted-foreground">Objections</p>
        </div>
      </div>
    </div>
  );
}

function MeetingsList({ meetings }: { meetings: any[] }) {
  return (
    <div className="space-y-2">
      <h4 className="font-medium flex items-center gap-2">
        <List className="h-4 w-4" />
        Meetings ({meetings.length})
      </h4>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {meetings.map((meeting, i) => (
          <div
            key={meeting.meeting_id || i}
            className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">{meeting.meeting_title || 'Untitled Meeting'}</p>
                <p className="text-xs text-muted-foreground">
                  {meeting.company_name} • {meeting.owner_name}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                {meeting.meeting_date ? new Date(meeting.meeting_date).toLocaleDateString() : 'N/A'}
              </p>
              {meeting.outcome && (
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded',
                  meeting.outcome === 'positive' && 'bg-green-500/10 text-green-600',
                  meeting.outcome === 'neutral' && 'bg-gray-500/10 text-gray-600',
                  meeting.outcome === 'negative' && 'bg-red-500/10 text-red-600'
                )}>
                  {meeting.outcome}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsResult({ stats }: { stats: any }) {
  return (
    <div className="space-y-4">
      <h4 className="font-medium flex items-center gap-2">
        <BarChart3 className="h-4 w-4" />
        Detailed Statistics
      </h4>

      {/* Top Objections */}
      {stats.top_objections?.length > 0 && (
        <div className="p-4 bg-muted/30 rounded-lg">
          <h5 className="text-sm font-medium mb-2">Top Objections</h5>
          <div className="space-y-2">
            {stats.top_objections.map((obj: any, i: number) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm">{obj.objection}</span>
                <span className="text-sm font-medium">{obj.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Competitors */}
      {stats.top_competitors?.length > 0 && (
        <div className="p-4 bg-muted/30 rounded-lg">
          <h5 className="text-sm font-medium mb-2">Top Competitors</h5>
          <div className="space-y-2">
            {stats.top_competitors.map((comp: any, i: number) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm">{comp.name}</span>
                <span className="text-sm font-medium">{comp.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stage Breakdown */}
      {stats.stage_breakdown && Object.keys(stats.stage_breakdown).length > 0 && (
        <div className="p-4 bg-muted/30 rounded-lg">
          <h5 className="text-sm font-medium mb-2">Stage Breakdown</h5>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(stats.stage_breakdown).map(([stage, count]) => (
              <div key={stage} className="text-center p-2 bg-muted/50 rounded">
                <p className="text-lg font-bold">{count as number}</p>
                <p className="text-xs text-muted-foreground capitalize">{stage}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AggregateInsightsPanel;
