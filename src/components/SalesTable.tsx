'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  // useReactTable, // Unused
  // getCoreRowModel, // Unused
  // getSortedRowModel, // Unused
  // getFilteredRowModel, // Unused
  // SortingState, // Unused
  CellContext,
} from '@tanstack/react-table';
import {
  Edit2, 
  Trash2, 
  ArrowUpRight, 
  Users, 
  PoundSterling, 
  LinkIcon,
  TrendingUp,
  BarChart as BarChartIcon,
  Phone,
  FileText,
  UploadCloud, // Added for potential use in import component
  Filter,
  X,
  Search,
  Download,
  XCircle,
  RefreshCw,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useActivities, Activity } from '@/lib/hooks/useActivities';
import { useUser } from '@/lib/hooks/useUser'; // Import useUser hook
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from 'date-fns';
import { IdentifierType } from '../components/IdentifierField';
import { EditActivityForm } from './EditActivityForm';
import { useActivityFilters } from '@/lib/hooks/useActivityFilters';
import { ActivityUploadModal } from './admin/ActivityUploadModal'; // Import the new modal
import { exportActivitiesToCSV, getExportSummary } from '@/lib/utils/csvExport';
import { calculateLTVValue, formatActivityAmount } from '@/lib/utils/calculations';
import { DateFilter, DateRangePreset, DateRange } from '@/components/ui/date-filter';
import { SubscriptionStats } from './SubscriptionStats';
import { Badge } from './Pipeline/Badge';
import logger from '@/lib/utils/logger';
// ActivityFilters component created inline to avoid import issues

interface StatCardProps {
  title: string;
  value: string | number;
  amount?: string;
  percentage?: string;
  trendPercentage: number;
  icon: React.ElementType;
  color: string;
  contextInfo?: string;
  period?: string;
}

export function SalesTable() {
  // Removed unused sorting state
  // const [sorting, setSorting] = useState<SortingState>([]); 
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const { activities, removeActivity, updateActivity } = useActivities();
  const { userData } = useUser(); // Get user data for admin check
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState<string | null>(null);
  const { filters, setFilters, resetFilters } = useActivityFilters();
  
  // Multi-select functionality
  const [selectedActivities, setSelectedActivities] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [isSelectAllChecked, setIsSelectAllChecked] = useState(false);
  const [bulkEditData, setBulkEditData] = useState<Partial<Activity>>({});
  const [isSelectModeActive, setIsSelectModeActive] = useState(false);
  
  // State for date filtering
  const [selectedRangeType, setSelectedRangeType] = useState<DateRangePreset>('thisMonth');
  const [customDateRange, setCustomDateRange] = useState<DateRange | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false); // State for upload modal
  const [showFilters, setShowFilters] = useState(false); // State for filters panel
  const [showSubscriptionStats, setShowSubscriptionStats] = useState(false); // State for subscription cards visibility
  const hasLoggedInitialSync = useRef(false);
  
  // Sync date state with filters when navigating from dashboard
  useEffect(() => {
    if (filters.dateRange) {
      const now = new Date();
      const filterStart = new Date(filters.dateRange.start);
      const filterEnd = new Date(filters.dateRange.end);
      
      // Only log once on initial sync
      if (!hasLoggedInitialSync.current) {
        hasLoggedInitialSync.current = true;
        logger.log('[SalesTable] Initial sync with filter date range:', {
          start: format(filterStart, 'yyyy-MM-dd'),
          end: format(filterEnd, 'yyyy-MM-dd')
        });
      }
      
      // Check if it matches a preset
      if (
        startOfDay(filterStart).getTime() === startOfDay(now).getTime() &&
        endOfDay(filterEnd).getTime() === endOfDay(now).getTime()
      ) {
        setSelectedRangeType('today');
        setCustomDateRange(null);
      } else if (
        startOfWeek(filterStart).getTime() === startOfWeek(now).getTime() &&
        endOfWeek(filterEnd).getTime() === endOfWeek(now).getTime()
      ) {
        setSelectedRangeType('thisWeek');
        setCustomDateRange(null);
      } else if (
        startOfMonth(filterStart).getTime() === startOfMonth(now).getTime() &&
        endOfMonth(filterEnd).getTime() === endOfMonth(now).getTime()
      ) {
        setSelectedRangeType('thisMonth');
        setCustomDateRange(null);
      } else {
        // It's a custom range (including previous months from dashboard)
        setSelectedRangeType('custom');
        setCustomDateRange({ start: filterStart, end: filterEnd });
      }
    }
  }, [filters.dateRange]); // Only run when filters.dateRange changes

  // Calculate the current and previous date ranges based on the selected type
  const { currentDateRange, previousDateRange } = useMemo(() => {
    // Use custom range if available and preset is 'custom'
    if (selectedRangeType === 'custom' && customDateRange) {
      return {
        currentDateRange: customDateRange,
        previousDateRange: {
          start: new Date(customDateRange.start.getTime() - (customDateRange.end.getTime() - customDateRange.start.getTime())),
          end: new Date(customDateRange.start.getTime() - 1)
        }
      };
    }

    const now = new Date();
    let currentStart, currentEnd, previousStart, previousEnd;

    switch (selectedRangeType) {
      case 'today':
        currentStart = startOfDay(now);
        currentEnd = endOfDay(now);
        const yesterday = subDays(now, 1);
        previousStart = startOfDay(yesterday);
        previousEnd = endOfDay(yesterday);
        break;
      case 'thisWeek':
        currentStart = startOfWeek(now, { weekStartsOn: 0 });
        currentEnd = endOfWeek(now, { weekStartsOn: 0 });
        const lastWeek = subWeeks(now, 1);
        previousStart = startOfWeek(lastWeek, { weekStartsOn: 0 });
        previousEnd = endOfWeek(lastWeek, { weekStartsOn: 0 });
        break;
      case 'last30Days':
        currentStart = startOfDay(subDays(now, 29));
        currentEnd = endOfDay(now);
        previousStart = startOfDay(subDays(now, 59)); // 30 days before the current start
        previousEnd = endOfDay(subDays(now, 30)); // Day before the current start
        break;
      case 'thisMonth': // Default case
      default:
        currentStart = startOfMonth(now);
        currentEnd = endOfMonth(now);
        const lastMonth = subMonths(now, 1);
        previousStart = startOfMonth(lastMonth);
        previousEnd = endOfMonth(lastMonth);
        break;
    }
    return {
      currentDateRange: { start: currentStart, end: currentEnd },
      previousDateRange: { start: previousStart, end: previousEnd }
    };
  }, [selectedRangeType, customDateRange]);

  // Sync selected date range with filters
  useEffect(() => {
    setFilters({ 
      dateRange: { 
        start: currentDateRange.start, 
        end: currentDateRange.end 
      }
    });
  }, [currentDateRange, setFilters]);

  // Filter activities with comprehensive filtering (for table display)
  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      try {
        const activityDate = new Date(activity.date);
        
        // Date range filtering
        const matchesDate = activityDate >= currentDateRange.start && 
                           activityDate <= currentDateRange.end;
        
        // Basic type filtering
        const matchesType = !filters.type || activity.type === filters.type;
        
        // Sales rep filtering
        const matchesSalesRep = !filters.salesRep || activity.sales_rep === filters.salesRep;
        
        // Client name filtering
        const matchesClient = !filters.clientName || activity.client_name === filters.clientName;
        
        // Status filtering
        const matchesStatus = !filters.status || activity.status === filters.status;
        
        // Priority filtering
        const matchesPriority = !filters.priority || activity.priority === filters.priority;
        
        // Amount range filtering
        const matchesAmountRange = (!filters.minAmount || (activity.amount && activity.amount >= filters.minAmount)) &&
                                  (!filters.maxAmount || (activity.amount && activity.amount <= filters.maxAmount));
        
        // Sub-type filtering based on details field (since we don't have dedicated fields yet)
        let matchesSubType = true;
        if (filters.type === 'sale' && filters.saleType) {
          matchesSubType = activity.details?.toLowerCase().includes(filters.saleType.toLowerCase()) || false;
        } else if (filters.type === 'meeting' && filters.meetingType) {
          const filterType = filters.meetingType.toLowerCase();
          const details = activity.details?.toLowerCase() || '';
          
          // Exact matching for new meeting types (they should match exactly now)
          if (filterType === 'discovery call' || filterType === 'discovery meeting') {
            // Match either "Discovery Call" or "Discovery Meeting" when user selects either discovery option
            matchesSubType = details.includes('discovery call') || details.includes('discovery meeting');
          } else if (filterType === 'demo') {
            // Match "Demo" 
            matchesSubType = details.includes('demo');
          } else {
            // For other types (Follow-up, Other), match exactly
            matchesSubType = details.includes(filterType);
          }
        } else if (filters.type === 'outbound' && filters.outboundType) {
          matchesSubType = activity.details?.toLowerCase().includes(filters.outboundType.toLowerCase()) || false;
        }
        
        // Search query filtering
        const matchesSearch = !filters.searchQuery || 
          activity.client_name?.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
          activity.type?.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
          activity.sales_rep?.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
          activity.details?.toLowerCase().includes(filters.searchQuery.toLowerCase());

        return matchesDate && matchesType && matchesSalesRep && matchesClient && 
               matchesStatus && matchesPriority && matchesAmountRange && 
               matchesSubType && matchesSearch;
      } catch (e) {
        logger.error("Error parsing activity date:", activity.date, e);
        return false; // Exclude activities with invalid dates
      }
    });
  }, [activities, currentDateRange, filters]);

  // Filter activities for metrics cards (date filtering only, no type filtering)
  const metricsFilteredActivities = useMemo(() => {
    return activities.filter(activity => {
      try {
        const activityDate = new Date(activity.date);
        
        // Only apply date range filtering for metrics cards
        const matchesDate = activityDate >= currentDateRange.start && 
                           activityDate <= currentDateRange.end;
        
        return matchesDate;
      } catch (e) {
        logger.error("Error parsing activity date:", activity.date, e);
        return false; // Exclude activities with invalid dates
      }
    });
  }, [activities, currentDateRange]);

  // Filter activities for the PREVIOUS equivalent period (for metrics cards)
  const previousPeriodMetricsActivities = useMemo(() => {
    if (!previousDateRange) return []; // Should not happen with default
    return activities.filter(activity => {
      try {
        const activityDate = new Date(activity.date);
        // Only apply date filtering, no type filtering for metrics
        return previousDateRange.start && previousDateRange.end && 
               activityDate >= previousDateRange.start && 
               activityDate <= previousDateRange.end;
      } catch (e) {
        logger.error("Error parsing activity date for previous period:", activity.date, e);
        return false; 
      }
    });
  }, [activities, previousDateRange]);

  // Calculate stats for the CURRENT period including meeting -> proposal rate and no-show rate
  const currentStats = useMemo(() => {
    // Calculate total revenue including LTV - using metricsFilteredActivities for all activity types
    const totalRevenue = metricsFilteredActivities
      .filter(a => a.type === 'sale')
      .reduce((sum, a) => {
        const ltvValue = a.deals ? calculateLTVValue(a.deals, a.amount) : 0;
        // Use LTV if available and greater than amount, otherwise use amount
        const value = ltvValue > (a.amount || 0) ? ltvValue : (a.amount || 0);
        return sum + value;
      }, 0);
    const activeDeals = metricsFilteredActivities
      .filter(a => a.type === 'sale' && a.status === 'completed').length; // Only count completed sales as won deals
    const salesActivities = metricsFilteredActivities.filter(a => a.type === 'sale').length;
    const proposalActivities = metricsFilteredActivities.filter(a => a.type === 'proposal').length;
    const meetingActivities = metricsFilteredActivities.filter(a => a.type === 'meeting').length;
    
    // Calculate no-show rate across all activities that can have no-shows (meetings, proposals, sales calls)
    const noShowActivities = metricsFilteredActivities.filter(a => a.status === 'no_show').length;
    const totalScheduledActivities = metricsFilteredActivities
      .filter(a => ['meeting', 'proposal', 'sale'].includes(a.type)).length;
    const noShowRate = Math.round(
      (noShowActivities / Math.max(1, totalScheduledActivities)) * 100
    ) || 0;
    
    const proposalWinRate = Math.round( // Renamed for clarity: Proposal -> Deal (Sale)
      (salesActivities / Math.max(1, proposalActivities)) * 100
    ) || 0;
    const meetingToProposalRate = Math.round(
      (proposalActivities / Math.max(1, meetingActivities)) * 100
    ) || 0;
    const avgDeal = totalRevenue / (salesActivities || 1); // Prevent division by zero
    return {
      totalRevenue,
      activeDeals,
      proposalWinRate, // Use the more descriptive name
      meetingToProposalRate,
      avgDeal,
      noShowRate,
      noShowCount: noShowActivities,
      totalScheduledCount: totalScheduledActivities
    };
  }, [metricsFilteredActivities]);

  // Calculate stats for the PREVIOUS period including meeting -> proposal rate and no-show rate
  const previousStats = useMemo(() => {
    const totalRevenue = previousPeriodMetricsActivities
      .filter(a => a.type === 'sale')
      .reduce((sum, a) => {
        const ltvValue = a.deals ? calculateLTVValue(a.deals, a.amount) : 0;
        const value = ltvValue > (a.amount || 0) ? ltvValue : (a.amount || 0);
        return sum + value;
      }, 0);
    const activeDeals = previousPeriodMetricsActivities
      .filter(a => a.type === 'sale' && a.status === 'completed').length; // Only count completed sales as won deals
    const salesActivities = previousPeriodMetricsActivities.filter(a => a.type === 'sale').length;
    const proposalActivities = previousPeriodMetricsActivities.filter(a => a.type === 'proposal').length;
    const meetingActivities = previousPeriodMetricsActivities.filter(a => a.type === 'meeting').length;
    
    // Calculate no-show rate for previous period
    const noShowActivities = previousPeriodMetricsActivities.filter(a => a.status === 'no_show').length;
    const totalScheduledActivities = previousPeriodMetricsActivities
      .filter(a => ['meeting', 'proposal', 'sale'].includes(a.type)).length;
    const noShowRate = Math.round(
      (noShowActivities / Math.max(1, totalScheduledActivities)) * 100
    ) || 0;
    
    const proposalWinRate = Math.round( // Renamed for clarity: Proposal -> Deal (Sale)
      (salesActivities / Math.max(1, proposalActivities)) * 100
    ) || 0;
    const meetingToProposalRate = Math.round(
        (proposalActivities / Math.max(1, meetingActivities)) * 100
      ) || 0;
    const avgDeal = totalRevenue / (salesActivities || 1); // Prevent division by zero
    return {
      totalRevenue,
      activeDeals,
      proposalWinRate, // Use the more descriptive name
      meetingToProposalRate,
      avgDeal,
      noShowRate,
      noShowCount: noShowActivities,
      totalScheduledCount: totalScheduledActivities
    };
  }, [previousPeriodMetricsActivities]);

  // Calculate percentage change
  const calculatePercentageChange = (current: number, previous: number): number => {
    if (previous === 0) {
      // If previous is 0, return 100% if current is positive, -100% if negative, 0% if both are 0.
      // Or simply return 0 to avoid infinity/large numbers. Let's go with 0 for simplicity.
      return current === 0 ? 0 : (current > 0 ? 100 : -100); // Alternative: return 0;
    }
    const change = ((current - previous) / previous) * 100;
    return Math.round(change); // Round to nearest integer
  };

  // Calculate trend percentages
  const revenueTrend = calculatePercentageChange(currentStats.totalRevenue, previousStats.totalRevenue);
  const dealsTrend = calculatePercentageChange(currentStats.activeDeals, previousStats.activeDeals);
  const proposalWinRateTrend = calculatePercentageChange(currentStats.proposalWinRate, previousStats.proposalWinRate); // Updated trend name
  const meetingToProposalRateTrend = calculatePercentageChange(currentStats.meetingToProposalRate, previousStats.meetingToProposalRate);
  const avgDealTrend = calculatePercentageChange(currentStats.avgDeal, previousStats.avgDeal);
  const noShowRateTrend = calculatePercentageChange(currentStats.noShowRate, previousStats.noShowRate);

  const handleEdit = (activity: Activity) => {
    setEditingActivity(activity);
  };

  const handleDelete = (id: string | null) => {
    logger.log('Attempting to delete activity with id:', id);
    if (!id) {
      logger.error('No activity ID provided for deletion');
      return;
    }
    removeActivity(id);
    setDeleteDialogOpen(false);
    setActivityToDelete(null);
  };

  const handleDeleteClick = (id: string) => {
    logger.log('Setting activity to delete:', id);
    setActivityToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleSave = async (activityId: string, updates: Partial<Activity>) => {
    if (updates.amount === undefined) {
      delete updates.amount;
    }

    try {
      await updateActivity({ id: activityId, updates });
      setEditingActivity(null);
    } catch (error) {
      logger.error("Failed to update activity:", error);
      toast.error("Failed to update activity. Please try again.");
    }
  };

  // Multi-select handlers - using useCallback for stability
  const handleSelectActivity = useCallback((activityId: string, checked: boolean) => {
    setSelectedActivities(prev => {
      const newSelected = new Set(prev);
      if (checked) {
        newSelected.add(activityId);
        logger.log('[SelectActivity] Added:', activityId, 'Total selected:', newSelected.size + 1);
      } else {
        newSelected.delete(activityId);
        logger.log('[SelectActivity] Removed:', activityId, 'Total selected:', newSelected.size - 1);
      }
      return newSelected;
    });
  }, []);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredActivities.map(activity => activity.id));
      setSelectedActivities(allIds);
      setIsSelectAllChecked(true);
    } else {
      setSelectedActivities(new Set());
      setIsSelectAllChecked(false);
    }
  }, [filteredActivities]);

  // Update select all checkbox state when selections change
  useEffect(() => {
    setIsSelectAllChecked(
      selectedActivities.size > 0 && 
      selectedActivities.size === filteredActivities.length && 
      filteredActivities.length > 0
    );
  }, [selectedActivities.size, filteredActivities.length]);

  const handleBulkDelete = async () => {
    try {
      const selectedIds = Array.from(selectedActivities);
      
      // Validation: Check if we have selected activities
      if (selectedIds.length === 0) {
        toast.error('No activities selected for deletion');
        return;
      }
      
      logger.log('[BulkDelete] Selected IDs:', selectedIds);
      logger.log('[BulkDelete] Selected count:', selectedIds.length);
      
      // Debug: Show which activities are selected
      const selectedActivityDetails = filteredActivities.filter(activity => 
        selectedIds.includes(activity.id)
      );
      logger.log('[BulkDelete] Selected activities:', selectedActivityDetails.map(a => ({
        id: a.id,
        type: a.type,
        client_name: a.client_name,
        details: a.details
      })));
      
      // Validation: Ensure all selected IDs exist in current filtered activities
      const existingIds = new Set(filteredActivities.map(a => a.id));
      const validIds = selectedIds.filter(id => existingIds.has(id));
      
      if (validIds.length !== selectedIds.length) {
        logger.warn('[BulkDelete] Some selected IDs not found in current activities:', 
          selectedIds.filter(id => !existingIds.has(id)));
      }
      
      logger.log('[BulkDelete] Valid IDs to delete:', validIds);
      
      // Delete activities sequentially to avoid race conditions
      for (const id of validIds) {
        try {
          await removeActivity(id);
          logger.log('[BulkDelete] Successfully deleted:', id);
        } catch (error) {
          logger.error('[BulkDelete] Failed to delete:', id, error);
          throw error; // Stop on first failure
        }
      }
      
      toast.success(`Successfully deleted ${validIds.length} activities`);
      setSelectedActivities(new Set());
      setIsSelectAllChecked(false);
      setBulkDeleteDialogOpen(false);
    } catch (error) {
      logger.error('Error during bulk delete:', error);
      toast.error('Failed to delete some activities. Please try again.');
      // Don't clear selections on error so user can retry
    }
  };

  const handleBulkEdit = async () => {
    try {
      const editPromises = Array.from(selectedActivities).map(id => 
        updateActivity({ id, updates: bulkEditData })
      );
      await Promise.all(editPromises);
      
      toast.success(`Successfully updated ${selectedActivities.size} activities`);
      setSelectedActivities(new Set());
      setIsSelectAllChecked(false);
      setBulkEditDialogOpen(false);
      setBulkEditData({});
    } catch (error) {
      logger.error('Error during bulk edit:', error);
      toast.error('Failed to update some activities. Please try again.');
    }
  };

  // Toggle select mode
  const toggleSelectMode = () => {
    setIsSelectModeActive(!isSelectModeActive);
    // Clear selections when turning off select mode
    if (isSelectModeActive) {
      setSelectedActivities(new Set());
      setIsSelectAllChecked(false);
    }
  };

  // Clear selections when filters change
  useEffect(() => {
    setSelectedActivities(new Set());
    setIsSelectAllChecked(false);
  }, [filters]);

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'sale':
        return PoundSterling;
      case 'outbound':
        return Phone;
      case 'meeting':
        return Users;
      case 'proposal':
        return FileText;
      default:
        return FileText;
    }
  };

  const getActivityColor = (type: Activity['type']) => {
    switch (type) {
      case 'sale':
        return 'emerald';
      case 'outbound':
        return 'blue';
      case 'meeting':
        return 'violet';
      case 'proposal':
        return 'orange';
      default:
        return 'gray';
    }
  };

  // Handle type filter changes via UI
  const handleFilterByType = (type: Activity['type'] | undefined) => {
    setFilters({ type });
  };

  // Derived state for whether current view is filtered by type
  const isTypeFiltered = !!filters.type;

  const columns = useMemo(
    () => [
      // Only show select column when in select mode
      ...(isSelectModeActive ? [{
        id: 'select',
        header: ({ table }: any) => (
          <div className="flex items-center justify-center">
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <input
                type="checkbox"
                checked={isSelectAllChecked}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="w-5 h-5 text-violet-500 bg-gray-800/80 border-2 border-gray-600 rounded-md focus:ring-violet-500 focus:ring-2 focus:ring-offset-0 transition-all duration-200 hover:border-violet-500/60 checked:bg-violet-500 checked:border-violet-500 cursor-pointer"
              />
            </motion.div>
          </div>
        ),
        cell: ({ row }: any) => (
          <div className="flex items-center justify-center">
            <motion.div 
              whileHover={{ scale: 1.1 }} 
              whileTap={{ scale: 0.9 }}
              animate={{
                opacity: selectedActivities.has(row.original.id) ? 1 : 0.7
              }}
            >
              <input
                type="checkbox"
                checked={selectedActivities.has(row.original.id)}
                onChange={(e) => handleSelectActivity(row.original.id, e.target.checked)}
                className="w-5 h-5 text-violet-500 bg-gray-800/80 border-2 border-gray-600 rounded-md focus:ring-violet-500 focus:ring-2 focus:ring-offset-0 transition-all duration-200 hover:border-violet-500/60 checked:bg-violet-500 checked:border-violet-500 cursor-pointer"
              />
            </motion.div>
          </div>
        ),
        size: 50,
        enableSorting: false,
      }] : []),
      {
        accessorKey: 'sales_rep',
        header: 'Sales Rep',
        size: 200,
        cell: (info: CellContext<Activity, unknown>) => {
          const salesRep = info.getValue() as string;
          const initials = salesRep?.split(' ').map((n: string) => n[0]).join('');
          
          return (
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#37bd7e]/10 border border-[#37bd7e]/20 flex items-center justify-center">
                <span className="text-xs sm:text-sm font-medium text-[#37bd7e]">
                  {initials || '??'}
                </span>
              </div>
              <span className="text-sm sm:text-base text-white">
                {salesRep || 'Loading...'}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'type',
        header: 'Activity Type',
        cell: ({ row, getValue }: CellContext<Activity, unknown>) => {
          const activity = row.original as Activity;
          if (!activity) return null;
          const quantity = activity.quantity || 1;
          const type = getValue() as Activity['type'];
          return (
            <div className="flex items-center gap-2">
              <div className={`p-1.5 sm:p-2 rounded-lg ${
                getActivityColor(type) === 'blue'
                  ? 'bg-blue-400/5'
                  : getActivityColor(type) === 'orange'
                    ? 'bg-orange-500/10'
                    : `bg-${getActivityColor(type)}-500/10`
              } border ${
                getActivityColor(type) === 'blue' 
                  ? 'border-blue-500/10'
                  : getActivityColor(type) === 'orange'
                    ? 'border-orange-500/20'
                    : `border-${getActivityColor(type)}-500/20`
              }`}>
                {React.createElement(getActivityIcon(type), {
                  className: `w-4 h-4 ${
                    getActivityColor(type) === 'blue'
                      ? 'text-blue-400'
                      : getActivityColor(type) === 'orange'
                        ? 'text-orange-500'
                        : `text-${getActivityColor(type)}-500`
                  }`
                })}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-sm font-medium text-white capitalize">
                    {type}
                    {type === 'outbound' && quantity > 1 && (
                      <span className="ml-2 text-xs text-blue-400">×{quantity}</span>
                    )}
                  </div>
                  {/* Meeting badges */}
                  {type === 'meeting' && (
                    <div className="flex items-center gap-1">
                      {activity.is_rebooking && (
                        <Badge color="orange" className="text-[10px] px-1.5 py-0.5">
                          <RefreshCw className="w-2.5 h-2.5 mr-1" />
                          Rebooked
                        </Badge>
                      )}
                      {activity.is_self_generated && (
                        <Badge color="emerald" className="text-[10px] px-1.5 py-0.5">
                          <UserCheck className="w-2.5 h-2.5 mr-1" />
                          Self Gen
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-gray-400">{format(new Date(activity.date), 'MMM d')}</div>
              </div>
              {(activity.amount || activity.deals) && (
                <div className="ml-auto text-sm font-medium text-emerald-500">
                  {formatActivityAmount(
                    activity.amount, 
                    activity.deals 
                      ? calculateLTVValue(activity.deals, activity.amount) 
                      : (activity.type === 'proposal' && activity.amount ? activity.amount : null),
                    activity.type
                  )}
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'client_name',
        header: 'Client',
        size: 250,
        enableHiding: true,
        cell: (info: CellContext<Activity, unknown>) => {
          const activity = info.row.original as Activity;
          if (!activity) return null;
          
          // Ensure client_name is always treated as a string
          let clientName = info.getValue();
          if (typeof clientName === 'object' && clientName !== null) {
            // If it's an object (shouldn't happen but handle it), try to extract the name
            clientName = (clientName as any).name || (clientName as any).toString() || 'Unknown';
          } else if (!clientName) {
            clientName = 'Unknown';
          }
          const clientNameStr = String(clientName);
          
          return (
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gray-800/50 flex items-center justify-center text-white text-xs sm:text-sm font-medium">
                {clientNameStr.split(' ').map((n: string) => n?.[0]).join('') || '??'}
              </div>
              <div>
                <div className="text-sm sm:text-base font-medium text-white">{clientNameStr}</div>
                <div className="text-[10px] sm:text-xs text-gray-400 flex items-center gap-1">
                  <LinkIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  {activity.details || 'No details'}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        size: 150,
        enableHiding: true,
        cell: (info: CellContext<Activity, unknown>) => {
          const activity = info.row.original as Activity;
          if (!activity) return null;
          const amount = info.getValue() as number | undefined;
          const status = activity.status;
          
          // Calculate LTV if activity has a linked deal
          // For proposals without deal data, use the amount as LTV
          const ltvValue = activity.deals 
            ? calculateLTVValue(activity.deals, amount) 
            : (activity.type === 'proposal' && amount ? amount : null);
          const displayAmount = formatActivityAmount(amount, ltvValue, activity.type);
          
          return (
            <div className="font-medium">
              <div className="text-sm sm:text-base text-white">
                {displayAmount}
              </div>
              <div className={`text-[10px] sm:text-xs capitalize ${
                status === 'no_show' 
                  ? 'text-red-400' 
                  : status === 'completed'
                    ? 'text-green-400'
                    : status === 'cancelled'
                      ? 'text-yellow-400'
                      : 'text-gray-400'
              }`}>
                {status === 'no_show' ? 'No Show' : status || 'Unknown'}
              </div>
              {activity.deals && (
                <div className="text-[10px] text-blue-400 truncate" title={activity.deals.name}>
                  🔗 {activity.deals.name}
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'details',
        header: 'Details',
        size: 200,
        enableHiding: true,
        cell: (info: CellContext<Activity, unknown>) => {
          const activity = info.row.original as Activity;
          if (!activity) return null;
          const details = info.getValue() as string;
          return (
            <div className="text-xs sm:text-sm text-gray-400">
              {details || 'No details'}
            </div>
          );
        },
      },
      {
        accessorKey: 'actions',
        header: '',
        size: 80,
        enableHiding: true,
        cell: (info: CellContext<Activity, unknown>) => {
          const activity = info.row.original as Activity;
          if (!activity) return null;
          return (
            <div className="flex items-center justify-end gap-2">
              <Dialog 
                open={editingActivity?.id === activity.id} 
                onOpenChange={(isOpen) => {
                  if (!isOpen) {
                    setEditingActivity(null);
                  }
                }}
              >
                <DialogTrigger asChild>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleEdit(activity)}
                    className="p-2 hover:bg-[#37bd7e]/20 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4 text-gray-400 hover:text-[#37bd7e]" />
                  </motion.button>
                </DialogTrigger>
                <DialogContent className="bg-gray-900/95 backdrop-blur-xl border-gray-800/50 text-white p-6 rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
                  {editingActivity && editingActivity.id === activity.id && (
                    <EditActivityForm 
                      activity={editingActivity}
                      onSave={handleSave}
                      onCancel={() => setEditingActivity(null)}
                    />
                  )}
                </DialogContent>
              </Dialog>
              
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClick(activity.id);
                }}
              >
                <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
              </motion.button>
            </div>
          );
        },
      },
    ],
    [editingActivity, selectedActivities, isSelectAllChecked, handleSelectActivity, handleSelectAll, isSelectModeActive]
  );

  // Enhanced StatCard component with better visual hierarchy
  const StatCard = ({ title, value, amount, percentage, trendPercentage, icon: Icon, color, contextInfo, period = 'vs last period' }: StatCardProps) => {
    const trendText = trendPercentage > 0 ? `+${trendPercentage}%` : `${trendPercentage}%`;
    const trendColor = trendPercentage > 0 ? `text-emerald-500` : trendPercentage < 0 ? `text-red-500` : `text-gray-500`;
    const trendIcon = trendPercentage > 0 ? '↗' : trendPercentage < 0 ? '↘' : '→';

    return (
      <div 
        className={`bg-gray-900/50 backdrop-blur-xl rounded-xl p-4 border border-gray-800/50 cursor-pointer hover:border-${color}-500/50 transition-all duration-300 relative min-h-[120px] flex flex-col`}
        onClick={() => {
          // When clicking a stat card, filter by its corresponding type
          const typeMap: Record<string, Activity['type'] | undefined> = {
            'Total Revenue': 'sale',
            'Meeting Conversion': 'meeting',
            'Proposal Win Rate': 'proposal',
            'No-Show Rate': undefined, // Show all to see no-shows across types
            'Won Deals': 'sale',
            'Average Deal Value': 'sale',
          };
          
          const newType = typeMap[title];
          if (newType === filters.type) {
            // Toggle off if already filtered
            handleFilterByType(undefined);
          } else {
            handleFilterByType(newType);
          }
        }}
      >
        {/* Trend indicator in top-right */}
        <div className="absolute top-3 right-3 flex flex-col items-end">
          <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            <span>{trendIcon}</span>
            <span>{trendText}</span>
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            {period}
          </div>
        </div>

        {/* Main content */}
        <div className="flex items-start gap-3 pr-16 flex-1">
          <div className={`p-2.5 rounded-xl bg-${color}-500/10 border border-${color}-500/20`}>
            <Icon className={`w-5 h-5 text-${color}-500`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{title}</p>
            
            {/* Primary metric */}
            <div className="space-y-1">
              {amount && (
                <div className="text-2xl font-bold text-white tracking-tight">{amount}</div>
              )}
              {percentage && (
                <div className="text-2xl font-bold text-white tracking-tight">{percentage}</div>
              )}
              {!amount && !percentage && (
                <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
              )}
            </div>
            
            {/* Spacer to push context info to bottom */}
            <div className="flex-1"></div>
            
            {/* Contextual information */}
            {contextInfo && (
              <div className="text-xs text-gray-500 mt-2">
                {contextInfo}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Format currency helper (reuse if needed or import from utils)
  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
  };

  // Handle CSV export
  const handleExportCSV = () => {
    try {
      if (filteredActivities.length === 0) {
        toast.error('No data to export. Please adjust your filters.');
        return;
      }

      const summary = getExportSummary(filteredActivities);
      const dateRangeText = summary.dateRange.start && summary.dateRange.end 
        ? `${format(summary.dateRange.start, 'yyyy-MM-dd')}-to-${format(summary.dateRange.end, 'yyyy-MM-dd')}`
        : format(new Date(), 'yyyy-MM-dd');
      
      const filename = `sales-activities-${dateRangeText}.csv`;
      
      exportActivitiesToCSV(filteredActivities, { filename });
      
      toast.success(`Exported ${filteredActivities.length} activities to ${filename}`);
    } catch (error) {
      logger.error('Export error:', error);
      toast.error('Failed to export data. Please try again.');
    }
  };

  return (
    <div className="min-h-screen text-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    {isTypeFiltered ? `${filters.type?.charAt(0).toUpperCase() ?? ''}${filters.type?.slice(1) ?? ''} Activities` : 'Activity Log'}
                  </h1>
                  <p className="text-sm text-gray-400 mt-1">
                    {isTypeFiltered ? `Showing ${filters.type || ''} activities for the selected period` : 'Track and manage your sales activities'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {isTypeFiltered && (
                <Button variant="secondary" onClick={resetFilters} size="sm">
                  Show All Types
                </Button>
              )}
              
              {/* Subscription Stats Toggle */}
              <Button
                onClick={() => setShowSubscriptionStats(!showSubscriptionStats)}
                variant="outline"
                size="sm"
                className={`transition-colors ${
                  showSubscriptionStats 
                    ? 'bg-violet-500/20 border-violet-500/40 text-violet-300 hover:bg-violet-500/30' 
                    : 'bg-gray-800/50 border-gray-700/50 text-gray-400 hover:bg-gray-700/50 hover:text-white'
                }`}
              >
                <BarChartIcon className="w-4 h-4 mr-2" />
                {showSubscriptionStats ? 'Hide' : 'Show'} Subscription Stats
              </Button>
              
              {/* Select Mode Toggle */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  onClick={toggleSelectMode}
                  variant="outline"
                  size="sm"
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                    isSelectModeActive 
                      ? 'bg-gradient-to-r from-violet-500/20 to-purple-500/20 border-violet-500/40 text-violet-300 hover:from-violet-500/30 hover:to-purple-500/30 shadow-lg shadow-violet-500/20 ring-2 ring-violet-500/30' 
                      : 'bg-gray-800/50 border-gray-700/50 text-gray-400 hover:bg-gray-700/50 hover:text-white hover:border-gray-600 hover:shadow-md'
                  }`}
                >
                  <motion.div
                    animate={{ rotate: isSelectModeActive ? 180 : 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    {isSelectModeActive ? (
                      <XCircle className="w-4 h-4" />
                    ) : (
                      <Filter className="w-4 h-4" />
                    )}
                  </motion.div>
                  <span className="font-semibold">
                    {isSelectModeActive ? 'Exit Select Mode' : 'Select'}
                  </span>
                </Button>
              </motion.div>

              <Button
                onClick={handleExportCSV}
                variant="outline"
                size="sm"
                className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 transition-colors"
                disabled={filteredActivities.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV ({filteredActivities.length})
              </Button>

              {/* Bulk Actions - Only show when select mode is active and activities are selected */}
              <AnimatePresence>
                {isSelectModeActive && selectedActivities.size > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, x: -20, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -20, scale: 0.95 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="flex items-center gap-3 ml-4 pl-4 border-l-2 border-gradient-to-b from-violet-500/40 to-purple-500/40"
                  >
                    <motion.div 
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500/15 to-purple-500/15 border border-violet-500/25 rounded-full backdrop-blur-sm"
                      animate={{ 
                        boxShadow: [
                          '0 0 0 0 rgba(139, 92, 246, 0.3)',
                          '0 0 0 4px rgba(139, 92, 246, 0.1)',
                          '0 0 0 0 rgba(139, 92, 246, 0.3)'
                        ]
                      }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <motion.div 
                        className="w-2 h-2 bg-violet-400 rounded-full"
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                      />
                      <span className="text-sm font-semibold text-violet-300">
                        {selectedActivities.size} selected
                      </span>
                    </motion.div>
                    
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        onClick={() => setBulkEditDialogOpen(true)}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-blue-500/25 text-blue-400 hover:from-blue-500/20 hover:to-cyan-500/20 hover:text-blue-300 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/20 hover:border-blue-400/40"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span className="font-medium">Edit</span>
                      </Button>
                    </motion.div>
                    
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        onClick={() => setBulkDeleteDialogOpen(true)}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500/10 to-rose-500/10 border-red-500/25 text-red-400 hover:from-red-500/20 hover:to-rose-500/20 hover:text-red-300 transition-all duration-300 hover:shadow-xl hover:shadow-red-500/20 hover:border-red-400/40"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="font-medium">Delete</span>
                      </Button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Main Date Filter */}
              <DateFilter
                value={selectedRangeType}
                customRange={customDateRange}
                onPresetChange={setSelectedRangeType}
                onCustomRangeChange={setCustomDateRange}
                label="Activity Date"
                compact={true}
                className="min-w-[160px]"
              />
            </div>
          </div>

          {/* Activity Filters */}
          <div className="space-y-4">
            {/* Filter Toggle and Summary */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="bg-gray-800/50 border-gray-700/50 text-white hover:bg-gray-700/50"
              >
                <Filter className="w-4 h-4 mr-2" />
                Advanced Filters
                {(filters.type || filters.salesRep || filters.status || filters.priority || filters.searchQuery) && (
                  <span className="ml-2 bg-emerald-500 text-white text-xs rounded-full px-2 py-0.5">
                    Active
                  </span>
                )}
              </Button>

              {(filters.type || filters.salesRep || filters.status || filters.priority || filters.searchQuery) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear All
                </Button>
              )}
            </div>

            {/* Filter Panel */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800/50 space-y-6">
                    
                    {/* Search */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-300">Search</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search activities, clients, details..."
                          value={filters.searchQuery}
                          onChange={(e) => setFilters({ searchQuery: e.target.value })}
                          className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    {/* Filter Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      
                      {/* Activity Type */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Activity Type</label>
                        <select
                          value={filters.type || 'all'}
                          onChange={(e) => setFilters({ type: e.target.value === 'all' ? undefined : e.target.value as any })}
                          className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        >
                          <option value="all">All Types</option>
                          <option value="sale">Sales</option>
                          <option value="outbound">Outbound</option>
                          <option value="meeting">Meetings</option>
                          <option value="proposal">Proposals</option>
                        </select>
                      </div>

                      {/* Sales Rep */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Sales Rep</label>
                        <select
                          value={filters.salesRep || 'all'}
                          onChange={(e) => setFilters({ salesRep: e.target.value === 'all' ? undefined : e.target.value })}
                          className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        >
                          <option value="all">All Sales Reps</option>
                          {Array.from(new Set(activities.map(a => a.sales_rep).filter(Boolean))).sort().map((rep: string) => (
                            <option key={rep} value={rep}>{rep}</option>
                          ))}
                        </select>
                      </div>

                      {/* Status */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Status</label>
                        <select
                          value={filters.status || 'all'}
                          onChange={(e) => setFilters({ status: e.target.value === 'all' ? undefined : e.target.value as any })}
                          className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        >
                          <option value="all">All Statuses</option>
                          <option value="completed">Completed</option>
                          <option value="pending">Pending</option>
                          <option value="cancelled">Cancelled</option>
                          <option value="no_show">No Show</option>
                        </select>
                      </div>

                      {/* Priority */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Priority</label>
                        <select
                          value={filters.priority || 'all'}
                          onChange={(e) => setFilters({ priority: e.target.value === 'all' ? undefined : e.target.value as any })}
                          className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        >
                          <option value="all">All Priorities</option>
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                      </div>
                    </div>

                    {/* Sub-type Filters (when applicable) */}
                    {filters.type && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">
                          {filters.type === 'sale' ? 'Sale Type' : 
                           filters.type === 'meeting' ? 'Meeting Type' : 
                           filters.type === 'outbound' ? 'Outbound Type' : 
                           'Sub Type'}
                        </label>
                        <select
                          value={
                            filters.type === 'sale' ? (filters.saleType || 'all') :
                            filters.type === 'meeting' ? (filters.meetingType || 'all') :
                            filters.type === 'outbound' ? (filters.outboundType || 'all') : 'all'
                          }
                          onChange={(e) => {
                            const value = e.target.value === 'all' ? undefined : e.target.value;
                            if (filters.type === 'sale') {
                              setFilters({ saleType: value as any });
                            } else if (filters.type === 'meeting') {
                              setFilters({ meetingType: value as any });
                            } else if (filters.type === 'outbound') {
                              setFilters({ outboundType: value as any });
                            }
                          }}
                          className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        >
                          <option value="all">All Types</option>
                          {filters.type === 'sale' && (
                            <>
                              <option value="one-off">One-off</option>
                              <option value="subscription">Subscription</option>
                              <option value="lifetime">Lifetime</option>
                            </>
                          )}
                          {filters.type === 'meeting' && (
                            <>
                              <option value="Discovery">Discovery</option>
                              <option value="Demo">Demo</option>
                              <option value="Follow-up">Follow-up</option>
                              <option value="Proposal">Proposal</option>
                              <option value="Client Call">Client Call</option>
                              <option value="Other">Other</option>
                            </>
                          )}
                          {filters.type === 'outbound' && (
                            <>
                              <option value="Call">Phone Call</option>
                              <option value="Email">Email</option>
                              <option value="LinkedIn">LinkedIn</option>
                              <option value="Other">Other</option>
                            </>
                          )}
                        </select>
                      </div>
                    )}

                    {/* Amount Range */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-300">Amount Range</label>
                      <div className="grid grid-cols-2 gap-4">
                        <input
                          type="number"
                          placeholder="Min amount"
                          value={filters.minAmount || ''}
                          onChange={(e) => setFilters({ minAmount: e.target.value ? parseFloat(e.target.value) : undefined })}
                          className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                        <input
                          type="number"
                          placeholder="Max amount"
                          value={filters.maxAmount || ''}
                          onChange={(e) => setFilters({ maxAmount: e.target.value ? parseFloat(e.target.value) : undefined })}
                          className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    {/* Client Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-300">Client</label>
                      <select
                        value={filters.clientName || 'all'}
                        onChange={(e) => setFilters({ clientName: e.target.value === 'all' ? undefined : e.target.value })}
                        className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      >
                        <option value="all">All Clients</option>
                        {Array.from(new Set(activities.map(a => a.client_name).filter(Boolean))).sort().map((client: string) => (
                          <option key={client} value={client}>{client}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 px-4 sm:px-0 auto-rows-fr">
            <StatCard
              key="revenue"
              title="Total Revenue"
              value={currentStats.totalRevenue}
              amount={`£${currentStats.totalRevenue.toLocaleString()}`}
              trendPercentage={revenueTrend}
              icon={PoundSterling}
              color="emerald"
              contextInfo={`From ${metricsFilteredActivities.filter(a => a.type === 'sale').length} completed sales`}
              period={selectedRangeType === 'today' ? 'vs yesterday' : selectedRangeType === 'thisWeek' ? 'vs last week' : selectedRangeType === 'last30Days' ? 'vs prev 30 days' : 'vs last month'}
            />
            <StatCard
              key="meetingConversion"
              title="Meeting Conversion"
              value={currentStats.meetingToProposalRate}
              percentage={`${currentStats.meetingToProposalRate}%`}
              trendPercentage={meetingToProposalRateTrend}
              icon={Users}
              color="cyan"
              contextInfo={`${metricsFilteredActivities.filter(a => a.type === 'proposal').length} proposals from ${metricsFilteredActivities.filter(a => a.type === 'meeting').length} meetings`}
              period={selectedRangeType === 'today' ? 'vs yesterday' : selectedRangeType === 'thisWeek' ? 'vs last week' : selectedRangeType === 'last30Days' ? 'vs prev 30 days' : 'vs last month'}
            />
            <StatCard
              key="proposalWinRate"
              title="Proposal Win Rate"
              value={currentStats.proposalWinRate}
              percentage={`${currentStats.proposalWinRate}%`}
              trendPercentage={proposalWinRateTrend}
              icon={FileText}
              color="blue"
              contextInfo={`${metricsFilteredActivities.filter(a => a.type === 'sale').length} wins from ${metricsFilteredActivities.filter(a => a.type === 'proposal').length} proposals`}
              period={selectedRangeType === 'today' ? 'vs yesterday' : selectedRangeType === 'thisWeek' ? 'vs last week' : selectedRangeType === 'last30Days' ? 'vs prev 30 days' : 'vs last month'}
            />
            <StatCard
              key="noShowRate"
              title="No-Show Rate"
              value={currentStats.noShowRate}
              percentage={`${currentStats.noShowRate}%`}
              trendPercentage={noShowRateTrend}
              icon={XCircle}
              color="red"
              contextInfo={`${currentStats.noShowCount} no-shows from ${currentStats.totalScheduledCount} scheduled`}
              period={selectedRangeType === 'today' ? 'vs yesterday' : selectedRangeType === 'thisWeek' ? 'vs last week' : selectedRangeType === 'last30Days' ? 'vs prev 30 days' : 'vs last month'}
            />
            <StatCard
              key="avgdeal"
              title="Avg Deal Value"
              value={Math.round(currentStats.avgDeal)}
              amount={`£${Math.round(currentStats.avgDeal).toLocaleString()}`}
              trendPercentage={avgDealTrend}
              icon={TrendingUp}
              color="amber"
              contextInfo={`Average from ${currentStats.activeDeals} won deals`}
              period={selectedRangeType === 'today' ? 'vs yesterday' : selectedRangeType === 'thisWeek' ? 'vs last week' : selectedRangeType === 'last30Days' ? 'vs prev 30 days' : 'vs last month'}
            />
          </div>

          {/* Subscription Management Stats - Conditionally Rendered */}
          {showSubscriptionStats && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  Subscription Management
                </h3>
                <div className="text-sm text-gray-400">
                  Revenue Overview
                </div>
              </div>
              <SubscriptionStats className="w-full" />
            </div>
          )}

          <div className="bg-gray-900/50 backdrop-blur-xl rounded-lg border border-gray-800/50 overflow-hidden w-full">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800/50">
                    {columns.map(column => (
                      <th 
                        key={(column as any).accessorKey || (column as any).id || Math.random()}
                        className="px-2 py-2 text-left text-xs font-medium text-gray-400 whitespace-nowrap"
                        style={{ width: (column as any).size ? `${(column as any).size}px` : 'auto' }}
                      >
                        {(column as any).header ? 
                          typeof (column as any).header === 'function' ? 
                            (column as any).header({ table: null }) : 
                            (column as any).header 
                          : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredActivities.map((activity, index) => (
                    <motion.tr 
                      key={activity.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ 
                        duration: 0.2,
                        delay: index * 0.02
                      }}
                      className={`relative border-b transition-all duration-300 cursor-pointer ${
                        selectedActivities.has(activity.id) && isSelectModeActive
                          ? 'border-violet-500/40 bg-gradient-to-r from-violet-500/10 via-purple-500/5 to-violet-500/10 shadow-lg shadow-violet-500/10 ring-1 ring-violet-500/20'
                          : 'border-gray-700 hover:bg-gray-700/50 hover:border-gray-600'
                      }`}
                    >
                      {columns.map(column => {
                        const cellContextMock = {
                          row: { original: activity },
                          getValue: () => (activity as any)[(column as any).accessorKey]
                        } as CellContext<Activity, unknown>;
                        
                        return (
                          <td
                             key={(column as any).accessorKey || (column as any).id || `${activity.id}-${(column as any).accessorKey}`}
                            className="px-2 py-2"
                            style={{ width: (column as any).size ? `${(column as any).size}px` : 'auto' }}
                          >
                            {(column as any).cell ? (column as any).cell(cellContextMock) : JSON.stringify((activity as any)[(column as any).accessorKey])}
                          </td>
                        );
                      })}
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {filteredActivities.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-gray-400">No activities found for the selected period.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-gray-900/95 backdrop-blur-xl border-gray-800/50 text-white p-6 rounded-xl">
          <DialogHeader>
            <DialogTitle>Delete Activity</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-400">
              Are you sure you want to delete this activity? This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteDialogOpen(false)}
              className="bg-gray-700 text-gray-100 hover:bg-gray-600 hover:text-white transition-colors"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                logger.log('Delete button clicked, id:', activityToDelete);
                handleDelete(activityToDelete);
              }}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent className="bg-gray-900/95 backdrop-blur-xl border-gray-800/50 text-white p-6 rounded-xl">
          <DialogHeader>
            <DialogTitle>Delete Selected Activities</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-400">
              Are you sure you want to delete <strong>{selectedActivities.size}</strong> selected activities? This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setBulkDeleteDialogOpen(false)}
              className="bg-gray-700 text-gray-100 hover:bg-gray-600 hover:text-white transition-colors"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleBulkDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete {selectedActivities.size} Activities
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Dialog */}
      <Dialog open={bulkEditDialogOpen} onOpenChange={setBulkEditDialogOpen}>
        <DialogContent className="bg-gray-900/95 backdrop-blur-xl border-gray-800/50 text-white p-6 rounded-xl max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Edit Activities</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-gray-400 mb-4">
              Editing <strong>{selectedActivities.size}</strong> selected activities. Only fill in the fields you want to change.
            </p>
            
            {/* Status */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Status</label>
              <select
                value={bulkEditData.status || ''}
                onChange={(e) => setBulkEditData(prev => ({ ...prev, status: e.target.value as Activity['status'] || undefined }))}
                className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Don't change status</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No Show</option>
              </select>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Priority</label>
              <select
                value={bulkEditData.priority || ''}
                onChange={(e) => setBulkEditData(prev => ({ ...prev, priority: e.target.value as Activity['priority'] || undefined }))}
                className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Don't change priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            {/* Sales Rep */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Sales Rep</label>
              <select
                value={bulkEditData.sales_rep || ''}
                onChange={(e) => setBulkEditData(prev => ({ ...prev, sales_rep: e.target.value || undefined }))}
                className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Don't change sales rep</option>
                {Array.from(new Set(activities.map(a => a.sales_rep).filter(Boolean))).sort().map((rep: string) => (
                  <option key={rep} value={rep}>{rep}</option>
                ))}
              </select>
            </div>

            {/* Details */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Details (will replace existing details)</label>
              <textarea
                value={bulkEditData.details || ''}
                onChange={(e) => setBulkEditData(prev => ({ ...prev, details: e.target.value || undefined }))}
                placeholder="Leave empty to keep existing details"
                rows={3}
                className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setBulkEditDialogOpen(false);
                setBulkEditData({});
              }}
              className="bg-gray-700 text-gray-100 hover:bg-gray-600 hover:text-white transition-colors"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleBulkEdit}
              className="bg-blue-500 hover:bg-blue-600 text-white"
              disabled={Object.keys(bulkEditData).length === 0 || Object.values(bulkEditData).every(v => !v)}
            >
              Update {selectedActivities.size} Activities
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {userData?.is_admin && (
         <ActivityUploadModal 
            open={isUploadModalOpen} 
            setOpen={setIsUploadModalOpen} 
         />
      )}
    </div>
  );
}