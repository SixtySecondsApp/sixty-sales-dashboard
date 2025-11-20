/**
 * Stats First View Component
 * Shows statistics with filter options before displaying results
 */

import React, { useState } from 'react';
import { Filter, ChevronRight } from 'lucide-react';

interface StatsFirstViewProps {
  stats: Array<{
    label: string;
    value: string | number;
    variant?: 'danger' | 'warning' | 'success' | 'default';
  }>;
  filterOptions: Array<{
    id: string;
    label: string;
    count: number;
  }>;
  onFilterSelect: (filterId: string, count: number) => void;
  onViewAll?: () => void;
}

const MetricCard: React.FC<{ label: string; value: string | number; variant?: 'danger' | 'warning' | 'success' | 'default' }> = ({
  label,
  value,
  variant = 'default'
}) => {
  const variantColors = {
    danger: 'text-red-400',
    warning: 'text-amber-400',
    success: 'text-emerald-400',
    default: 'text-gray-100'
  };

  return (
    <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/40 rounded-lg p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${variantColors[variant]}`}>{value}</div>
    </div>
  );
};

export const StatsFirstView: React.FC<StatsFirstViewProps> = ({
  stats,
  filterOptions,
  onFilterSelect,
  onViewAll
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  const handleFilterClick = (filterId: string, count: number) => {
    setSelectedFilter(filterId);
    onFilterSelect(filterId, count);
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <MetricCard
            key={index}
            label={stat.label}
            value={stat.value}
            variant={stat.variant}
          />
        ))}
      </div>

      {/* Filter Options */}
      <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/40 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-gray-400" />
          <h4 className="text-sm font-semibold text-gray-300">View by Type</h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {filterOptions.map(option => (
            <button
              key={option.id}
              onClick={() => handleFilterClick(option.id, option.count)}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                selectedFilter === option.id
                  ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                  : 'bg-gray-800/50 border-gray-700/50 text-gray-300 hover:bg-gray-800/70 hover:border-gray-600/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-xs text-gray-500">({option.count})</span>
              </div>
              <ChevronRight className="w-4 h-4" />
            </button>
          ))}
        </div>

        {onViewAll && (
          <button
            onClick={onViewAll}
            className="w-full mt-4 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 text-blue-400 rounded-lg transition-colors text-sm font-medium"
          >
            View All Results
          </button>
        )}
      </div>
    </div>
  );
};







