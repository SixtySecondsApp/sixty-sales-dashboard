import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  Search, 
  Plus, 
  Filter,
  Download,
  CheckSquare,
  Square,
  X,
  Trash2,
  SlidersHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OwnerFilter } from '@/components/OwnerFilter';
import { CRMNavigation } from '@/components/CRMNavigation';
import { CompanyDealsModal } from '@/components/CompanyDealsModal';
import CompanyCard from '@/components/CompanyCard';
import { QuickStatsBar } from '@/components/QuickStatsBar';
import { ViewModeToggle } from '@/components/ViewModeToggle';
import { useUser } from '@/lib/hooks/useUser';
import { useCompanies } from '@/lib/hooks/useCompanies';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Company } from '@/lib/database/models';

type SortField = 'name' | 'domain' | 'size' | 'industry' | 'contactCount' | 'dealsCount' | 'dealsValue' | 'created_at' | 'updated_at';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

export default function ElegantCRMPage() {
  const navigate = useNavigate();
  const { userData } = useUser();
  
  // Search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | undefined>(userData?.id);
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // View mode and selection
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [isSelectModeActive, setIsSelectModeActive] = useState(false);
  
  // Modals
  const [viewingCompanyDeals, setViewingCompanyDeals] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  // Set default owner when user data loads
  useEffect(() => {
    if (userData?.id && selectedOwnerId === undefined) {
      setSelectedOwnerId(userData.id);
    }
  }, [userData?.id, selectedOwnerId]);

  // Use the existing useCompanies hook
  const { 
    companies, 
    isLoading, 
    error: hookError,
    deleteCompany
  } = useCompanies({
    search: searchTerm,
    includeStats: true
  });

  const error = hookError?.message || null;

  // Filter and sort companies
  const filteredAndSortedCompanies = useMemo(() => {
    let filtered = companies.filter(company => {
      const matchesSize = sizeFilter === 'all' || company.size === sizeFilter;
      const matchesIndustry = industryFilter === 'all' || company.industry === industryFilter;
      const matchesOwner = !selectedOwnerId || company.owner_id === selectedOwnerId;
      
      return matchesSize && matchesIndustry && matchesOwner;
    });

    // Sort companies
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (aValue == null) aValue = '';
      if (bValue == null) bValue = '';

      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [companies, sizeFilter, industryFilter, selectedOwnerId, sortField, sortDirection]);

  // Get unique values for filters
  const uniqueSizes = [...new Set(companies.map(c => c.size).filter(Boolean))];
  const uniqueIndustries = [...new Set(companies.map(c => c.industry).filter(Boolean))];

  // Handlers
  const handleCompanyClick = (company: Company) => {
    navigate(`/companies/${company.id}`);
  };

  const handleEditCompany = (company: Company) => {
    navigate(`/companies/${company.id}`);
  };

  const handleDeleteCompany = (company: Company) => {
    setDeletingCompany(company);
  };

  const confirmDelete = async () => {
    if (!deletingCompany) return;
    
    await deleteCompany(deletingCompany.id);
    setDeletingCompany(null);
  };

  const handleAddCompany = () => {
    navigate('/companies/new');
  };

  const exportToCSV = () => {
    const csvContent = [
      ['Name', 'Domain', 'Size', 'Industry', 'Contacts', 'Deals', 'Value', 'Created'].join(','),
      ...filteredAndSortedCompanies.map(company => [
        `"${company.name}"`,
        `"${company.domain || ''}"`,
        `"${company.size || ''}"`,
        `"${company.industry || ''}"`,
        company.contactCount || 0,
        company.dealsCount || 0,
        company.dealsValue || 0,
        new Date(company.created_at).toLocaleDateString()
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `companies_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Companies exported successfully');
  };

  // Multi-select handlers
  const handleSelectCompany = (companyId: string, isSelected: boolean) => {
    const newSelected = new Set(selectedCompanies);
    if (isSelected) {
      newSelected.add(companyId);
    } else {
      newSelected.delete(companyId);
    }
    setSelectedCompanies(newSelected);
  };

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      const allIds = new Set(filteredAndSortedCompanies.map(company => company.id));
      setSelectedCompanies(allIds);
    } else {
      setSelectedCompanies(new Set());
    }
  };

  const toggleSelectMode = () => {
    setIsSelectModeActive(!isSelectModeActive);
    if (isSelectModeActive) {
      setSelectedCompanies(new Set());
    }
  };

  const handleBulkDelete = async () => {
    try {
      const selectedIds = Array.from(selectedCompanies);
      
      if (selectedIds.length === 0) {
        toast.error('No companies selected');
        return;
      }

      const deletePromises = selectedIds.map(id => deleteCompany(id));
      await Promise.all(deletePromises);

      setSelectedCompanies(new Set());
      setBulkDeleteDialogOpen(false);
      setIsSelectModeActive(false);
      
      toast.success(`Successfully deleted ${selectedIds.length} companies`);
    } catch (error) {
      toast.error('Failed to delete selected companies');
    }
  };

  if (isLoading) {
    return (
      <div>
        <CRMNavigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-gray-900/50 rounded-xl p-8">
            <div className="animate-pulse space-y-6">
              {/* Stats skeleton */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-24 bg-gray-800/50 rounded-lg"></div>
                ))}
              </div>
              {/* Header skeleton */}
              <div className="h-8 bg-gray-800 rounded w-1/4"></div>
              <div className="h-4 bg-gray-800 rounded w-1/2"></div>
              {/* Cards skeleton */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-64 bg-gray-800/50 rounded-lg"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <CRMNavigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-900/20 border border-red-700 rounded-xl p-6">
            <h3 className="text-red-400 font-medium mb-2">Error loading companies</h3>
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <CRMNavigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <QuickStatsBar companies={companies} />
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">Companies</h1>
                  <p className="text-gray-400">
                    {filteredAndSortedCompanies.length} of {companies.length} companies
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ViewModeToggle
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                variant="compact"
              />
              <Button
                onClick={handleAddCompany}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Company
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-900/50 rounded-xl p-6 mb-6 border border-gray-800"
        >
          <div className="flex flex-col gap-4">
            {/* Top row: Search and Owner Filter */}
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search companies by name or domain..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-800/50 border-gray-700 text-white placeholder-gray-400"
                />
              </div>
              
              <OwnerFilter
                selectedOwnerId={selectedOwnerId}
                onOwnerChange={setSelectedOwnerId}
                className="w-full sm:w-[200px]"
              />
            </div>
            
            {/* Bottom row: Filters and actions */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-4 flex-1">
                <Select value={sizeFilter} onValueChange={setSizeFilter}>
                  <SelectTrigger className="w-full sm:w-[180px] bg-gray-800/50 border-gray-700 text-white">
                    <SelectValue placeholder="All Sizes" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="all">All Sizes</SelectItem>
                    {uniqueSizes.map(size => (
                      <SelectItem key={size} value={size}>{size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={industryFilter} onValueChange={setIndustryFilter}>
                  <SelectTrigger className="w-full sm:w-[180px] bg-gray-800/50 border-gray-700 text-white">
                    <SelectValue placeholder="All Industries" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="all">All Industries</SelectItem>
                    {uniqueIndustries.map(industry => (
                      <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={exportToCSV} 
                  variant="outline" 
                  size="sm"
                  className="border-gray-600 bg-gray-800/50 text-gray-100 hover:bg-gray-700/70"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button 
                  onClick={toggleSelectMode}
                  variant={isSelectModeActive ? "default" : "outline"}
                  className={isSelectModeActive ? "bg-purple-600 hover:bg-purple-700 text-white" : ""} 
                  size="sm"
                >
                  {isSelectModeActive ? <CheckSquare className="w-4 h-4 mr-2" /> : <Square className="w-4 h-4 mr-2" />}
                  {isSelectModeActive ? 'Exit Select' : 'Select Mode'}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Bulk Actions */}
        <AnimatePresence>
          {isSelectModeActive && selectedCompanies.size > 0 && (
            <motion.div 
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-gradient-to-r from-purple-600/10 via-violet-600/10 to-purple-600/10 backdrop-blur-xl border border-purple-500/20 rounded-xl p-4 shadow-2xl shadow-purple-500/10 mb-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30">
                    <CheckSquare className="w-4 h-4 text-purple-400" />
                  </div>
                  <span className="text-sm font-medium text-white">
                    {selectedCompanies.size} selected
                  </span>
                  {filteredAndSortedCompanies.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSelectAll(selectedCompanies.size < filteredAndSortedCompanies.length)}
                      className="text-purple-400 hover:text-purple-300 hover:bg-purple-400/10"
                    >
                      {selectedCompanies.size === filteredAndSortedCompanies.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  )}
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
                      setSelectedCompanies(new Set());
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

        {/* Companies Grid/List */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {filteredAndSortedCompanies.length === 0 ? (
            <div className="text-center py-16">
              <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-6" />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">No companies found</h3>
              <p className="text-gray-500 mb-6">
                {searchTerm || sizeFilter !== 'all' || industryFilter !== 'all' 
                  ? 'Try adjusting your search criteria or filters'
                  : 'Get started by adding your first company'
                }
              </p>
              <Button 
                onClick={handleAddCompany}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Company
              </Button>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {viewMode === 'grid' ? (
                <motion.div
                  key="grid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                >
                  {filteredAndSortedCompanies.map((company) => (
                    <CompanyCard
                      key={company.id}
                      company={company}
                      viewMode="grid"
                      isSelected={selectedCompanies.has(company.id)}
                      showSelectMode={isSelectModeActive}
                      onSelect={handleSelectCompany}
                      onEdit={handleEditCompany}
                      onDelete={handleDeleteCompany}
                      onClick={handleCompanyClick}
                    />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {filteredAndSortedCompanies.map((company) => (
                    <CompanyCard
                      key={company.id}
                      company={company}
                      viewMode="list"
                      isSelected={selectedCompanies.has(company.id)}
                      showSelectMode={isSelectModeActive}
                      onSelect={handleSelectCompany}
                      onEdit={handleEditCompany}
                      onDelete={handleDeleteCompany}
                      onClick={handleCompanyClick}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </motion.div>
      </div>

      {/* Modals */}
      <CompanyDealsModal
        isOpen={!!viewingCompanyDeals}
        onClose={() => setViewingCompanyDeals(null)}
        companyId={viewingCompanyDeals?.id || null}
        companyName={viewingCompanyDeals?.name || ''}
      />

      <Dialog open={!!deletingCompany} onOpenChange={() => setDeletingCompany(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-red-400">Delete Company</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete <span className="font-semibold text-white">"{deletingCompany?.name}"</span>? 
              This action cannot be undone and will also remove all associated contacts, deals, and activities.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeletingCompany(null)}
              className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Company
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-red-400">Delete Selected Companies</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete <strong>{selectedCompanies.size}</strong> selected companies? This action cannot be undone.
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
              Delete {selectedCompanies.size} Companies
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}