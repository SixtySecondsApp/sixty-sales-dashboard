/**
 * TestActivitySearch
 *
 * Search component for finding and selecting any activity for skill testing.
 */

import { useState, useEffect } from 'react';
import { Search, Loader2, Calendar, X, DollarSign } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/contexts/AuthContext';
import { searchTestActivities, type TestActivity } from '@/lib/hooks/useTestActivities';
import { getTierColorClasses } from '@/lib/utils/entityTestTypes';
import {
  getActivityTypeBadgeStyle,
  getActivityStatusBadgeStyle,
  formatActivityType,
} from '@/lib/utils/activityQualityScoring';
import { useDebounce } from '@/lib/hooks/useDebounce';

interface TestActivitySearchProps {
  selectedActivity: TestActivity | null;
  onSelect: (activity: TestActivity | null) => void;
}

/**
 * Format currency for display
 */
function formatCurrency(value: number | null): string {
  if (!value || value === 0) return '';
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

/**
 * Format date for display
 */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function TestActivitySearch({ selectedActivity, onSelect }: TestActivitySearchProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TestActivity[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Debounce the search query
  const debouncedQuery = useDebounce(query, 300);

  // Perform search when debounced query changes
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedQuery.trim() || !user?.id) {
        setResults([]);
        setHasSearched(false);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const activities = await searchTestActivities(user.id, debouncedQuery, 10);
        setResults(activities);
        setHasSearched(true);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedQuery, user?.id]);

  // Show loading when query is different from debounced query
  const showLoading = isSearching || (query.trim() && query !== debouncedQuery);

  const handleClearSelection = () => {
    onSelect(null);
    setQuery('');
    setResults([]);
    setHasSearched(false);
  };

  // If an activity is selected, show it as a selected card
  if (selectedActivity) {
    const tierColors = getTierColorClasses(selectedActivity.qualityScore.tier);
    const typeStyle = getActivityTypeBadgeStyle(selectedActivity.type);
    const statusStyle = getActivityStatusBadgeStyle(selectedActivity.status);

    return (
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Selected Activity
        </label>
        <div
          className={cn(
            'flex items-center gap-3 p-3 rounded-lg border',
            tierColors.border,
            tierColors.bg
          )}
        >
          <div
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
              tierColors.bg,
              tierColors.text
            )}
          >
            <Calendar className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {selectedActivity.client_name}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              <span className="truncate">
                {selectedActivity.details || formatActivityType(selectedActivity.type)}
              </span>
              {selectedActivity.date && (
                <span>{formatDate(selectedActivity.date)}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant={typeStyle.variant}
              className={cn('text-[10px] px-1.5 py-0', typeStyle.className)}
            >
              {formatActivityType(selectedActivity.type)}
            </Badge>
            <Badge variant="outline" className={cn('text-[10px] px-1 py-0', statusStyle.className)}>
              {statusStyle.label}
            </Badge>
            {selectedActivity.amount && selectedActivity.amount > 0 && (
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                {formatCurrency(selectedActivity.amount)}
              </span>
            )}
            <span className={cn('text-xs font-semibold', tierColors.text)}>
              {selectedActivity.qualityScore.score}/100
            </span>
            <button
              type="button"
              onClick={handleClearSelection}
              className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Clear selection"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Search Activities
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search by client name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
        {showLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
        )}
      </div>

      {/* Search results */}
      {hasSearched && results.length === 0 && !showLoading && (
        <div className="text-center py-4">
          <Calendar className="w-6 h-6 text-gray-300 dark:text-gray-600 mx-auto mb-1" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No activities found for "{query}"
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-1 max-h-[220px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800/50 p-2">
          {results.map((activity) => {
            const tierColors = getTierColorClasses(activity.qualityScore.tier);
            const typeStyle = getActivityTypeBadgeStyle(activity.type);

            return (
              <button
                key={activity.id}
                type="button"
                onClick={() => onSelect(activity)}
                className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/50 text-left transition-colors"
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                    tierColors.bg,
                    tierColors.text
                  )}
                >
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {activity.client_name}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="truncate max-w-[80px]">
                      {activity.details || formatActivityType(activity.type)}
                    </span>
                    {activity.date && (
                      <span>{formatDate(activity.date)}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <Badge
                    variant={typeStyle.variant}
                    className={cn('text-[10px] px-1 py-0', typeStyle.className)}
                  >
                    {formatActivityType(activity.type)}
                  </Badge>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className={cn('font-medium', tierColors.text)}>
                      {activity.qualityScore.score}/100
                    </span>
                    {activity.amount && activity.amount > 0 && (
                      <span className="font-medium text-gray-600 dark:text-gray-300">
                        {formatCurrency(activity.amount)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
