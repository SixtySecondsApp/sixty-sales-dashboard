import { useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { useSearch } from '@/hooks/useSearch';

interface SearchInputProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
  debounceDelay?: number;
  minSearchLength?: number;
  initialValue?: string;
}

export const SearchInput = ({ 
  onSearch, 
  placeholder = "Search...", 
  className = "",
  debounceDelay = 300,
  minSearchLength = 0,
  initialValue = ""
}: SearchInputProps) => {
  const { query, debouncedQuery, isSearching, setQuery, clearSearch } = useSearch(
    initialValue, 
    { debounceDelay, minSearchLength }
  );

  useEffect(() => {
    onSearch(debouncedQuery);
  }, [debouncedQuery, onSearch]);

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
      />
      
      {/* Clear button */}
      {query && (
        <button
          onClick={clearSearch}
          className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      
      {/* Loading indicator */}
      {isSearching && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
};