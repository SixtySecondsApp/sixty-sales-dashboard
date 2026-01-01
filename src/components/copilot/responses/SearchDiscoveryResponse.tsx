import React from 'react';
import { SearchDiscoveryResponse as SearchDiscoveryResponseType } from '../types';
import { Search, Briefcase, User, Building2, Calendar, Activity, CheckSquare, Filter } from 'lucide-react';

interface SearchDiscoveryResponseProps {
  data: SearchDiscoveryResponseType;
  onActionClick?: (action: string, data?: any) => void;
}

export const SearchDiscoveryResponse: React.FC<SearchDiscoveryResponseProps> = ({ data, onActionClick }) => {
  const { query, results, filters, totalResults, categories } = data.data;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deal': return <Briefcase className="w-4 h-4 text-blue-500" />;
      case 'contact': return <User className="w-4 h-4 text-purple-500" />;
      case 'company': return <Building2 className="w-4 h-4 text-green-500" />;
      case 'meeting': return <Calendar className="w-4 h-4 text-yellow-500" />;
      case 'activity': return <Activity className="w-4 h-4 text-orange-500" />;
      case 'task': return <CheckSquare className="w-4 h-4 text-red-500" />;
      default: return <Search className="w-4 h-4 text-gray-400" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'deal': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'contact': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'company': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'meeting': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'activity': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'task': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getRelevanceColor = (relevance: number) => {
    if (relevance >= 80) return 'text-green-500';
    if (relevance >= 60) return 'text-yellow-500';
    return 'text-gray-400';
  };

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <Search className="w-5 h-5 text-blue-500" />
          <div className="flex-1">
            <div className="text-sm text-gray-400">Search Query</div>
            <h3 className="text-lg font-semibold text-white mt-1">"{query}"</h3>
            <div className="text-sm text-gray-400 mt-2">
              Found {totalResults} result{totalResults !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Applied Filters */}
      {filters.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-400">Applied Filters</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {filters.map((filter, idx) => (
              <div key={idx} className="bg-gray-700 text-gray-300 text-xs px-3 py-1 rounded-full">
                {filter.field} {filter.operator} {filter.value}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results by Category */}
      {categories.length > 0 ? (
        <div className="space-y-6">
          {categories.map((category) => (
            <div key={category.type}>
              <h4 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
                {getTypeIcon(category.type)}
                <span className="capitalize">{category.type}s</span>
                <span className="text-sm text-gray-400">({category.count})</span>
              </h4>
              <div className="space-y-3">
                {category.results.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => onActionClick?.('open_search_result', result)}
                    className="w-full text-left bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:bg-gray-800/70 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded ${getTypeColor(result.type)}`}>
                        {getTypeIcon(result.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h5 className="font-semibold text-white">{result.title}</h5>
                            {result.subtitle && (
                              <p className="text-sm text-gray-400 mt-1">{result.subtitle}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-semibold ${getRelevanceColor(result.relevance)}`}>
                              {result.relevance}% match
                            </div>
                          </div>
                        </div>
                        {result.description && (
                          <p className="text-sm text-gray-300 mt-2">{result.description}</p>
                        )}
                        {result.highlights && result.highlights.length > 0 && (
                          <div className="mt-2">
                            <div className="text-xs text-gray-400 mb-1">Highlights:</div>
                            <div className="flex flex-wrap gap-1">
                              {result.highlights.map((highlight, idx) => (
                                <span key={idx} className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">
                                  {highlight}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {result.metadata && Object.keys(result.metadata).length > 0 && (
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            {Object.entries(result.metadata).map(([key, value]) => (
                              <div key={key}>
                                <span className="text-gray-400">{key}:</span>
                                <span className="text-gray-300 ml-1">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* All Results (if no categories) */
        <div className="space-y-3">
          {results.map((result) => (
            <button
              key={result.id}
              type="button"
              onClick={() => onActionClick?.('open_search_result', result)}
              className="w-full text-left bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:bg-gray-800/70 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded ${getTypeColor(result.type)}`}>
                  {getTypeIcon(result.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="font-semibold text-white">{result.title}</h5>
                        <span className={`text-xs px-2 py-1 rounded ${getTypeColor(result.type)}`}>
                          {result.type}
                        </span>
                      </div>
                      {result.subtitle && (
                        <p className="text-sm text-gray-400 mt-1">{result.subtitle}</p>
                      )}
                    </div>
                    <div className={`text-sm font-semibold ${getRelevanceColor(result.relevance)}`}>
                      {result.relevance}%
                    </div>
                  </div>
                  {result.description && (
                    <p className="text-sm text-gray-300 mt-2">{result.description}</p>
                  )}
                  {result.highlights && result.highlights.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {result.highlights.map((highlight, idx) => (
                        <span key={idx} className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">
                          {highlight}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

