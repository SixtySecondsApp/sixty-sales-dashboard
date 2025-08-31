import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Heart, 
  Search, 
  Plus, 
  Filter,
  Download,
  CheckSquare,
  Square,
  X,
  Trash2,
  DollarSign,
  Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import DealCard from '@/components/DealCard';
import ViewModeToggle from '@/components/ViewModeToggle';
import { OwnerFilterV3 } from '@/components/OwnerFilterV3';
import { useUser } from '@/lib/hooks/useUser';
import { useDeals } from '@/lib/hooks/useDeals';
import { isUserAdmin } from '@/lib/utils/adminUtils';
import { useDebouncedSearch, filterItems } from '@/lib/hooks/useDebounce';
import type { DealWithRelationships } from '@/lib/hooks/deals/types/dealTypes';

type SortField = 'name' | 'value' | 'probability' | 'company' | 'stage' | 'created_at' | 'updated_at';
type SortDirection = 'asc' | 'desc';

interface DealsViewProps {
  className?: string;
  showControls?: boolean;
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
}

export function DealsView({ 
  className, 
  showControls = true,
  viewMode: externalViewMode,
  onViewModeChange: externalOnViewModeChange
}: DealsViewProps) {
  const { userData, isLoading: isUserLoading } = useUser();
  
  // State management
  const { searchQuery, debouncedSearchQuery, isSearching, setSearchQuery } = useDebouncedSearch('', 400);
  const [internalViewMode, setInternalViewMode] = useState<'grid' | 'list'>('grid');
  
  // Use external viewMode if provided, otherwise use internal
  const viewMode = externalViewMode || internalViewMode;
  const setViewMode = externalOnViewModeChange || setInternalViewMode;
  const [stageFilter, setStageFilter] = useState<string>('all');
  // Initialize with undefined to let OwnerFilterV3 set default to "My Items"
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null | undefined>(undefined);
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Multi-select functionality
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isSelectAllChecked, setIsSelectAllChecked] = useState(false);
  const [isSelectModeActive, setIsSelectModeActive] = useState(false);
  
  // Deletion state
  const [deletingDeal, setDeletingDeal] = useState<DealWithRelationships | null>(null);

  // Determine the owner ID to use for fetching deals
  // This prevents the flicker from "All Items" to "My Items"
  const dealOwnerId = useMemo(() => {
    if (selectedOwnerId === null) return undefined; // Explicitly selected "All Items"
    if (selectedOwnerId !== undefined) return selectedOwnerId; // User selected a specific owner
    // selectedOwnerId is undefined - waiting for initialization
    // Default to current user to prevent loading all deals initially
    return userData?.id || undefined;
  }, [selectedOwnerId, userData?.id]);
  
  // Use the deals hook
  const { 
    deals, 
    stages,
    isLoading, 
    error,
    deleteDeal
  } = useDeals(dealOwnerId);

  // Multi-select handlers
  const handleSelectDeal = (dealId: string, isSelected: boolean) => {
    const newSelected = new Set(selectedDeals);
    if (isSelected) {
      newSelected.add(dealId);
    } else {
      newSelected.delete(dealId);
    }
    setSelectedDeals(newSelected);
  };

  const handleSelectAll = (isSelected: boolean, filteredDeals: DealWithRelationships[]) => {
    if (isSelected) {
      const allIds = new Set(filteredDeals.map(deal => deal.id));
      setSelectedDeals(allIds);
    } else {
      setSelectedDeals(new Set());
    }
    setIsSelectAllChecked(isSelected);
  };

  const toggleSelectMode = () => {
    setIsSelectModeActive(!isSelectModeActive);
    if (isSelectModeActive) {
      setSelectedDeals(new Set());
      setIsSelectAllChecked(false);
    }
  };

  const handleBulkDelete = async () => {
    try {
      const selectedIds = Array.from(selectedDeals);
      
      if (selectedIds.length === 0) {
        toast.error('No deals selected');
        return;
      }

      // Authorization check
      const isAdmin = isUserAdmin(userData);
      const authorizedDeals = filteredAndSortedDeals.filter(deal => 
        selectedIds.includes(deal.id) && (isAdmin || deal.owner_id === userData?.id)
      );

      if (authorizedDeals.length !== selectedIds.length) {
        const unauthorizedCount = selectedIds.length - authorizedDeals.length;
        toast.error(`You do not have permission to delete ${unauthorizedCount} of the selected deals`);
        
        if (authorizedDeals.length === 0) {
          return;
        }
      }

      // Delete only authorized deals
      const deletePromises = authorizedDeals.map(deal => deleteDeal(deal.id));
      await Promise.all(deletePromises);

      setSelectedDeals(new Set());
      setIsSelectAllChecked(false);
      setBulkDeleteDialogOpen(false);
      
      toast.success(`Successfully deleted ${authorizedDeals.length} deals`);
    } catch (error) {
      console.error('Error deleting deals:', error);
      toast.error('Failed to delete selected deals');
    }
  };

  // Filter and sort deals
  const filteredAndSortedDeals = useMemo(() => {
    let filtered = deals.filter(deal => {
      const matchesStage = stageFilter === 'all' || deal.stage_id === stageFilter;
      const matchesOwner = !selectedOwnerId || deal.owner_id === selectedOwnerId;
      
      return matchesStage && matchesOwner;
    });

    // Apply local instant filtering for better UX during typing
    if (searchQuery && searchQuery.trim()) {
      filtered = filterItems(filtered, searchQuery, [
        'name', 
        'company', 
        'contact_name'
      ]);
    }

    // Sort deals
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle special sorting cases
      if (sortField === 'stage') {
        aValue = a.deal_stages?.name || a.status || '';
        bValue = b.deal_stages?.name || b.status || '';
      }

      // Handle null/undefined values
      if (aValue == null) aValue = '';
      if (bValue == null) bValue = '';

      // Convert to string for comparison if needed
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [deals, searchQuery, stageFilter, selectedOwnerId, sortField, sortDirection]);

  // Update select all checkbox state
  useEffect(() => {
    setIsSelectAllChecked(
      selectedDeals.size > 0 && 
      selectedDeals.size === filteredAndSortedDeals.length && 
      filteredAndSortedDeals.length > 0
    );
  }, [selectedDeals.size, filteredAndSortedDeals.length]);

  // Calculate stats
  const totalValue = filteredAndSortedDeals.reduce((sum, deal) => sum + deal.value, 0);
  const avgProbability = filteredAndSortedDeals.length > 0 
    ? Math.round(filteredAndSortedDeals.reduce((sum, deal) => sum + deal.probability, 0) / filteredAndSortedDeals.length)
    : 0;

  const exportToCSV = () => {
    const csvContent = [
      ['Name', 'Company', 'Contact', 'Value', 'Stage', 'Probability', 'Close Date', 'Created'].join(','),
      ...filteredAndSortedDeals.map(deal => [
        `"${deal.name}"`,
        `"${deal.company}"`,
        `"${deal.contact_name || ''}"`,
        deal.value,
        `"${deal.deal_stages?.name || deal.status || ''}"`,
        deal.probability,
        `"${deal.close_date ? new Date(deal.close_date).toLocaleDateString() : ''}"`,
        new Date(deal.created_at).toLocaleDateString()
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `deals_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Deals exported successfully');
  };

  // Navigation and action handlers
  const handleDealNavigate = (deal: DealWithRelationships) => {
    // Navigate to deal details page when available
    console.log('Navigate to deal:', deal.id);
  };

  const handleEditDeal = (deal: DealWithRelationships) => {
    // Handle edit deal
    console.log('Edit deal:', deal.id);
  };

  const handleDeleteDeal = (deal: DealWithRelationships) => {
    // Authorization check
    const isAdmin = isUserAdmin(userData);
    const isOwner = deal.owner_id === userData?.id;
    
    if (!isAdmin && !isOwner) {
      toast.error('You do not have permission to delete this deal');
      return;
    }
    
    setDeletingDeal(deal);
  };

  const confirmDelete = async () => {
    if (!deletingDeal) return;
    
    try {
      await deleteDeal(deletingDeal.id);
      toast.success(`Deal "${deletingDeal.name}" deleted successfully`);
      setDeletingDeal(null);
    } catch (error) {
      toast.error('Failed to delete deal');
    }
  };

  const handleAddDeal = () => {
    // Navigate to add deal page when available
    console.log('Add new deal');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0
    }).format(value);
  };

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={className}
      >
        <div className="bg-gray-900/50 rounded-xl p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-800 rounded w-1/4"></div>
            <div className="h-4 bg-gray-800 rounded w-1/2"></div>
            <div className="space-y-3 mt-6">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-16 bg-gray-800/50 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={className}
      >
        <div className="bg-red-900/20 border border-red-700 rounded-xl p-6">
          <h3 className="text-red-400 font-medium mb-2">Error loading deals</h3>
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-4 border border-gray-800/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Value</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(totalValue)}</p>
            </div>
            <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
        </div>
        
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-4 border border-gray-800/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Deals</p>
              <p className="text-2xl font-bold text-white">{filteredAndSortedDeals.length}</p>
            </div>
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Heart className="w-5 h-5 text-blue-400" />
            </div>
          </div>
        </div>
        
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-4 border border-gray-800/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Avg Probability</p>
              <p className="text-2xl font-bold text-white">{avgProbability}%</p>
            </div>
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation and Controls */}
      {showControls && (
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl p-4 border border-gray-800/50 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Search and Controls */}
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search deals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-10 pr-4 py-1.5 text-xs bg-gray-800/50 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all duration-200 w-64"
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>

              {/* View mode toggle */}
              <ViewModeToggle
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                variant="compact"
              />

              {/* Add button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAddDeal}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg font-medium flex items-center gap-2 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300"
              >
                <Plus className="w-4 h-4" />
                Add Deal
              </motion.button>
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex flex-col sm:flex-row gap-4 mt-4 pt-4 border-t border-gray-800/50">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <OwnerFilterV3
                defaultToCurrentUser={true}
                showQuickFilters={false}
                compact={true}
                selectedOwnerId={selectedOwnerId}
                onOwnerChange={setSelectedOwnerId}
                className="w-full sm:w-[180px]"
              />

              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="h-8 w-full sm:w-[180px] bg-gray-800/50 border-gray-700 text-white text-xs px-3 py-1.5">
                  <SelectValue placeholder="All Stages" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="all">All Stages</SelectItem>
                  {stages.map(stage => (
                    <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button 
                onClick={exportToCSV} 
                variant="outline" 
                size="sm"
                className="border-gray-600 bg-gray-800/50 text-gray-100 hover:bg-gray-700/70 hover:text-white hover:border-gray-500"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button 
                onClick={toggleSelectMode}
                variant={isSelectModeActive ? "default" : "outline"}
                className={isSelectModeActive ? "bg-violet-600 hover:bg-violet-700 text-white" : ""} 
                size="sm"
              >
                {isSelectModeActive ? <CheckSquare className="w-4 h-4 mr-2" /> : <Square className="w-4 h-4 mr-2" />}
                {isSelectModeActive ? 'Exit Select' : 'Select Mode'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      <AnimatePresence>
        {isSelectModeActive && selectedDeals.size > 0 && (
          <motion.div 
            initial={{ opacity: 0, x: -20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.95 }}
            transition={{ 
              duration: 0.2,
              ease: [0.23, 1, 0.32, 1]
            }}
            className="bg-gradient-to-r from-violet-600/10 via-purple-600/10 to-violet-600/10 backdrop-blur-xl border border-violet-500/20 rounded-xl p-4 shadow-2xl shadow-violet-500/10 mb-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30">
                  <CheckSquare className="w-4 h-4 text-violet-400" />
                </div>
                <span className="text-sm font-medium text-white">
                  {selectedDeals.size} selected
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => setBulkDeleteDialogOpen(true)}
                  variant="outline"
                  size="sm"
                  className="border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50 text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Selected
                </Button>
                <Button 
                  onClick={() => {
                    setSelectedDeals(new Set());
                    setIsSelectAllChecked(false);
                  }}
                  variant="ghost" 
                  size="sm"
                  className="text-gray-400 hover:text-white hover:bg-gray-800/50"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' 
            : 'space-y-3'
          }
        >
          {filteredAndSortedDeals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              viewMode={viewMode}
              isSelected={selectedDeals.has(deal.id)}
              isSelectMode={isSelectModeActive}
              onSelect={handleSelectDeal}
              onEdit={handleEditDeal}
              onDelete={handleDeleteDeal}
              onNavigate={handleDealNavigate}
            />
          ))}
          
          {filteredAndSortedDeals.length === 0 && (
            <div className="col-span-full text-center py-12">
              <Heart className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-400 mb-2">No deals found</h3>
              <p className="text-gray-500 text-sm">
                {searchQuery || stageFilter !== 'all' 
                  ? 'Try adjusting your search criteria or filters'
                  : 'Get started by adding your first deal'
                }
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingDeal} onOpenChange={() => setDeletingDeal(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-red-400">Delete Deal</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete <span className="font-semibold text-white">"{deletingDeal?.name}"</span>? 
              This action cannot be undone and will also remove all associated activities and data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeletingDeal(null)}
              className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-red-400">Delete Selected Deals</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete <strong>{selectedDeals.size}</strong> selected deals? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setBulkDeleteDialogOpen(false)}
              className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete {selectedDeals.size} Deals
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

export default DealsView;