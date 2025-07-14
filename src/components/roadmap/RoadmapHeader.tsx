import React from 'react';
import { Plus, LayoutGrid, Table } from 'lucide-react';

interface RoadmapHeaderProps {
  onAddSuggestionClick: () => void;
  view: 'kanban' | 'table';
  onViewChange: (view: 'kanban' | 'table') => void;
  sortBy: 'votes' | 'date' | 'priority' | 'none';
  onSortChange: (sortBy: 'votes' | 'date' | 'priority' | 'none') => void;
}

export function RoadmapHeader({
  onAddSuggestionClick,
  view,
  onViewChange,
  sortBy,
  onSortChange
}: RoadmapHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Product Roadmap</h1>
          <p className="text-gray-400 mt-1">Track feature requests and development progress</p>
        </div>
        
        <button
          onClick={onAddSuggestionClick}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Suggestion</span>
        </button>
      </div>

      <div className="flex items-center justify-between">
        {/* View Toggle */}
        <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg p-1">
          <button
            onClick={() => onViewChange('kanban')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
              view === 'kanban'
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="text-sm">Kanban</span>
          </button>
          <button
            onClick={() => onViewChange('table')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
              view === 'table'
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Table className="w-4 h-4" />
            <span className="text-sm">Table</span>
          </button>
        </div>

        {/* Sort Options */}
        {view === 'kanban' && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as any)}
              className="bg-gray-800 text-white rounded-lg px-3 py-1.5 text-sm border border-gray-700 focus:outline-none focus:border-gray-600"
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
  );
}