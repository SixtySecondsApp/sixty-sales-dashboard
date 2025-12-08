import React from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Plus,
  Filter,
  ArrowUpDown,
  LayoutGrid,
  List,
  X,
  ChevronDown
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

import {
  ProjectViewMode,
  ProjectFilters,
  ProjectSort,
  SortField,
  statusConfigs,
  priorityConfigs
} from './types';
import { Task } from '@/lib/database/models';

interface ProjectsToolbarProps {
  view: ProjectViewMode;
  onViewChange: (view: ProjectViewMode) => void;
  filters: ProjectFilters;
  onFiltersChange: (filters: ProjectFilters) => void;
  sort: ProjectSort;
  onSortChange: (sort: ProjectSort) => void;
  onCreateTask: () => void;
  isDark: boolean;
  taskCount: number;
}

export function ProjectsToolbar({
  view,
  onViewChange,
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  onCreateTask,
  isDark,
  taskCount
}: ProjectsToolbarProps) {
  const [searchFocused, setSearchFocused] = React.useState(false);

  const hasActiveFilters = filters.status !== 'all' || filters.priority !== 'all' || filters.assignee !== 'all';
  
  const clearFilters = () => {
    onFiltersChange({
      ...filters,
      status: 'all',
      priority: 'all',
      assignee: 'all'
    });
  };

  const sortOptions: { field: SortField; label: string }[] = [
    { field: 'due_date', label: 'Due Date' },
    { field: 'priority', label: 'Priority' },
    { field: 'status', label: 'Status' },
    { field: 'title', label: 'Title' },
    { field: 'created_at', label: 'Created' }
  ];

  return (
    <div className={`rounded-xl border backdrop-blur-sm p-4
                    ${isDark 
                      ? 'bg-gray-900/60 border-gray-800/50' 
                      : 'bg-white/60 border-gray-200/50'}`}>
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        {/* Left side: View toggle and Create button */}
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className={`flex items-center gap-1 p-1 rounded-lg ${isDark ? 'bg-gray-800/50' : 'bg-gray-100/50'}`}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onViewChange('table')}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all ${
                view === 'table'
                  ? (isDark
                     ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border border-blue-500/30'
                     : 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-700 border border-blue-500/30')
                  : (isDark
                     ? 'text-gray-400 hover:bg-white/5 hover:text-white'
                     : 'text-gray-600 hover:bg-gray-100/50 hover:text-gray-900')
              }`}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">Table</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onViewChange('kanban')}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all ${
                view === 'kanban'
                  ? (isDark
                     ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border border-blue-500/30'
                     : 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-700 border border-blue-500/30')
                  : (isDark
                     ? 'text-gray-400 hover:bg-white/5 hover:text-white'
                     : 'text-gray-600 hover:bg-gray-100/50 hover:text-gray-900')
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Kanban</span>
            </motion.button>
          </div>

          {/* Create Task Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onCreateTask}
            className="flex items-center gap-2 px-4 py-2
                       bg-gradient-to-r from-blue-500 to-cyan-500
                       text-white text-sm font-semibold rounded-xl
                       shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40
                       transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Task</span>
          </motion.button>
        </div>

        {/* Center: Search */}
        <div className="flex-1 max-w-md">
          <motion.div
            animate={{
              borderColor: searchFocused 
                ? 'rgba(59, 130, 246, 0.5)' 
                : isDark ? 'rgba(55, 65, 81, 0.3)' : 'rgba(229, 231, 235, 0.5)',
              boxShadow: searchFocused ? '0 0 20px rgba(59, 130, 246, 0.2)' : 'none'
            }}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl
                       border transition-all duration-300
                       ${isDark
                         ? 'bg-gray-800/40 border-gray-700/30'
                         : 'bg-white/60 border-gray-300/50'}`}
          >
            <Search className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
            <input
              type="text"
              placeholder="Search tasks..."
              value={filters.search}
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className={`bg-transparent text-sm w-full focus:outline-none
                         ${isDark
                           ? 'text-gray-300 placeholder-gray-500'
                           : 'text-gray-700 placeholder-gray-400'}`}
            />
            {filters.search && (
              <button
                onClick={() => onFiltersChange({ ...filters, search: '' })}
                className={`p-1 rounded hover:bg-gray-500/20 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </motion.div>
        </div>

        {/* Right side: Filters, Sort, Count */}
        <div className="flex items-center gap-2">
          {/* Task Count Badge */}
          <Badge variant="secondary" className={`${isDark ? 'bg-gray-800/50 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
            {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
          </Badge>

          {/* Status Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`flex items-center gap-1.5 ${
                  filters.status !== 'all'
                    ? (isDark ? 'text-blue-400 bg-blue-500/10' : 'text-blue-600 bg-blue-50')
                    : (isDark ? 'text-gray-400' : 'text-gray-600')
                }`}
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Status</span>
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={isDark ? 'bg-gray-900 border-gray-800' : ''}>
              <div className={`px-2 py-1.5 text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Filter by Status
              </div>
              <div className={`my-1 h-px ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
              <DropdownMenuItem onClick={() => onFiltersChange({ ...filters, status: 'all' })}>
                <span className={filters.status === 'all' ? 'font-semibold' : ''}>All Statuses</span>
              </DropdownMenuItem>
              {(Object.keys(statusConfigs) as Task['status'][]).map((status) => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => onFiltersChange({ ...filters, status })}
                >
                  <span className={filters.status === status ? 'font-semibold' : ''}>
                    {statusConfigs[status].label}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Priority Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`flex items-center gap-1.5 ${
                  filters.priority !== 'all'
                    ? (isDark ? 'text-amber-400 bg-amber-500/10' : 'text-amber-600 bg-amber-50')
                    : (isDark ? 'text-gray-400' : 'text-gray-600')
                }`}
              >
                <span className="hidden sm:inline">Priority</span>
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={isDark ? 'bg-gray-900 border-gray-800' : ''}>
              <div className={`px-2 py-1.5 text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Filter by Priority
              </div>
              <div className={`my-1 h-px ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
              <DropdownMenuItem onClick={() => onFiltersChange({ ...filters, priority: 'all' })}>
                <span className={filters.priority === 'all' ? 'font-semibold' : ''}>All Priorities</span>
              </DropdownMenuItem>
              {(Object.keys(priorityConfigs) as Task['priority'][]).map((priority) => (
                <DropdownMenuItem
                  key={priority}
                  onClick={() => onFiltersChange({ ...filters, priority })}
                >
                  <span className={filters.priority === priority ? 'font-semibold' : ''}>
                    {priorityConfigs[priority].label}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`flex items-center gap-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
              >
                <ArrowUpDown className="w-4 h-4" />
                <span className="hidden sm:inline">Sort</span>
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={isDark ? 'bg-gray-900 border-gray-800' : ''}>
              <div className={`px-2 py-1.5 text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Sort By
              </div>
              <div className={`my-1 h-px ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
              {sortOptions.map((option) => (
                <DropdownMenuItem
                  key={option.field}
                  onClick={() => onSortChange({
                    field: option.field,
                    direction: sort.field === option.field && sort.direction === 'asc' ? 'desc' : 'asc'
                  })}
                >
                  <span className={sort.field === option.field ? 'font-semibold' : ''}>
                    {option.label}
                    {sort.field === option.field && (
                      <span className="ml-2 text-xs opacity-60">
                        {sort.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className={`${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

