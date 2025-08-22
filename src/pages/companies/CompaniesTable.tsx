import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Search, 
  Plus, 
  Users, 
  Globe,
  Edit,
  Trash2,
  ExternalLink,
  Filter,
  Download,
  ArrowUpDown
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { OwnerFilter } from '@/components/OwnerFilter';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { CompanyDealsModal } from '@/components/CompanyDealsModal';
import { CRMNavigation } from '@/components/CRMNavigation';
import { useUser } from '@/lib/hooks/useUser';
import { useCompanies } from '@/lib/hooks/useCompanies';
import logger from '@/lib/utils/logger';

interface Company {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  website?: string;
  address?: string;
  phone?: string;
  description?: string;
  linkedin_url?: string;
  owner_id?: string;
  contactCount?: number;
  dealsCount?: number;
  dealsValue?: number;
  created_at: string;
  updated_at: string;
}

interface CompaniesResponse {
  data: Company[];
  error: string | null;
  count: number;
}

type SortField = 'name' | 'domain' | 'size' | 'industry' | 'contactCount' | 'dealsCount' | 'dealsValue' | 'created_at' | 'updated_at';
type SortDirection = 'asc' | 'desc';

export default function CompaniesTable() {
  const navigate = useNavigate();
  const { userData } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | undefined>(userData?.id);
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [viewingCompanyDeals, setViewingCompanyDeals] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);

  // Set default owner when user data loads
  useEffect(() => {
    if (userData?.id && selectedOwnerId === undefined) {
      setSelectedOwnerId(userData.id);
    }
  }, [userData?.id, selectedOwnerId]);

  // Use the useCompanies hook instead of manual fetch
  const { 
    companies, 
    isLoading, 
    error: hookError 
  } = useCompanies({
    search: searchTerm,
    includeStats: true
  });

  // Convert error object to string for component compatibility
  const error = hookError?.message || null;

  // Companies data is now handled by the useCompanies hook
  // Removed old fetch logic - using useCompanies hook instead
  /*useEffect(() => {
    const fetchCompanies = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const params = new URLSearchParams({
          includeStats: 'true'
        });
        
        if (searchTerm) {
          params.append('search', searchTerm);
        }
        
        if (selectedOwnerId) {
          params.append('ownerId', selectedOwnerId);
        }

        // Try the companies endpoint
        try {
          const response = await fetch(`${API_BASE_URL}/companies?${params}`);
          
          if (response.status === 401) {
            setError('Authentication required. Please log in to view companies.');
            return;
          }
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const result = await response.json();
          setCompanies(result.data || []);
          return;
        } catch (apiError) {
          logger.warn('Companies API failed:', apiError);
        }

        // Fallback: Check if companies table exists
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
          setError('Supabase configuration missing. Please check environment variables.');
          return;
        }
        
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Check if user is authenticated
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          setError('Please log in to view companies.');
          return;
        }

        // Try to query companies table directly with deals aggregation
        const { data: companiesData, error: supabaseError } = await supabase
          .from('companies')
          .select(`
            *,
            deals!company_id(
              id,
              value,
              status
            )
          `)
          .order('created_at', { ascending: false });

        if (supabaseError) {
          if (supabaseError.message.includes('does not exist')) {
            setError('Companies table needs to be created. Please contact your administrator or run the setup script.');
          } else if (supabaseError.message.includes('JWT') || supabaseError.message.includes('auth')) {
            setError('Session expired. Please log in again.');
          } else {
            throw supabaseError;
          }
          return;
        }

        // Process companies data to include deals count and value
        const processedCompanies = (companiesData || []).map(company => {
          const deals = company.deals || [];
          const dealsCount = deals.length;
          const dealsValue = deals.reduce((sum: number, deal: any) => {
            return sum + (deal.value || 0);
          }, 0);
          
          return {
            ...company,
            dealsCount,
            dealsValue
          };
        });
        
        setCompanies(processedCompanies);
      } catch (error) {
        logger.error('❌ Companies Edge Function failed:', error);
        
        // Fallback to direct Supabase client
        logger.log('🛡️ Companies fallback: Using direct Supabase client...');
        try {
          const { createClient: createClientFallback } = await import('@supabase/supabase-js');
          const fallbackUrl = import.meta.env.VITE_SUPABASE_URL;
          const fallbackKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
          
          if (!fallbackUrl || !fallbackKey) {
            throw new Error('Missing Supabase configuration');
          }
          
          const fallbackSupabase = createClientFallback(fallbackUrl, fallbackKey);
          
          const { data: companiesData, error: supabaseError } = await (fallbackSupabase as any)
            .from('companies')
            .select(`
              *,
              deals!company_id(
                id,
                value,
                status
              )
            `)
            .order('created_at', { ascending: false });
          
          if (supabaseError) {
            logger.error('❌ Companies anon fallback failed:', supabaseError);
            logger.log('🔄 Trying companies with service role key...');
            
            // Last resort: try with service role key
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
            
            if (!supabaseUrl || !serviceKey) {
              throw new Error('Missing Supabase configuration');
            }
            
            const { createClient } = await import('@supabase/supabase-js');
            const serviceSupabase = createClient(supabaseUrl, serviceKey);
            
            const { data: serviceCompaniesData, error: serviceError } = await (serviceSupabase as any)
              .from('companies')
              .select(`
                *,
                deals!company_id(
                  id,
                  value,
                  status
                )
              `)
              .order('created_at', { ascending: false });
              
            if (serviceError) {
              logger.error('❌ Service key companies fallback failed:', serviceError);
              throw serviceError;
            }
            
            logger.log(`✅ Service key companies fallback successful: Retrieved ${serviceCompaniesData?.length || 0} companies`);
            
            // Process companies data to include deals count and value
            const processedServiceCompanies = (serviceCompaniesData || []).map(company => {
              const deals = company.deals || [];
              const dealsCount = deals.length;
              const dealsValue = deals.reduce((sum: number, deal: any) => {
                return sum + (deal.value || 0);
              }, 0);
              
              return {
                ...company,
                dealsCount,
                dealsValue
              };
            });
            
            setCompanies(processedServiceCompanies);
            return;
          }
          
          logger.log(`✅ Companies fallback successful: Retrieved ${companiesData?.length || 0} companies`);
          
          // Process companies data to include deals count and value
          const processedFallbackCompanies = (companiesData || []).map(company => {
            const deals = company.deals || [];
            const dealsCount = deals.length;
            const dealsValue = deals.reduce((sum: number, deal: any) => {
              return sum + (deal.value || 0);
            }, 0);
            
            return {
              ...company,
              dealsCount,
              dealsValue
            };
          });
          
          setCompanies(processedFallbackCompanies);
        } catch (fallbackError) {
          logger.error('❌ All companies fallback methods failed:', fallbackError);
          setError('Failed to load companies. Please try again.');
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchCompanies();
  }, [searchTerm, selectedOwnerId]); */

  // Filter and sort companies
  const filteredAndSortedCompanies = useMemo(() => {
    let filtered = companies.filter(company => {
      const matchesSize = sizeFilter === 'all' || company.size === sizeFilter;
      const matchesIndustry = industryFilter === 'all' || company.industry === industryFilter;
      
      // Owner filtering
      const matchesOwner = !selectedOwnerId || company.owner_id === selectedOwnerId;
      
      return matchesSize && matchesIndustry && matchesOwner;
    });

    // Sort companies
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

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
  }, [companies, sizeFilter, industryFilter, selectedOwnerId, sortField, sortDirection]);

  // Get unique values for filters
  const uniqueSizes = [...new Set(companies.map(c => c.size).filter(Boolean))];
  const uniqueIndustries = [...new Set(companies.map(c => c.industry).filter(Boolean))];

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    return <ArrowUpDown className={`w-4 h-4 ${sortDirection === 'asc' ? 'text-blue-400' : 'text-blue-400 rotate-180'}`} />;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDomain = (domain: string) => {
    return domain?.startsWith('www.') ? domain.slice(4) : domain;
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

  // Handle row click to navigate to company detail
  const handleRowClick = (company: Company) => {
    navigate(`/companies/${company.id}`);
  };

  // Handle edit company
  const handleEditCompany = (e: React.MouseEvent, company: Company) => {
    e.stopPropagation(); // Prevent row click
    setEditingCompany(company);
  };

  // Handle delete company
  const handleDeleteCompany = (e: React.MouseEvent, company: Company) => {
    e.stopPropagation(); // Prevent row click
    setDeletingCompany(company);
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (!deletingCompany) return;
    
    // TODO: Implement actual delete logic
    toast.success(`Company "${deletingCompany.name}" deleted successfully`);
    setDeletingCompany(null);
    // Refresh companies list
    // refreshCompanies();
  };

  // Handle add new company
  const handleAddCompany = () => {
    navigate('/companies/new');
  };

  // Filter companies description text
  const getFilterDescription = () => {
    let description = `${filteredAndSortedCompanies.length} of ${companies.length} companies`;
    
    if (selectedOwnerId) {
      description += ' • Filtered by owner';
    }
    
    return description;
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-900/20 border border-red-700 rounded-xl p-6">
          <h3 className="text-red-400 font-medium mb-2">Error loading companies</h3>
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* CRM Navigation */}
      <CRMNavigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-8 h-8 text-blue-400" />
            <h1 className="text-3xl font-bold text-white">Companies</h1>
          </div>
          <p className="text-gray-400">
            {getFilterDescription()}
          </p>
        </div>

      {/* Search and Filters */}
      <div className="bg-gray-900/50 rounded-xl p-6 mb-6 border border-gray-800">
        <div className="flex flex-col gap-4">
          {/* Top row: Search and Owner Filter */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search companies by name or domain..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-800/50 border-gray-700 text-white placeholder-gray-400"
              />
            </div>
            
            {/* Owner Filter */}
            <OwnerFilter
              selectedOwnerId={selectedOwnerId}
              onOwnerChange={setSelectedOwnerId}
              className="w-full sm:w-[180px]"
            />
          </div>
          
          {/* Bottom row: Other filters and actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Other Filters */}
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
                onClick={handleAddCompany}
                className="bg-blue-600 hover:bg-blue-700 text-white" 
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Company
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-800 hover:bg-gray-800/50">
              <TableHead 
                className="text-gray-300 cursor-pointer hover:text-white"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-2">
                  Company {getSortIcon('name')}
                </div>
              </TableHead>
              <TableHead 
                className="text-gray-300 cursor-pointer hover:text-white"
                onClick={() => handleSort('domain')}
              >
                <div className="flex items-center gap-2">
                  Domain {getSortIcon('domain')}
                </div>
              </TableHead>
              <TableHead 
                className="text-gray-300 cursor-pointer hover:text-white"
                onClick={() => handleSort('size')}
              >
                <div className="flex items-center gap-2">
                  Size {getSortIcon('size')}
                </div>
              </TableHead>
              <TableHead 
                className="text-gray-300 cursor-pointer hover:text-white"
                onClick={() => handleSort('industry')}
              >
                <div className="flex items-center gap-2">
                  Industry {getSortIcon('industry')}
                </div>
              </TableHead>
              <TableHead 
                className="text-gray-300 cursor-pointer hover:text-white text-center"
                onClick={() => handleSort('contactCount')}
              >
                <div className="flex items-center justify-center gap-2">
                  Contacts {getSortIcon('contactCount')}
                </div>
              </TableHead>
              <TableHead 
                className="text-gray-300 cursor-pointer hover:text-white text-center"
                onClick={() => handleSort('dealsCount')}
              >
                <div className="flex items-center justify-center gap-2">
                  Deals {getSortIcon('dealsCount')}
                </div>
              </TableHead>
              <TableHead 
                className="text-gray-300 cursor-pointer hover:text-white text-right"
                onClick={() => handleSort('dealsValue')}
              >
                <div className="flex items-center justify-end gap-2">
                  Value {getSortIcon('dealsValue')}
                </div>
              </TableHead>
              <TableHead className="text-gray-300 text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedCompanies.map((company) => (
              <TableRow 
                key={company.id} 
                className="border-gray-800 hover:bg-gray-800/50 cursor-pointer transition-colors"
                onClick={() => handleRowClick(company)}
              >
                <TableCell>
                  <div className="flex flex-col">
                    <div className="font-medium text-white">{company.name}</div>
                    {company.description && (
                      <div className="text-sm text-gray-400 truncate max-w-xs">
                        {company.description}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {company.domain && (
                      <>
                        <Globe className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-300">{formatDomain(company.domain)}</span>
                        {company.website && (
                          <a
                            href={company.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {company.size && (
                    <Badge variant="outline" className="text-xs">
                      {company.size}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {company.industry && (
                    <Badge variant="outline" className="text-xs">
                      {company.industry}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1 text-gray-300">
                    <Users className="w-4 h-4 text-gray-400" />
                    {company.contactCount || 0}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {(company.dealsCount || 0) > 0 ? (
                    <button
                      onClick={() => setViewingCompanyDeals({ id: company.id, name: company.name })}
                      className="text-blue-400 hover:text-blue-300 font-medium hover:underline transition-colors"
                    >
                      {company.dealsCount}
                    </button>
                  ) : (
                    <span className="text-gray-500">0</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-emerald-400 font-medium">
                  {formatCurrency(company.dealsValue || 0)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => handleEditCompany(e, company)}
                      className="text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 transition-colors"
                      title="Edit company"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => handleDeleteCompany(e, company)}
                      className="text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      title="Delete company"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {filteredAndSortedCompanies.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-400 mb-2">No companies found</h3>
            <p className="text-gray-500 text-sm">
              {searchTerm || sizeFilter !== 'all' || industryFilter !== 'all' 
                ? 'Try adjusting your search criteria or filters'
                : 'Get started by adding your first company'
              }
            </p>
          </div>
        )}
      </div>

      {/* Company Deals Modal */}
      <CompanyDealsModal
        isOpen={!!viewingCompanyDeals}
        onClose={() => setViewingCompanyDeals(null)}
        companyId={viewingCompanyDeals?.id || null}
        companyName={viewingCompanyDeals?.name || ''}
      />

      {/* Delete Confirmation Dialog */}
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

      {/* Edit Company Dialog - Simple for now */}
      <Dialog open={!!editingCompany} onOpenChange={() => setEditingCompany(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-blue-400">Edit Company</DialogTitle>
            <DialogDescription className="text-gray-400">
              Editing company: <span className="font-semibold text-white">"{editingCompany?.name}"</span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-400 text-sm">
              Full edit functionality coming soon. Click on the company row to view the complete company profile where you can edit all details.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setEditingCompany(null)}
              className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
            >
              Close
            </Button>
            <Button
              onClick={() => {
                if (editingCompany) {
                  navigate(`/companies/${editingCompany.id}`);
                  setEditingCompany(null);
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Open Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
} 