import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Search, 
  Plus, 
  Filter,
  Download,
  CheckSquare,
  Square,
  X,
  Trash2,
  Mail,
  Phone
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
import ContactCard from '@/components/ContactCard';
import ViewModeToggle from '@/components/ViewModeToggle';
import { OwnerFilterV3 } from '@/components/OwnerFilterV3';
import { useUser } from '@/lib/hooks/useUser';
import { useDebouncedSearch, filterItems } from '@/lib/hooks/useDebounce';
import { API_BASE_URL } from '@/lib/config';
import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';
import { isUserAdmin } from '@/lib/utils/adminUtils';

interface Contact {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email: string;
  phone?: string | null;
  company_name?: string;
  title?: string;
  created_at: string;
  updated_at: string;
  is_primary?: boolean;
  owner_id?: string;
  company?: {
    id?: string;
    name: string;
    domain?: string;
    size?: string;
    industry?: string;
  };
}

type SortField = 'full_name' | 'email' | 'title' | 'company_name' | 'is_primary' | 'created_at' | 'updated_at';
type SortDirection = 'asc' | 'desc';

interface ContactsViewProps {
  className?: string;
  showControls?: boolean;
  contacts?: Contact[];
  isLoading?: boolean;
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
}

export function ContactsView({ 
  className, 
  showControls = true, 
  contacts: externalContacts, 
  isLoading: externalIsLoading,
  viewMode: externalViewMode,
  onViewModeChange: externalOnViewModeChange
}: ContactsViewProps) {
  const navigate = useNavigate();
  const { userData, isLoading: isUserLoading } = useUser();
  
  // State management
  const [internalContacts, setInternalContacts] = useState<Contact[]>([]);
  const [internalIsLoading, setInternalIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { searchQuery, debouncedSearchQuery, isSearching, setSearchQuery } = useDebouncedSearch('', 400);
  const [internalViewMode, setInternalViewMode] = useState<'grid' | 'list'>('grid');
  
  // Use external viewMode if provided, otherwise use internal
  const viewMode = externalViewMode || internalViewMode;
  const setViewMode = externalOnViewModeChange || setInternalViewMode;
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  // Initialize with undefined to let OwnerFilterV3 set default to "My Items"
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null | undefined>(undefined);
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Multi-select functionality
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isSelectAllChecked, setIsSelectAllChecked] = useState(false);
  const [isSelectModeActive, setIsSelectModeActive] = useState(false);
  
  // Deletion state
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);


  // Use external data if provided, otherwise use internal data
  const contacts = externalContacts !== undefined ? externalContacts : internalContacts;
  const isLoading = externalIsLoading !== undefined ? externalIsLoading : internalIsLoading;
  
  // Debug logging
  logger.log('ContactsView data source:', {
    usingExternal: externalContacts !== undefined,
    externalCount: externalContacts?.length,
    internalCount: internalContacts?.length,
    totalContacts: contacts?.length
  });


  // Fetch contacts (only if external data is not provided)
  useEffect(() => {
    // Only fetch internal data if no external data is provided
    if (externalContacts !== undefined) return;
    
    const fetchContacts = async () => {
      try {
        setInternalIsLoading(true);
        setError(null);
        
        // Check authentication first
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // Service key fallback
          const { supabaseAdmin } = await import('@/lib/supabase/clientV3-optimized');
          const serviceSupabase = supabaseAdmin;
          
          let query = (serviceSupabase as any)
            .from('contacts')
            .select('*');
          
          // Apply search filter
          if (debouncedSearchQuery && debouncedSearchQuery.trim()) {
            const searchPattern = `%${debouncedSearchQuery.trim()}%`;
            query = query.or(`first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},email.ilike.${searchPattern},company_name.ilike.${searchPattern}`);
          }
          
          const { data: serviceContactsData, error: serviceError } = await query
            .order('updated_at', { ascending: false });
            
          if (serviceError) {
            logger.error('❌ Service key contacts fallback failed:', serviceError);
            throw serviceError;
          }
          
          const processedContacts = serviceContactsData?.map((contact: any) => ({
            ...contact,
            is_primary: contact.is_primary || false,
            company: contact.company_name ? { name: contact.company_name } : null
          })) || [];
          
          setInternalContacts(processedContacts);
          setInternalIsLoading(false);
          return;
        }

        // Try Edge Functions first for authenticated users
        const params = new URLSearchParams({
          includeCompany: 'true'
        });
        
        if (debouncedSearchQuery) {
          params.append('search', debouncedSearchQuery);
        }

        try {
          const response = await fetch(`${API_BASE_URL}/contacts?${params}`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const result = await response.json();
          
          if (result.error) {
            throw new Error(result.error);
          }

          setInternalContacts(result.data || []);
        } catch (edgeError) {
          logger.error('Edge Functions failed, falling back to service key:', edgeError);
          
          // Fallback to service key
          const { supabaseAdmin } = await import('@/lib/supabase/clientV3-optimized');
          const serviceSupabase = supabaseAdmin;
          
          let query = (serviceSupabase as any)
            .from('contacts')
            .select('*');
          
          if (debouncedSearchQuery && debouncedSearchQuery.trim()) {
            const searchPattern = `%${debouncedSearchQuery.trim()}%`;
            query = query.or(`first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},email.ilike.${searchPattern},company_name.ilike.${searchPattern}`);
          }
          
          const { data: fallbackData, error: fallbackError } = await query
            .order('updated_at', { ascending: false });
            
          if (fallbackError) {
            throw fallbackError;
          }
          
          const processedContacts = fallbackData?.map((contact: any) => ({
            ...contact,
            is_primary: contact.is_primary || false,
            company: contact.company_name ? { name: contact.company_name } : null
          })) || [];
          
          setInternalContacts(processedContacts);
        }
        
        setInternalIsLoading(false);
      } catch (error) {
        console.error('Error fetching contacts:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch contacts');
        setInternalIsLoading(false);
      }
    };

    fetchContacts();
  }, [debouncedSearchQuery, externalContacts]);

  // Multi-select handlers
  const handleSelectContact = (contactId: string, isSelected: boolean) => {
    const newSelected = new Set(selectedContacts);
    if (isSelected) {
      newSelected.add(contactId);
    } else {
      newSelected.delete(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const handleSelectAll = (isSelected: boolean, filteredContacts: Contact[]) => {
    if (isSelected) {
      const allIds = new Set(filteredContacts.map(contact => contact.id));
      setSelectedContacts(allIds);
    } else {
      setSelectedContacts(new Set());
    }
    setIsSelectAllChecked(isSelected);
  };

  const toggleSelectMode = () => {
    setIsSelectModeActive(!isSelectModeActive);
    if (isSelectModeActive) {
      setSelectedContacts(new Set());
      setIsSelectAllChecked(false);
    }
  };

  // Delete contact function
  const deleteContact = async (contactId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      const { supabaseAdmin } = await import('@/lib/supabase/clientV3-optimized');
      const { error } = await (supabaseAdmin as any)
        .from('contacts')
        .delete()
        .eq('id', contactId);
      
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contactId);
      
      if (error) throw error;
    }
    
    // Only update internal state if we're managing internal data
    if (!externalContacts) {
      setInternalContacts(prev => prev.filter(c => c.id !== contactId));
    }
  };

  const handleBulkDelete = async () => {
    try {
      const selectedIds = Array.from(selectedContacts);
      
      if (selectedIds.length === 0) {
        toast.error('No contacts selected');
        return;
      }

      // Authorization check
      const isAdmin = isUserAdmin(userData);
      const authorizedContacts = filteredAndSortedContacts.filter(contact => 
        selectedIds.includes(contact.id) && (isAdmin || contact.owner_id === userData?.id)
      );

      if (authorizedContacts.length !== selectedIds.length) {
        const unauthorizedCount = selectedIds.length - authorizedContacts.length;
        toast.error(`You do not have permission to delete ${unauthorizedCount} of the selected contacts`);
        
        if (authorizedContacts.length === 0) {
          return;
        }
      }

      // Delete only authorized contacts
      const deletePromises = authorizedContacts.map(contact => deleteContact(contact.id));
      await Promise.all(deletePromises);

      setSelectedContacts(new Set());
      setIsSelectAllChecked(false);
      setBulkDeleteDialogOpen(false);
      
      toast.success(`Successfully deleted ${authorizedContacts.length} contacts`);
    } catch (error) {
      console.error('Error deleting contacts:', error);
      toast.error('Failed to delete selected contacts');
    }
  };

  // Filter and sort contacts
  const filteredAndSortedContacts = useMemo(() => {
    let filtered = contacts.filter(contact => {
      // Don't apply owner filter when using external contacts
      const matchesOwner = externalContacts !== undefined 
        ? true 
        : (selectedOwnerId === null || 
           (selectedOwnerId === undefined && contact.owner_id === userData?.id) || // Default to current user's items when undefined
           contact.owner_id === selectedOwnerId);
      const matchesCompany = companyFilter === 'all' || 
        (contact.company_name && contact.company_name.toLowerCase().includes(companyFilter.toLowerCase()));
      
      return matchesOwner && matchesCompany;
    });

    // Apply local instant filtering for better UX during typing
    if (searchQuery && searchQuery.trim()) {
      filtered = filterItems(filtered, searchQuery, [
        'first_name', 
        'last_name', 
        'email', 
        'company_name'
      ]);
    }

    // Sort contacts
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle full_name sorting
      if (sortField === 'full_name') {
        aValue = `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email;
        bValue = `${b.first_name || ''} ${b.last_name || ''}`.trim() || b.email;
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
  }, [contacts, searchQuery, companyFilter, selectedOwnerId, sortField, sortDirection, externalContacts]);

  // Update select all checkbox state
  useEffect(() => {
    setIsSelectAllChecked(
      selectedContacts.size > 0 && 
      selectedContacts.size === filteredAndSortedContacts.length && 
      filteredAndSortedContacts.length > 0
    );
  }, [selectedContacts.size, filteredAndSortedContacts.length]);

  // Get unique company names for filters
  const uniqueCompanies = [...new Set(contacts.map(c => c.company_name).filter(Boolean))];

  const exportToCSV = () => {
    const csvContent = [
      ['Name', 'Email', 'Phone', 'Title', 'Company', 'Created'].join(','),
      ...filteredAndSortedContacts.map(contact => [
        `"${`${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.email}"`,
        `"${contact.email}"`,
        `"${contact.phone || ''}"`,
        `"${contact.title || ''}"`,
        `"${contact.company_name || ''}"`,
        new Date(contact.created_at).toLocaleDateString()
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `contacts_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Contacts exported successfully');
  };

  // Navigation and action handlers
  const handleContactNavigate = (contact: Contact) => {
    // Navigate to contact profile page
    navigate(`/crm/contacts/${contact.id}`);
  };

  const handleEditContact = (contact: Contact) => {
    // Handle edit contact
    console.log('Edit contact:', contact.id);
  };

  const handleDeleteContact = (contact: Contact) => {
    // Authorization check
    const isAdmin = isUserAdmin(userData);
    const isOwner = contact.owner_id === userData?.id;
    
    if (!isAdmin && !isOwner) {
      toast.error('You do not have permission to delete this contact');
      return;
    }
    
    setDeletingContact(contact);
  };

  const confirmDelete = async () => {
    if (!deletingContact) return;
    
    try {
      await deleteContact(deletingContact.id);
      toast.success(`Contact "${deletingContact.first_name} ${deletingContact.last_name}" deleted successfully`);
      setDeletingContact(null);
    } catch (error) {
      toast.error('Failed to delete contact');
    }
  };

  const handleAddContact = () => {
    // Navigate to add contact page when available
    console.log('Add new contact');
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
          <h3 className="text-red-400 font-medium mb-2">Error loading contacts</h3>
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
                  placeholder="Search contacts..."
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
                onClick={handleAddContact}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg font-medium flex items-center gap-2 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300"
              >
                <Plus className="w-4 h-4" />
                Add Contact
              </motion.button>
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex flex-col sm:flex-row gap-4 mt-4 pt-4 border-t border-gray-800/50">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              {/* Only show owner filter when managing internal contacts */}
              {externalContacts === undefined && (
                <OwnerFilterV3
                  selectedOwnerId={selectedOwnerId}
                  onOwnerChange={setSelectedOwnerId}
                  className="w-full sm:w-[180px]"
                  defaultToCurrentUser={true}
                  showQuickFilters={false}
                  compact={true}
                />
              )}

              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="h-8 w-full sm:w-[180px] bg-gray-800/50 border-gray-700 text-white text-xs px-3 py-1.5">
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="all">All Companies</SelectItem>
                  {uniqueCompanies.map(company => (
                    <SelectItem key={company} value={company}>{company}</SelectItem>
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
        {isSelectModeActive && selectedContacts.size > 0 && (
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
                  {selectedContacts.size} selected
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
                    setSelectedContacts(new Set());
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
          {filteredAndSortedContacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              viewMode={viewMode}
              isSelected={selectedContacts.has(contact.id)}
              isSelectMode={isSelectModeActive}
              onSelect={handleSelectContact}
              onEdit={handleEditContact}
              onDelete={handleDeleteContact}
              onNavigate={handleContactNavigate}
            />
          ))}
          
          {filteredAndSortedContacts.length === 0 && (
            <div className="col-span-full text-center py-12">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-400 mb-2">No contacts found</h3>
              <p className="text-gray-500 text-sm">
                {searchQuery || companyFilter !== 'all' 
                  ? 'Try adjusting your search criteria or filters'
                  : 'Get started by adding your first contact'
                }
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingContact} onOpenChange={() => setDeletingContact(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-red-400">Delete Contact</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete <span className="font-semibold text-white">"{deletingContact?.first_name} {deletingContact?.last_name}"</span>? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeletingContact(null)}
              className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-red-400">Delete Selected Contacts</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete <strong>{selectedContacts.size}</strong> selected contacts? This action cannot be undone.
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
              Delete {selectedContacts.size} Contacts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

export default ContactsView;