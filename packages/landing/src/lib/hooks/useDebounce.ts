import { useState, useEffect } from 'react';

/**
 * Custom hook to debounce a value.
 * @param value The value to debounce.
 * @param delay The debounce delay in milliseconds.
 * @returns The debounced value.
 */
export function useDebounce<T>(value: T, delay: number): T {
  // State and setters for debounced value
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set debouncedValue to value (passed in) after the specified delay
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Return a cleanup function that will run every time useEffect is re-called.
    // useEffect will run again if value or delay changes.
    // This is how we prevent debouncedValue from changing if value is updated 
    // within the delay period. Timeout gets cleared and restarted.
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]); // Only re-call effect if value or delay changes

  return debouncedValue;
}

/**
 * Custom hook for debounced search with local filtering capabilities.
 * Optimizes search performance by avoiding API calls on every keystroke.
 * 
 * @param initialQuery - Initial search query
 * @param delay - Debounce delay in milliseconds (default: 300ms)
 * @returns Object with search state and handlers
 */
export function useDebouncedSearch(initialQuery: string = '', delay: number = 300) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearchQuery = useDebounce(searchQuery, delay);

  // Track if search is in progress
  useEffect(() => {
    if (searchQuery !== debouncedSearchQuery) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  }, [searchQuery, debouncedSearchQuery]);

  const clearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
  };

  return {
    searchQuery,
    debouncedSearchQuery,
    isSearching,
    setSearchQuery,
    clearSearch
  };
}

/**
 * Local filtering utility for arrays of objects
 * @param items - Array of items to filter
 * @param searchQuery - Search query string
 * @param searchFields - Fields to search in each item
 * @returns Filtered array
 */
export function filterItems<T extends Record<string, any>>(
  items: T[],
  searchQuery: string,
  searchFields: (keyof T)[]
): T[] {
  if (!searchQuery.trim()) {
    return items;
  }

  const query = searchQuery.toLowerCase().trim();
  
  return items.filter(item =>
    searchFields.some(field => {
      const value = item[field];
      if (value == null) return false;
      return String(value).toLowerCase().includes(query);
    })
  );
} 