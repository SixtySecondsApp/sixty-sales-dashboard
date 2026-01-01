/**
 * TestContactSearch
 *
 * Search component for finding and selecting any contact for skill testing.
 */

import { useState, useCallback, useEffect } from 'react';
import { Search, Loader2, User, Building2, Calendar, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/contexts/AuthContext';
import { searchTestContacts, type TestContact } from '@/lib/hooks/useTestContacts';
import { getTierColorClasses } from '@/lib/utils/contactQualityScoring';
import { useDebounce } from '@/lib/hooks/useDebounce';

interface TestContactSearchProps {
  selectedContact: TestContact | null;
  onSelect: (contact: TestContact | null) => void;
}

export function TestContactSearch({ selectedContact, onSelect }: TestContactSearchProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TestContact[]>([]);
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
        const contacts = await searchTestContacts(user.id, debouncedQuery, 10);
        setResults(contacts);
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

  // If a contact is selected, show it as a selected card
  if (selectedContact) {
    const displayName =
      selectedContact.full_name ||
      [selectedContact.first_name, selectedContact.last_name].filter(Boolean).join(' ') ||
      selectedContact.email;
    const tierColors = getTierColorClasses(selectedContact.qualityScore.tier);

    return (
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Selected Contact
        </label>
        <div
          className={cn(
            'flex items-center gap-3 p-3 rounded-lg border',
            tierColors.border,
            tierColors.badge
          )}
        >
          <div
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm shrink-0',
              tierColors.bg
            )}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {displayName}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {selectedContact.title && (
                <span className="truncate max-w-[120px]">{selectedContact.title}</span>
              )}
              {selectedContact.company_name && (
                <span className="flex items-center gap-1 truncate">
                  <Building2 className="w-3 h-3" />
                  {selectedContact.company_name}
                </span>
              )}
              {selectedContact.total_meetings_count != null &&
                selectedContact.total_meetings_count > 0 && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {selectedContact.total_meetings_count} meetings
                  </span>
                )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn('text-xs font-semibold', tierColors.text)}>
              {selectedContact.qualityScore.tier} ({selectedContact.qualityScore.score}/100)
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
        Search Contacts
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search by name or email..."
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
          <User className="w-6 h-6 text-gray-300 dark:text-gray-600 mx-auto mb-1" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No contacts found for "{query}"
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-1 max-h-[220px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800/50 p-2">
          {results.map((contact) => {
            const displayName =
              contact.full_name ||
              [contact.first_name, contact.last_name].filter(Boolean).join(' ') ||
              contact.email;
            const tierColors = getTierColorClasses(contact.qualityScore.tier);

            return (
              <button
                key={contact.id}
                type="button"
                onClick={() => onSelect(contact)}
                className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/50 text-left transition-colors"
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-xs shrink-0',
                    tierColors.bg
                  )}
                >
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {displayName}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {contact.email}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <span className={cn('text-xs font-medium', tierColors.text)}>
                    {contact.qualityScore.tier}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {contact.qualityScore.score}/100
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
