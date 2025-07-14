import { useState, useEffect, useCallback } from 'react';

interface UseSearchOptions {
  debounceDelay?: number;
  minSearchLength?: number;
}

export const useSearch = (initialQuery = '', options: UseSearchOptions = {}) => {
  const { debounceDelay = 300, minSearchLength = 0 } = options;
  
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [isSearching, setIsSearching] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setIsSearching(false);
    }, debounceDelay);

    if (query !== debouncedQuery && query.length >= minSearchLength) {
      setIsSearching(true);
    }

    return () => clearTimeout(timer);
  }, [query, debouncedQuery, debounceDelay, minSearchLength]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    setIsSearching(false);
  }, []);

  return {
    query,
    debouncedQuery,
    isSearching,
    setQuery,
    clearSearch
  };
};

// Hook for filtering data with search
export const useFilteredData = <T>(
  data: T[],
  searchQuery: string,
  filterFn: (item: T, query: string) => boolean
) => {
  const filteredData = useState(() => {
    if (!searchQuery.trim()) return data;
    return data.filter(item => filterFn(item, searchQuery.toLowerCase()));
  });

  useEffect(() => {
    if (!searchQuery.trim()) {
      filteredData[1](data);
    } else {
      filteredData[1](data.filter(item => filterFn(item, searchQuery.toLowerCase())));
    }
  }, [data, searchQuery, filterFn]);

  return filteredData[0];
};