import React, { useState } from 'react';
import { Plus, LayoutGrid, Table, Filter, X, Search } from 'lucide-react';

export interface RoadmapFilters {
  search: string;
  type: string[];
  priority: string[];
  assignee: string[];
}

interface RoadmapHeaderProps {
  onAddSuggestionClick: () => void;
  view: 'kanban' | 'table';
  onViewChange: (view: 'kanban' | 'table') => void;
  sortBy: 'votes' | 'date' | 'priority' | 'none';
  onSortChange: (sortBy: 'votes' | 'date' | 'priority' | 'none') => void;
  filters: RoadmapFilters;
  onFiltersChange: (filters: RoadmapFilters) => void;
}

export function RoadmapHeader({
  onAddSuggestionClick,
  view,
  onViewChange,
  sortBy,
  onSortChange,
  filters,
  onFiltersChange
}: RoadmapHeaderProps) {
  const [showFilters, setShowFilters] = useState(false);
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold theme-text-primary">Product Roadmap</h1>
          <p className="theme-text-tertiary mt-1">Track feature requests and development progress</p>
        </div>

        <button
          onClick={onAddSuggestionClick}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Suggestion</span>
        </button>
      </div>

      {/* Search and Controls Row */}
      <div className="flex items-center justify-between mb-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 theme-text-tertiary w-4 h-4" />
          <input
            type="text"
            placeholder="Search suggestions..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="w-full theme-bg-elevated theme-text-primary rounded-lg pl-10 pr-4 py-2 text-sm theme-border focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              showFilters
                ? 'bg-blue-600 text-white'
                : 'theme-bg-elevated theme-text-tertiary hover:theme-text-primary'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="text-sm">Filters</span>
          </button>

          {/* View Toggle */}
          <div className="flex items-center gap-2 theme-bg-elevated/50 rounded-lg p-1">
            <button
              onClick={() => onViewChange('kanban')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
                view === 'kanban'
                  ? 'bg-gray-200 dark:bg-gray-700 theme-text-primary'
                  : 'theme-text-tertiary hover:theme-text-primary'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="text-sm">Kanban</span>
            </button>
            <button
              onClick={() => onViewChange('table')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
                view === 'table'
                  ? 'bg-gray-200 dark:bg-gray-700 theme-text-primary'
                  : 'theme-text-tertiary hover:theme-text-primary'
              }`}
            >
              <Table className="w-4 h-4" />
              <span className="text-sm">Table</span>
            </button>
          </div>

          {/* Sort Options */}
          {view === 'kanban' && (
            <div className="flex items-center gap-2">
              <span className="text-sm theme-text-tertiary">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value as any)}
                className="theme-bg-elevated theme-text-primary rounded-lg px-3 py-1.5 text-sm theme-border focus:outline-none"
              >
                <option value="none">Default</option>
                <option value="votes">Most Votes</option>
                <option value="date">Newest First</option>
                <option value="priority">Priority</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="theme-bg-elevated/30 rounded-lg p-4 mb-4 theme-border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium theme-text-secondary mb-2">Type</label>
              <div className="space-y-2">
                {['feature', 'bug', 'improvement', 'other'].map((type) => (
                  <label key={type} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filters.type.includes(type)}
                      onChange={(e) => {
                        const newTypes = e.target.checked
                          ? [...filters.type, type]
                          : filters.type.filter(t => t !== type);
                        onFiltersChange({ ...filters, type: newTypes });
                      }}
                      className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="capitalize theme-text-secondary">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="block text-sm font-medium theme-text-secondary mb-2">Priority</label>
              <div className="space-y-2">
                {['critical', 'high', 'medium', 'low'].map((priority) => (
                  <label key={priority} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filters.priority.includes(priority)}
                      onChange={(e) => {
                        const newPriorities = e.target.checked
                          ? [...filters.priority, priority]
                          : filters.priority.filter(p => p !== priority);
                        onFiltersChange({ ...filters, priority: newPriorities });
                      }}
                      className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="capitalize theme-text-secondary">{priority}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <button
                onClick={() => onFiltersChange({ search: '', type: [], priority: [], assignee: [] })}
                className="flex items-center gap-2 px-3 py-2 text-sm theme-text-tertiary hover:theme-text-primary transition-colors"
              >
                <X className="w-4 h-4" />
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}