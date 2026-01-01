/**
 * TestEmailSearch
 *
 * Search component for finding and selecting any email for skill testing.
 */

import { useState, useEffect } from 'react';
import { Search, Loader2, Mail, X, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/contexts/AuthContext';
import { searchTestEmails, type TestEmail } from '@/lib/hooks/useTestEmails';
import { getTierColorClasses } from '@/lib/utils/entityTestTypes';
import { getEmailCategoryBadgeStyle, getUrgencyBadgeStyle } from '@/lib/utils/emailQualityScoring';
import { useDebounce } from '@/lib/hooks/useDebounce';

interface TestEmailSearchProps {
  selectedEmail: TestEmail | null;
  onSelect: (email: TestEmail | null) => void;
}

/**
 * Truncate subject for display
 */
function truncateSubject(subject: string | null, maxLength: number = 35): string {
  if (!subject) return '(No subject)';
  if (subject.length <= maxLength) return subject;
  return subject.substring(0, maxLength) + '...';
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

export function TestEmailSearch({ selectedEmail, onSelect }: TestEmailSearchProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TestEmail[]>([]);
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
        const emails = await searchTestEmails(user.id, debouncedQuery, 10);
        setResults(emails);
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

  // If an email is selected, show it as a selected card
  if (selectedEmail) {
    const tierColors = getTierColorClasses(selectedEmail.qualityScore.tier);
    const categoryStyle = getEmailCategoryBadgeStyle(selectedEmail.category);

    return (
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Selected Email
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
              'w-10 h-10 rounded-lg flex items-center justify-center shrink-0 relative',
              tierColors.bg,
              tierColors.text
            )}
          >
            <Mail className="w-5 h-5" />
            {selectedEmail.direction === 'inbound' ? (
              <ArrowDownLeft className="w-3 h-3 absolute -bottom-0.5 -right-0.5 text-blue-500" />
            ) : (
              <ArrowUpRight className="w-3 h-3 absolute -bottom-0.5 -right-0.5 text-green-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {truncateSubject(selectedEmail.subject, 45)}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {selectedEmail.from_email && (
                <span className="truncate">{selectedEmail.from_email}</span>
              )}
              {selectedEmail.received_at && (
                <span>{formatDate(selectedEmail.received_at)}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant={categoryStyle.variant}
              className={cn('text-[10px] px-1.5 py-0', categoryStyle.className)}
            >
              {selectedEmail.category.replace('_', ' ')}
            </Badge>
            <span className={cn('text-xs font-semibold', tierColors.text)}>
              {selectedEmail.qualityScore.score}/100
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
        Search Emails
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search by subject or sender..."
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
          <Mail className="w-6 h-6 text-gray-300 dark:text-gray-600 mx-auto mb-1" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No emails found for "{query}"
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-1 max-h-[220px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800/50 p-2">
          {results.map((email) => {
            const tierColors = getTierColorClasses(email.qualityScore.tier);
            const categoryStyle = getEmailCategoryBadgeStyle(email.category);

            return (
              <button
                key={email.id}
                type="button"
                onClick={() => onSelect(email)}
                className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/50 text-left transition-colors"
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 relative',
                    tierColors.bg,
                    tierColors.text
                  )}
                >
                  <Mail className="w-4 h-4" />
                  {email.direction === 'inbound' ? (
                    <ArrowDownLeft className="w-2.5 h-2.5 absolute -bottom-0.5 -right-0.5 text-blue-500" />
                  ) : (
                    <ArrowUpRight className="w-2.5 h-2.5 absolute -bottom-0.5 -right-0.5 text-green-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {truncateSubject(email.subject, 30)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    {email.from_email && (
                      <span className="truncate max-w-[80px]">{email.from_email}</span>
                    )}
                    {email.received_at && (
                      <span>{formatDate(email.received_at)}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <Badge
                    variant={categoryStyle.variant}
                    className={cn('text-[10px] px-1 py-0', categoryStyle.className)}
                  >
                    {email.category.replace('_', ' ')}
                  </Badge>
                  <span className={cn('text-xs font-medium', tierColors.text)}>
                    {email.qualityScore.score}/100
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
