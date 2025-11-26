import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMeetingIntelligence, SearchFilters, SearchSource } from '@/lib/hooks/useMeetingIntelligence';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import {
  Search,
  Sparkles,
  RefreshCw,
  Calendar,
  Building2,
  ThumbsUp,
  ThumbsDown,
  Minus,
  CheckSquare,
  ExternalLink,
  Clock,
  MessageSquare,
  Loader2,
  AlertCircle,
  Database,
  Zap,
  History,
  Users,
  User,
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';

// Quick date range presets
const DATE_PRESETS = [
  { label: 'Last 7 days', value: 'last7days' },
  { label: 'Last 30 days', value: 'last30days' },
  { label: 'This month', value: 'thisMonth' },
  { label: 'Last month', value: 'lastMonth' },
  { label: 'All time', value: 'allTime' },
];

// Example queries to help users
const EXAMPLE_QUERIES = [
  'What objections came up in recent demos?',
  'Summarize discussions about pricing',
  'Which meetings had negative sentiment?',
  'What did prospects say about competitors?',
  'Find meetings where next steps were discussed',
  'What are the common pain points mentioned?',
];

function getDateRange(preset: string): { date_from?: string; date_to?: string } {
  const today = new Date();

  switch (preset) {
    case 'last7days':
      return {
        date_from: format(subDays(today, 7), 'yyyy-MM-dd'),
        date_to: format(today, 'yyyy-MM-dd'),
      };
    case 'last30days':
      return {
        date_from: format(subDays(today, 30), 'yyyy-MM-dd'),
        date_to: format(today, 'yyyy-MM-dd'),
      };
    case 'thisMonth':
      return {
        date_from: format(startOfMonth(today), 'yyyy-MM-dd'),
        date_to: format(today, 'yyyy-MM-dd'),
      };
    case 'lastMonth':
      const lastMonth = subMonths(today, 1);
      return {
        date_from: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
        date_to: format(endOfMonth(lastMonth), 'yyyy-MM-dd'),
      };
    default:
      return {};
  }
}

const SourceCard: React.FC<{ source: SearchSource; onClick: () => void }> = ({
  source,
  onClick,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ scale: 1.01 }}
    className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 cursor-pointer border border-gray-200 dark:border-gray-700/50 hover:border-emerald-500/50 transition-all"
    onClick={onClick}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-gray-900 dark:text-white truncate">
          {source.title}
        </h4>
        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
          <Calendar className="h-3.5 w-3.5" />
          <span>{source.date}</span>
          {source.owner_name && (
            <>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <User className="h-3.5 w-3.5" />
              <span className="truncate">{source.owner_name}</span>
            </>
          )}
          {source.company_name && (
            <>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <Building2 className="h-3.5 w-3.5" />
              <span className="truncate">{source.company_name}</span>
            </>
          )}
        </div>
        {source.relevance_snippet && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
            {source.relevance_snippet}
          </p>
        )}
      </div>
      <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0" />
    </div>
  </motion.div>
);

const StatusIndicator: React.FC<{
  indexed: number;
  total: number;
  status: string;
  onSync: () => void;
  isSyncing: boolean;
}> = ({ indexed, total, status, onSync, isSyncing }) => {
  const percentage = total > 0 ? Math.round((indexed / total) * 100) : 0;
  const isFullySynced = indexed === total && total > 0;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-gray-400" />
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {indexed}/{total} indexed
        </span>
        {isFullySynced && (
          <Badge variant="outline" className="text-emerald-600 border-emerald-600/30 bg-emerald-50 dark:bg-emerald-900/20">
            Synced
          </Badge>
        )}
        {status === 'syncing' && (
          <Badge variant="outline" className="text-blue-600 border-blue-600/30 bg-blue-50 dark:bg-blue-900/20">
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
            Syncing
          </Badge>
        )}
        {status === 'error' && (
          <Badge variant="outline" className="text-red-600 border-red-600/30 bg-red-50 dark:bg-red-900/20">
            Error
          </Badge>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onSync}
        disabled={isSyncing || status === 'syncing'}
        className="gap-1 dark:text-white"
      >
        <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
        {isSyncing ? 'Indexing...' : 'Sync'}
      </Button>
    </div>
  );
};

export default function MeetingIntelligence() {
  const navigate = useNavigate();
  const {
    search,
    results,
    isSearching,
    searchError,
    indexStatus,
    isLoadingStatus,
    triggerFullIndex,
    clearResults,
    recentQueries,
    // Team filter
    selectedUserId,
    setSelectedUserId,
    teamMembers,
    isLoadingTeam,
  } = useMeetingIntelligence();

  const [query, setQuery] = useState('');
  const [sentiment, setSentiment] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<string>('allTime');
  const [hasActionItems, setHasActionItems] = useState<string>('all');
  const [isIndexing, setIsIndexing] = useState(false);

  // Handle search
  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    const filters: SearchFilters = {};

    if (sentiment !== 'all') {
      filters.sentiment = sentiment as 'positive' | 'negative' | 'neutral';
    }

    const dateRange = getDateRange(datePreset);
    if (dateRange.date_from) filters.date_from = dateRange.date_from;
    if (dateRange.date_to) filters.date_to = dateRange.date_to;

    if (hasActionItems !== 'all') {
      filters.has_action_items = hasActionItems === 'yes';
    }

    await search(query, filters);
  }, [query, sentiment, datePreset, hasActionItems, search]);

  // Handle key press (Enter to search)
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSearching) {
      handleSearch();
    }
  };

  // Handle full index trigger
  const handleFullIndex = async () => {
    setIsIndexing(true);
    try {
      await triggerFullIndex();
    } finally {
      setIsIndexing(false);
    }
  };

  // Navigate to meeting detail
  const handleSourceClick = (meetingId: string) => {
    navigate(`/meetings/${meetingId}`);
  };

  // Use example query
  const handleExampleClick = (exampleQuery: string) => {
    setQuery(exampleQuery);
  };

  // Use recent query
  const handleRecentQueryClick = (recentQuery: string) => {
    setQuery(recentQuery);
  };

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
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Meeting Intelligence
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {selectedUserId === null
                  ? 'Search across all team meetings with AI'
                  : selectedUserId === 'me'
                  ? 'Search across your meetings with AI'
                  : `Search ${teamMembers.find(m => m.user_id === selectedUserId)?.full_name || 'team member'}'s meetings`}
              </p>
            </div>
          </div>

          {!isLoadingStatus && (
            <StatusIndicator
              indexed={indexStatus.indexed}
              total={indexStatus.total}
              status={indexStatus.status}
              onSync={handleFullIndex}
              isSyncing={isIndexing}
            />
          )}
        </motion.div>

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <Card className="border-2 border-gray-200 dark:border-gray-700/50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Ask anything about your meetings..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="pl-10 h-12 text-base bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/50"
                  />
                </div>
                <Button
                  size="lg"
                  onClick={handleSearch}
                  disabled={isSearching || !query.trim()}
                  className="h-12 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 !text-white dark:!text-white"
                >
                  {isSearching ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Zap className="h-5 w-5 mr-2" />
                      Search
                    </>
                  )}
                </Button>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-3 mt-4">
                {/* Team Member Filter */}
                <Select
                  value={selectedUserId || 'all'}
                  onValueChange={(value) => setSelectedUserId(value === 'all' ? null : value)}
                >
                  <SelectTrigger className="w-[180px] h-9 bg-gray-50 dark:bg-gray-800/50">
                    <SelectValue placeholder="Team member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <span className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-emerald-500" />
                        All team members
                      </span>
                    </SelectItem>
                    <SelectItem value="me">
                      <span className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-blue-500" />
                        My meetings only
                      </span>
                    </SelectItem>
                    {!isLoadingTeam && teamMembers.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                          Team Members
                        </div>
                        {teamMembers.map((member) => (
                          <SelectItem key={member.user_id} value={member.user_id}>
                            <span className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5 text-gray-400" />
                              <span className="truncate max-w-[120px]">{member.full_name}</span>
                              <span className="text-xs text-gray-400">({member.meeting_count})</span>
                            </span>
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>

                <Select value={sentiment} onValueChange={setSentiment}>
                  <SelectTrigger className="w-[140px] h-9 bg-gray-50 dark:bg-gray-800/50">
                    <SelectValue placeholder="Sentiment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <span className="flex items-center gap-2">
                        <Minus className="h-3.5 w-3.5 text-gray-400" />
                        All sentiment
                      </span>
                    </SelectItem>
                    <SelectItem value="positive">
                      <span className="flex items-center gap-2">
                        <ThumbsUp className="h-3.5 w-3.5 text-emerald-500" />
                        Positive
                      </span>
                    </SelectItem>
                    <SelectItem value="neutral">
                      <span className="flex items-center gap-2">
                        <Minus className="h-3.5 w-3.5 text-gray-500" />
                        Neutral
                      </span>
                    </SelectItem>
                    <SelectItem value="negative">
                      <span className="flex items-center gap-2">
                        <ThumbsDown className="h-3.5 w-3.5 text-red-500" />
                        Negative
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select value={datePreset} onValueChange={setDatePreset}>
                  <SelectTrigger className="w-[150px] h-9 bg-gray-50 dark:bg-gray-800/50">
                    <SelectValue placeholder="Date range" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_PRESETS.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        <span className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-gray-400" />
                          {preset.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={hasActionItems} onValueChange={setHasActionItems}>
                  <SelectTrigger className="w-[160px] h-9 bg-gray-50 dark:bg-gray-800/50">
                    <SelectValue placeholder="Action items" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <span className="flex items-center gap-2">
                        <CheckSquare className="h-3.5 w-3.5 text-gray-400" />
                        All meetings
                      </span>
                    </SelectItem>
                    <SelectItem value="yes">
                      <span className="flex items-center gap-2">
                        <CheckSquare className="h-3.5 w-3.5 text-emerald-500" />
                        Has action items
                      </span>
                    </SelectItem>
                    <SelectItem value="no">
                      <span className="flex items-center gap-2">
                        <CheckSquare className="h-3.5 w-3.5 text-gray-300" />
                        No action items
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {results && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearResults}
                    className="h-9 text-gray-500 dark:text-white"
                  >
                    Clear results
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Example Queries (shown when no results) */}
        {!results && !isSearching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Example queries
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUERIES.map((example, index) => (
                <motion.button
                  key={index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                  onClick={() => handleExampleClick(example)}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800/50 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                >
                  {example}
                </motion.button>
              ))}
            </div>

            {/* Recent queries */}
            {recentQueries.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <History className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Recent searches
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentQueries.slice(0, 5).map((recentQuery, index) => (
                    <button
                      key={index}
                      onClick={() => handleRecentQueryClick(recentQuery)}
                      className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/30 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      {recentQuery}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Loading State */}
        <AnimatePresence>
          {isSearching && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full blur-xl opacity-30 animate-pulse" />
                <div className="relative p-4 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full">
                  <Sparkles className="h-8 w-8 text-white animate-pulse" />
                </div>
              </div>
              <p className="mt-4 text-gray-600 dark:text-gray-300 animate-pulse">
                Searching across your meetings...
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error State */}
        {searchError && !isSearching && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className="border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="font-medium text-red-700 dark:text-red-400">
                    Search failed
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-300">
                    {searchError}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Results */}
        <AnimatePresence>
          {results && !isSearching && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {/* AI Answer */}
              <Card className="mb-6 border-emerald-200/50 dark:border-emerald-800/30">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-emerald-500" />
                    AI Response
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-gray dark:prose-invert max-w-none prose-sm">
                    <ReactMarkdown>{results.answer}</ReactMarkdown>
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {results.query_metadata.response_time_ms}ms
                    </span>
                    <span className="flex items-center gap-1">
                      <Database className="h-3 w-3" />
                      {results.query_metadata.meetings_searched} meetings searched
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Sources */}
              {results.sources.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Sources ({results.sources.length})
                  </h3>
                  <div className="space-y-3">
                    {results.sources.map((source, index) => (
                      <SourceCard
                        key={source.meeting_id}
                        source={source}
                        onClick={() => handleSourceClick(source.meeting_id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* No sources */}
              {results.sources.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No specific meeting sources found.</p>
                  <p className="text-sm">
                    Try a different query or make sure your meetings are indexed.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state when no meetings with transcripts */}
        {!results && !isSearching && indexStatus.total === 0 && !isLoadingStatus && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="inline-flex p-4 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
              <Database className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No meetings with transcripts
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Connect your Fathom account and sync your meetings to enable AI-powered search
              across all your sales conversations. Meetings need transcripts to be searchable.
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => navigate('/integrations')}
                className="dark:text-white"
              >
                Connect Fathom
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/meetings')}
                className="dark:text-white"
              >
                View Meetings
              </Button>
            </div>
          </motion.div>
        )}

        {/* State when meetings exist but not yet indexed */}
        {!results && !isSearching && indexStatus.total > 0 && indexStatus.indexed === 0 && !isLoadingStatus && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="inline-flex p-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-4">
              <Zap className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Ready to build your search index
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              You have {indexStatus.total} meetings with transcripts. Build the AI search index
              to enable semantic search across all your conversations.
            </p>
            <Button
              onClick={triggerFullIndex}
              disabled={indexStatus.status === 'syncing'}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {indexStatus.status === 'syncing' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Building Index...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Build Search Index
                </>
              )}
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
