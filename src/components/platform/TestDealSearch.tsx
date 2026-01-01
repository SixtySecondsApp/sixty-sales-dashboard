/**
 * TestDealSearch
 *
 * Search component for finding and selecting any deal for skill testing.
 */

import { useState, useCallback, useEffect } from 'react';
import { Search, Loader2, Briefcase, Building2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/contexts/AuthContext';
import { searchTestDeals, type TestDeal } from '@/lib/hooks/useTestDeals';
import { getTierColorClasses } from '@/lib/utils/entityTestTypes';
import { getDealHealthBadgeStyle } from '@/lib/utils/dealQualityScoring';
import { useDebounce } from '@/lib/hooks/useDebounce';

interface TestDealSearchProps {
  selectedDeal: TestDeal | null;
  onSelect: (deal: TestDeal | null) => void;
}

/**
 * Format currency for display
 */
function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export function TestDealSearch({ selectedDeal, onSelect }: TestDealSearchProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TestDeal[]>([]);
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
        const deals = await searchTestDeals(user.id, debouncedQuery, 10);
        setResults(deals);
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

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
  }, []);

  const handleClearSelection = () => {
    onSelect(null);
    setQuery('');
    setResults([]);
    setHasSearched(false);
  };

  // If a deal is selected, show it as a selected card
  if (selectedDeal) {
    const tierColors = getTierColorClasses(selectedDeal.qualityScore.tier);
    const healthStyle = getDealHealthBadgeStyle(selectedDeal.health_status);

    return (
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Selected Deal
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
            <Briefcase className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {selectedDeal.name}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {selectedDeal.company && (
                <span className="flex items-center gap-1 truncate">
                  <Building2 className="w-3 h-3" />
                  {selectedDeal.company}
                </span>
              )}
              {selectedDeal.stage_name && (
                <span className="truncate">{selectedDeal.stage_name}</span>
              )}
              <span className="font-medium">{formatCurrency(selectedDeal.value)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {selectedDeal.health_status && (
              <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', healthStyle.className)}>
                {selectedDeal.health_status}
              </Badge>
            )}
            <span className={cn('text-xs font-semibold', tierColors.text)}>
              {selectedDeal.qualityScore.score}/100
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
        Search Deals
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search by name or company..."
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          className="pl-9"
        />
        {showLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
        )}
      </div>

      {/* Search results */}
      {hasSearched && results.length === 0 && !showLoading && (
        <div className="text-center py-4">
          <Briefcase className="w-6 h-6 text-gray-300 dark:text-gray-600 mx-auto mb-1" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No deals found for "{query}"
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-1 max-h-[220px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800/50 p-2">
          {results.map((deal) => {
            const tierColors = getTierColorClasses(deal.qualityScore.tier);
            const healthStyle = getDealHealthBadgeStyle(deal.health_status);

            return (
              <button
                key={deal.id}
                type="button"
                onClick={() => onSelect(deal)}
                className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/50 text-left transition-colors"
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                    tierColors.bg,
                    tierColors.text
                  )}
                >
                  <Briefcase className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {deal.name}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    {deal.company && (
                      <span className="truncate max-w-[100px]">{deal.company}</span>
                    )}
                    <span className="font-medium">{formatCurrency(deal.value)}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  {deal.health_status && (
                    <Badge variant="outline" className={cn('text-[10px] px-1 py-0', healthStyle.className)}>
                      {deal.health_status}
                    </Badge>
                  )}
                  <span className={cn('text-xs font-medium', tierColors.text)}>
                    {deal.qualityScore.score}/100
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
