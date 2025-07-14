import React, { useState } from 'react';
import { Search, Filter, PlusCircle, LayoutGrid, Table, X, PoundSterling, Percent, Users, ArrowDownUp, Calendar, Clock, Target, Zap, TrendingUp, AlertTriangle, Bookmark, Sliders, CheckCircle2, Download } from 'lucide-react';
import { usePipeline } from '@/lib/contexts/PipelineContext';
import { OwnerFilter } from '@/components/OwnerFilter';
import { motion, AnimatePresence } from 'framer-motion';

interface PipelineHeaderProps {
  onAddDealClick: () => void;
  view: 'kanban' | 'table';
  onViewChange: (view: 'kanban' | 'table') => void;
  selectedOwnerId?: string;
  onOwnerChange: (ownerId?: string) => void;
  sortBy: 'value' | 'date' | 'alpha' | 'none';
  onSortChange: (sortBy: 'value' | 'date' | 'alpha' | 'none') => void;
}

export function PipelineHeader({ 
  onAddDealClick, 
  view, 
  onViewChange, 
  selectedOwnerId, 
  onOwnerChange,
  sortBy,
  onSortChange 
}: PipelineHeaderProps) {
  const { 
    searchTerm, 
    setSearchTerm, 
    filterOptions, 
    setFilterOptions,
    pipelineValue,
    weightedPipelineValue,
    activePipelineValue,
    stages,
    exportPipeline,
    getExportSummary
  } = usePipeline();
  
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  
  const formattedPipelineValue = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0
  }).format(pipelineValue);
  
  const formattedWeightedValue = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0
  }).format(weightedPipelineValue);

  const formattedActivePipelineValue = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0
  }).format(activePipelineValue);

  const hasActiveFilters = filterOptions.minValue || filterOptions.maxValue || filterOptions.probability || 
    filterOptions.tags.length || selectedOwnerId || filterOptions.stages.length || filterOptions.priorities.length ||
    filterOptions.dealSizes.length || filterOptions.leadSources.types.length || filterOptions.leadSources.channels.length ||
    filterOptions.dateRange.field || filterOptions.daysInStage.min || filterOptions.daysInStage.max || 
    filterOptions.timeStatus.length || filterOptions.quickFilter;

  const activeFilterCount = [
    filterOptions.minValue ? 1 : 0,
    filterOptions.maxValue ? 1 : 0,
    filterOptions.probability ? 1 : 0,
    filterOptions.tags.length,
    selectedOwnerId ? 1 : 0,
    filterOptions.stages.length,
    filterOptions.priorities.length,
    filterOptions.dealSizes.length,
    filterOptions.leadSources.types.length,
    filterOptions.leadSources.channels.length,
    filterOptions.dateRange.field ? 1 : 0,
    filterOptions.daysInStage.min ? 1 : 0,
    filterOptions.daysInStage.max ? 1 : 0,
    filterOptions.timeStatus.length,
    filterOptions.quickFilter ? 1 : 0
  ].reduce((sum, count) => sum + count, 0);
  
  const toggleSorting = () => {
    const sortOptions: Array<'none' | 'value' | 'date' | 'alpha'> = [
      'none',
      'value',
      'date',
      'alpha',
    ];
    const currentIndex = sortOptions.indexOf(sortBy);
    const nextIndex = (currentIndex + 1) % sortOptions.length;
    onSortChange(sortOptions[nextIndex]);
  };

  const getSortLabel = () => {
    switch (sortBy) {
      case 'value':
        return 'Sort: Value ↓';
      case 'date':
        return 'Sort: Date ↓';
      case 'alpha':
        return 'Sort: A-Z';
      default:
        return 'Sort: Manual';
    }
  };

  const quickFilters = [
    { 
      id: 'all', 
      label: 'All Deals', 
      icon: LayoutGrid, 
      colorClass: 'text-gray-400 bg-gray-800/30 border-gray-700/50 hover:bg-gray-700/30',
      tooltip: 'Show all deals in the pipeline without any filters applied'
    },
    { 
      id: 'my_deals', 
      label: 'My Deals', 
      icon: Users, 
      colorClass: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
      tooltip: 'Show only deals assigned to the currently logged-in user'
    },
    { 
      id: 'hot_deals', 
      label: 'Hot Deals', 
      icon: TrendingUp, 
      colorClass: 'text-red-400 bg-red-500/20 border-red-500/30',
      tooltip: 'Show deals with either:\n• Probability ≥ 50% OR\n• Deal value ≥ £5,000\n\nThese are high-potential opportunities worth prioritizing'
    },
    { 
      id: 'closing_soon', 
      label: 'Closing Soon', 
      icon: Clock, 
      colorClass: 'text-orange-400 bg-orange-500/20 border-orange-500/30',
      tooltip: 'Show deals with expected close dates within the next 30 days\n\nRequires either "Expected Close Date" or "Close Date" to be set'
    },
    { 
      id: 'stale_deals', 
      label: 'Stale Deals', 
      icon: AlertTriangle, 
      colorClass: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
      tooltip: 'Show deals that haven\'t had a stage change in 30+ days\n\nBased on "Stage Changed At" date or creation date if no stage changes'
    },
    { 
      id: 'recent', 
      label: 'Recent', 
      icon: Zap, 
      colorClass: 'text-green-400 bg-green-500/20 border-green-500/30',
      tooltip: 'Show deals created within the last 30 days\n\nBased on the deal creation date'
    },
  ];

  const priorities = ['low', 'medium', 'high', 'critical'];
  const dealSizes = ['small', 'medium', 'large', 'strategic'];
  const leadSourceTypes = ['inbound', 'outbound', 'referral', 'partner'];
  const leadSourceChannels = ['website', 'email', 'phone', 'linkedin', 'facebook', 'google', 'event', 'other'];
  const timeStatuses = [
    { id: 'normal', label: 'Normal', colorClass: 'text-green-400' },
    { id: 'warning', label: 'Warning', colorClass: 'text-yellow-400' },
    { id: 'danger', label: 'Danger', colorClass: 'text-red-400' }
  ];

  const handleQuickFilter = (filterId: string) => {
    const newQuickFilter = filterId === 'all' ? null : filterId as any;
    const selectedFilter = quickFilters.find(f => f.id === filterId);
    
    console.log(`🎯 Quick filter selected: ${filterId}`, { 
      newQuickFilter, 
      criteria: selectedFilter?.tooltip,
      currentDeals: pipelineValue 
    });
    
    setFilterOptions({
      ...filterOptions,
      quickFilter: newQuickFilter
    });
  };

  const clearAllFilters = () => {
    setFilterOptions({
      minValue: null,
      maxValue: null,
      probability: null,
      tags: [],
      dateRange: {
        field: null,
        from: null,
        to: null
      },
      stages: [],
      priorities: [],
      dealSizes: [],
      leadSources: {
        types: [],
        channels: []
      },
      daysInStage: {
        min: null,
        max: null
      },
      timeStatus: [],
      quickFilter: null
    });
    onOwnerChange(undefined);
  };

  const toggleArrayFilter = (array: string[], value: string, setter: (newArray: string[]) => void) => {
    if (array.includes(value)) {
      setter(array.filter(item => item !== value));
    } else {
      setter([...array, value]);
    }
  };

  const handleExportClick = async () => {
    try {
      await exportPipeline();
      
      // Optional: Show export summary
      const summary = getExportSummary();
      console.log('Export Summary:', {
        totalDeals: summary.totalDeals,
        totalValue: summary.totalValue,
        weightedValue: summary.totalWeightedValue,
        stages: Object.keys(summary.stageBreakdown)
      });
      
      // You could show a toast notification here if you have a toast system
    } catch (error) {
      console.error('Export failed:', error);
      // You could show an error toast here
    }
  };

  const tabs = [
    { id: 'basic', label: 'Basic', icon: Target },
    { id: 'advanced', label: 'Advanced', icon: Sliders },
    { id: 'source', label: 'Sources', icon: TrendingUp },
  ];
  
  return (
    <div className="mb-6 space-y-4">
      {/* Main Header Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onAddDealClick}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg
              bg-emerald-500/10 text-emerald-400 border border-emerald-500/20
              hover:bg-emerald-500/20 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Deal</span>
          </button>

          <button
            onClick={handleExportClick}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg
              bg-blue-500/10 text-blue-400 border border-blue-500/20
              hover:bg-blue-500/20 transition-colors"
            title="Export current pipeline view to CSV"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </button>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-lg
              border transition-colors relative
              ${hasActiveFilters
                ? 'bg-violet-500/20 text-violet-400 border-violet-500/30 hover:bg-violet-500/30'
                : 'bg-gray-800/50 text-gray-400 border-gray-700 hover:bg-gray-700/50'}
            `}
          >
            <Filter className={`w-4 h-4 ${showFilters ? 'text-violet-400' : ''}`} />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-violet-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                {activeFilterCount}
              </span>
            )}
          </button>

          <button
            onClick={toggleSorting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg
              bg-gray-800/50 text-gray-300 border border-gray-700 
              hover:bg-gray-700/50 transition-colors"
          >
            <ArrowDownUp className="w-4 h-4" />
            <span className="hidden sm:inline">{getSortLabel()}</span>
            <span className="sm:hidden">Sort</span>
          </button>
          
          <div className="border border-gray-700 rounded-lg overflow-hidden flex">
            <button 
              onClick={() => onViewChange('kanban')}
              className={`flex items-center gap-2 px-3 py-2.5 transition-colors ${view === 'kanban' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50'}`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Kanban</span>
            </button>
            <button 
              onClick={() => onViewChange('table')}
              className={`flex items-center gap-2 px-3 py-2.5 transition-colors ${view === 'table' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50'}`}
            >
              <Table className="w-4 h-4" />
              <span className="hidden sm:inline">Table</span>
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Total Pipeline Value - Made same height as search box */}
          <div className="flex flex-col justify-center px-4 py-2.5 bg-gray-800/50 rounded-lg border border-gray-700/50 min-h-[44px]">
            <div className="text-xs text-gray-400">Total Pipeline</div>
            <div className="text-lg font-bold text-emerald-400 leading-tight">
              {formattedActivePipelineValue}
            </div>
            <div className="text-xs text-gray-500 leading-tight">
              SQL + Opportunity + Verbal (Weighted)
            </div>
          </div>
          
          {/* Search */}
          <div className="flex items-center px-4 py-2.5 rounded-lg border border-gray-700
            bg-gray-800/50 w-full sm:w-auto min-w-[300px] min-h-[44px]"
          >
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search deals..."
              className="ml-3 bg-transparent border-none outline-none text-white w-full
                placeholder:text-gray-500"
            />
          </div>
        </div>
      </div>

      {/* Quick Filters Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {quickFilters.map((filter) => {
          const Icon = filter.icon;
          const isActive = filterOptions.quickFilter === filter.id || (filter.id === 'all' && !filterOptions.quickFilter);
          
          return (
            <div key={filter.id} className="relative group">
              <button
                onClick={() => handleQuickFilter(filter.id)}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-full whitespace-nowrap
                  text-sm font-medium transition-all duration-200 flex-shrink-0 border
                  ${isActive ? filter.colorClass : 'bg-gray-800/30 text-gray-400 border-gray-700/50 hover:bg-gray-700/30'}
                `}
              >
                <Icon className="w-4 h-4" />
                {filter.label}
              </button>
              
              {/* CSS-only tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md shadow-lg border border-gray-600 whitespace-pre-line max-w-sm opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-[9999]">
                {filter.tooltip}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black"></div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Compact Advanced Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-xl border border-gray-700/50 bg-gray-800/80 backdrop-blur-md shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <Sliders className="w-5 h-5 text-violet-400" />
                  <h3 className="text-lg font-semibold text-white">Advanced Filters</h3>
                  {activeFilterCount > 0 && (
                    <span className="text-xs text-violet-400">
                      {activeFilterCount} active
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {hasActiveFilters && (
                    <button
                      onClick={clearAllFilters}
                      className="px-3 py-1.5 text-xs rounded-md text-gray-300 hover:text-white hover:bg-gray-700/50 transition-colors"
                    >
                      Clear All
                    </button>
                  )}
                  <button 
                    onClick={() => setShowFilters(false)}
                    className="p-1.5 rounded-md hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex space-x-1 mb-4 bg-gray-900/50 p-1 rounded-lg">
                {tabs.map((tab) => {
                  const TabIcon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`
                        flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all flex-1
                        ${activeTab === tab.id 
                          ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' 
                          : 'text-gray-400 hover:text-white hover:bg-gray-700/30'}
                      `}
                    >
                      <TabIcon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab Content */}
              <div className="space-y-4">
                {activeTab === 'basic' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Deal Value */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white flex items-center gap-2">
                        <PoundSterling className="w-4 h-4 text-emerald-400" />
                        Deal Value
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="Min £"
                          value={filterOptions.minValue || ''}
                          onChange={(e) => setFilterOptions({
                            ...filterOptions,
                            minValue: e.target.value ? Number(e.target.value) : null
                          })}
                          className="flex-1 p-2 text-sm rounded-md border border-gray-600 bg-gray-900/50 text-white focus:border-emerald-500 focus:outline-none transition-all"
                        />
                        <input
                          type="number"
                          placeholder="Max £"
                          value={filterOptions.maxValue || ''}
                          onChange={(e) => setFilterOptions({
                            ...filterOptions,
                            maxValue: e.target.value ? Number(e.target.value) : null
                          })}
                          className="flex-1 p-2 text-sm rounded-md border border-gray-600 bg-gray-900/50 text-white focus:border-emerald-500 focus:outline-none transition-all"
                        />
                      </div>
                    </div>

                    {/* Probability */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white flex items-center gap-2">
                        <Percent className="w-4 h-4 text-blue-400" />
                        Min Probability
                      </label>
                      <div className="space-y-2">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={filterOptions.probability || 0}
                          onChange={(e) => setFilterOptions({
                            ...filterOptions,
                            probability: Number(e.target.value) || null
                          })}
                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="text-center">
                          <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400">
                            {filterOptions.probability || 0}%+
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Sales Rep */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-400" />
                        Sales Rep
                      </label>
                      <OwnerFilter
                        selectedOwnerId={selectedOwnerId}
                        onOwnerChange={onOwnerChange}
                        className="w-full"
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'advanced' && (
                  <div className="space-y-4">
                    {/* Date Range */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <select
                        value={filterOptions.dateRange.field || ''}
                        onChange={(e) => setFilterOptions({
                          ...filterOptions,
                          dateRange: {
                            ...filterOptions.dateRange,
                            field: e.target.value as any || null
                          }
                        })}
                        className="p-2 text-sm rounded-md border border-gray-600 bg-gray-900/50 text-white focus:border-orange-500 focus:outline-none transition-all"
                      >
                        <option value="">Select Date Field</option>
                        <option value="created_at">Created Date</option>
                        <option value="expected_close_date">Close Date</option>
                        <option value="stage_changed_at">Stage Change Date</option>
                      </select>
                      <input
                        type="date"
                        value={filterOptions.dateRange.from || ''}
                        onChange={(e) => setFilterOptions({
                          ...filterOptions,
                          dateRange: {
                            ...filterOptions.dateRange,
                            from: e.target.value || null
                          }
                        })}
                        className="p-2 text-sm rounded-md border border-gray-600 bg-gray-900/50 text-white focus:border-orange-500 focus:outline-none transition-all"
                      />
                      <input
                        type="date"
                        value={filterOptions.dateRange.to || ''}
                        onChange={(e) => setFilterOptions({
                          ...filterOptions,
                          dateRange: {
                            ...filterOptions.dateRange,
                            to: e.target.value || null
                          }
                        })}
                        className="p-2 text-sm rounded-md border border-gray-600 bg-gray-900/50 text-white focus:border-orange-500 focus:outline-none transition-all"
                      />
                    </div>

                    {/* Multi-select filters in compact grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* Stages */}
                      <div>
                        <label className="text-sm font-medium text-white mb-2 block">Stages</label>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {stages?.slice(0, 4).map((stage) => (
                            <label key={stage.id} className="flex items-center gap-2 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={filterOptions.stages.includes(stage.id)}
                                onChange={() => toggleArrayFilter(
                                  filterOptions.stages,
                                  stage.id,
                                  (newStages) => setFilterOptions({
                                    ...filterOptions,
                                    stages: newStages
                                  })
                                )}
                                className="w-3 h-3 text-indigo-500 bg-gray-700 border-gray-600 rounded"
                              />
                              <span className="text-white">{stage.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Priorities */}
                      <div>
                        <label className="text-sm font-medium text-white mb-2 block">Priority</label>
                        <div className="space-y-1">
                          {priorities.map((priority) => (
                            <label key={priority} className="flex items-center gap-2 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={filterOptions.priorities.includes(priority)}
                                onChange={() => toggleArrayFilter(
                                  filterOptions.priorities,
                                  priority,
                                  (newPriorities) => setFilterOptions({
                                    ...filterOptions,
                                    priorities: newPriorities
                                  })
                                )}
                                className="w-3 h-3 text-red-500 bg-gray-700 border-gray-600 rounded"
                              />
                              <span className="text-white capitalize">{priority}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Deal Sizes */}
                      <div>
                        <label className="text-sm font-medium text-white mb-2 block">Deal Size</label>
                        <div className="space-y-1">
                          {dealSizes.map((size) => (
                            <label key={size} className="flex items-center gap-2 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={filterOptions.dealSizes.includes(size)}
                                onChange={() => toggleArrayFilter(
                                  filterOptions.dealSizes,
                                  size,
                                  (newSizes) => setFilterOptions({
                                    ...filterOptions,
                                    dealSizes: newSizes
                                  })
                                )}
                                className="w-3 h-3 text-yellow-500 bg-gray-700 border-gray-600 rounded"
                              />
                              <span className="text-white capitalize">{size}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Time in Stage */}
                      <div>
                        <label className="text-sm font-medium text-white mb-2 block">Days in Stage</label>
                        <div className="space-y-2">
                          <input
                            type="number"
                            placeholder="Min"
                            value={filterOptions.daysInStage.min || ''}
                            onChange={(e) => setFilterOptions({
                              ...filterOptions,
                              daysInStage: {
                                ...filterOptions.daysInStage,
                                min: e.target.value ? Number(e.target.value) : null
                              }
                            })}
                            className="w-full p-1.5 text-xs rounded border border-gray-600 bg-gray-900/50 text-white focus:border-cyan-500 focus:outline-none"
                          />
                          <input
                            type="number"
                            placeholder="Max"
                            value={filterOptions.daysInStage.max || ''}
                            onChange={(e) => setFilterOptions({
                              ...filterOptions,
                              daysInStage: {
                                ...filterOptions.daysInStage,
                                max: e.target.value ? Number(e.target.value) : null
                              }
                            })}
                            className="w-full p-1.5 text-xs rounded border border-gray-600 bg-gray-900/50 text-white focus:border-cyan-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'source' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Lead Source Types */}
                    <div>
                      <label className="text-sm font-medium text-white mb-3 block">Lead Source Type</label>
                      <div className="grid grid-cols-2 gap-2">
                        {leadSourceTypes.map((type) => (
                          <label key={type} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={filterOptions.leadSources.types.includes(type)}
                              onChange={() => toggleArrayFilter(
                                filterOptions.leadSources.types,
                                type,
                                (newTypes) => setFilterOptions({
                                  ...filterOptions,
                                  leadSources: {
                                    ...filterOptions.leadSources,
                                    types: newTypes
                                  }
                                })
                              )}
                              className="w-4 h-4 text-green-500 bg-gray-700 border-gray-600 rounded"
                            />
                            <span className="text-white capitalize">{type}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Lead Source Channels */}
                    <div>
                      <label className="text-sm font-medium text-white mb-3 block">Lead Source Channel</label>
                      <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                        {leadSourceChannels.map((channel) => (
                          <label key={channel} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={filterOptions.leadSources.channels.includes(channel)}
                              onChange={() => toggleArrayFilter(
                                filterOptions.leadSources.channels,
                                channel,
                                (newChannels) => setFilterOptions({
                                  ...filterOptions,
                                  leadSources: {
                                    ...filterOptions.leadSources,
                                    channels: newChannels
                                  }
                                })
                              )}
                              className="w-4 h-4 text-green-500 bg-gray-700 border-gray-600 rounded"
                            />
                            <span className="text-white capitalize">{channel}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end pt-4 mt-4 border-t border-gray-700/50">
                <button
                  onClick={() => setShowFilters(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-500/20 text-violet-400 border border-violet-500/30 hover:bg-violet-500/30 transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 