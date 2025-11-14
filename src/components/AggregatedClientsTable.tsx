import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  Users, 
  DollarSign,
  Filter,
  X,
  Search,
  CheckCircle,
  PauseCircle,
  XCircle,
  AlertCircle,
  UserCheck,
  PoundSterling,
  Calendar,
  Mail,
  Phone,
  TrendingUp,
  Eye,
  BarChart3,
  Edit2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OwnerFilter } from '@/components/OwnerFilter';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { safeParseFinancial } from '@/lib/utils/financialValidation';
import { useUser } from '@/lib/hooks/useUser';
import { useAggregatedClients, AggregatedClient, ClientStatus } from '@/lib/hooks/useClients';
import { useOwners } from '@/lib/hooks/useOwners';
import { ClientStatusModal } from './ClientStatusModal';
import { EditDealRevenueModal } from './EditDealRevenueModal';
import { EditClientModal } from './EditClientModal';
import { navigateToCompanyProfile } from '@/lib/utils/companyNavigation';
import { format } from 'date-fns';
import logger from '@/lib/utils/logger';

interface AggregatedClientsTableProps {
  className?: string;
}

const AggregatedClientsTableComponent = ({ className }: AggregatedClientsTableProps) => {
  const { userData } = useUser();
  
  // State for selected owner (for hook filtering)
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | undefined>(userData?.id);
  
  const { aggregatedClients, isLoading, error, refreshAggregatedClients } = useAggregatedClients(selectedOwnerId);
  const { owners } = useOwners();
  
  // UI State
  const [showFilters, setShowFilters] = useState(false);
  const [editingClientStatus, setEditingClientStatus] = useState<{
    clientName: string;
    currentStatus: ClientStatus;
    dealId?: string;
  } | null>(null);
  const [viewingClient, setViewingClient] = useState<AggregatedClient | null>(null);
  const [editingDeal, setEditingDeal] = useState<{
    id: string;
    name: string;
    monthly_mrr?: number | null;
    one_off_revenue?: number | null;
    annual_value?: number | null;
  } | null>(null);
  const [selectingDealForClient, setSelectingDealForClient] = useState<AggregatedClient | null>(null);
  const [editingClient, setEditingClient] = useState<{
    id: string;
    name: string;
    currentStatus: ClientStatus;
    deals: Array<{
      id: string;
      name: string;
      monthly_mrr?: number | null;
      one_off_revenue?: number | null;
      annual_value?: number | null;
    }>;
  } | null>(null);
  
  // Filter state - owner filtering now handled by hook, keep other filters
  const [filters, setFilters] = useState({
    searchQuery: '',
    status: undefined as ClientStatus | undefined,
    minValue: undefined as number | undefined,
    maxValue: undefined as number | undefined,
    hasSubscriptions: undefined as boolean | undefined,
  });

  // Set default owner to current user when data loads
  useEffect(() => {
    if (userData?.id && selectedOwnerId === undefined) {
      setSelectedOwnerId(userData.id);
    }
  }, [userData?.id, selectedOwnerId]);
  
  // Removed sales rep filter useEffect since owner filtering is now handled by hook

  // Filter clients
  const filteredClients = useMemo(() => {
    return aggregatedClients.filter(client => {
      const matchesSearch = !filters.searchQuery || 
        client.client_name?.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
        client.sales_rep?.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
        client.contact_identifier?.toLowerCase().includes(filters.searchQuery.toLowerCase());
      
      const matchesStatus = !filters.status || client.status === filters.status;
      
      const matchesMinValue = !filters.minValue || client.total_lifetime_value >= filters.minValue;
      const matchesMaxValue = !filters.maxValue || client.total_lifetime_value <= filters.maxValue;
      
      const matchesSubscriptions = filters.hasSubscriptions === undefined || 
        (filters.hasSubscriptions ? client.active_subscriptions > 0 : client.active_subscriptions === 0);
      
      return matchesSearch && matchesStatus && matchesMinValue && matchesMaxValue && matchesSubscriptions;
    });
  }, [aggregatedClients, filters]);

  // Memoized client status styling and icons to prevent recreation on every render
  const getClientStatusColor = useCallback((status: ClientStatus) => {
    switch (status) {
      case 'active':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'subscribed':
        return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'signed':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'deposit_paid':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'paused':
        return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      case 'notice_given':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'churned':
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  }, []);

  const getClientStatusIcon = useCallback((status: ClientStatus) => {
    switch (status) {
      case 'active':
        return CheckCircle;
      case 'subscribed':
        return CheckCircle;
      case 'signed':
        return UserCheck;
      case 'deposit_paid':
        return DollarSign;
      case 'paused':
        return PauseCircle;
      case 'notice_given':
        return AlertCircle;
      case 'churned':
        return XCircle;
      default:
        return AlertCircle;
    }
  }, []);

  const getClientStatusLabel = useCallback((status: ClientStatus) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'subscribed':
        return 'Subscribed';
      case 'signed':
        return 'Signed';
      case 'deposit_paid':
        return 'Deposit Paid';
      case 'paused':
        return 'Paused';
      case 'notice_given':
        return 'Notice Given';
      case 'churned':
        return 'Churned';
      default:
        return status || 'Unknown';
    }
  }, []);

  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat('en-GB', { 
      style: 'currency', 
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      searchQuery: '',
      status: undefined,
      minValue: undefined,
      maxValue: undefined,
      hasSubscriptions: undefined,
    });
    
    // Reset owner to current user
    setSelectedOwnerId(userData?.id);
  }, [userData?.id]);

  const handleEditClientStatus = useCallback((client: AggregatedClient) => {
    setEditingClientStatus({
      clientName: client.client_name,
      currentStatus: client.status,
      dealId: client.deals[0]?.id // Use first deal ID if available
    });
  }, []);

  const handleEditClientComprehensive = useCallback((client: AggregatedClient) => {
    if (client.deals && client.deals.length > 0) {
      setEditingClient({
        id: client.id,
        name: client.client_name,
        currentStatus: client.status,
        deals: client.deals.map(deal => ({
          id: deal.id,
          name: deal.name,
          monthly_mrr: deal.monthly_mrr,
          one_off_revenue: deal.one_off_revenue,
          annual_value: deal.annual_value,
        }))
      });
    } else {
      toast.error('No deals found for this client');
    }
  }, []);

  const handleSelectDealForEditing = useCallback((deal: any) => {
    setEditingDeal({
      id: deal.id,
      name: deal.name,
      monthly_mrr: deal.monthly_mrr,
      one_off_revenue: deal.one_off_revenue,
      annual_value: deal.annual_value,
    });
    setSelectingDealForClient(null);
  }, []);

  const handleSaveClientStatus = async (newStatus: ClientStatus, additionalData?: {
    noticeDate?: string;
    finalBillingDate?: string;
    churnReason?: string;
  }) => {
    if (!editingClientStatus) return;
    
    try {
      // Here you would call the updateClient function
      // For now, we'll just show a success message and refresh
      toast.success('Client status updated successfully');
      await refreshAggregatedClients();
      setEditingClientStatus(null);
    } catch (error: any) {
      logger.error('Error updating client status:', error);
      toast.error('Failed to update client status');
    }
  };

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const totalClients = filteredClients.length;
    const totalValue = filteredClients.reduce((sum, client) => sum + client.total_lifetime_value, 0);
    const totalMRR = filteredClients.reduce((sum, client) => sum + client.total_monthly_mrr, 0);
    // Active clients includes both 'active' (one-off) and 'subscribed' (recurring) statuses
    const activeClients = filteredClients.filter(c => c.status === 'active' || c.status === 'subscribed').length;
    const subscriptionClients = filteredClients.filter(c => c.active_subscriptions > 0).length;
    const churnedClients = filteredClients.filter(c => c.status === 'churned').length;
    const totalChurnAmount = filteredClients.reduce((sum, client) => sum + (client.total_churn_amount || 0), 0);
    const remainingRevenue = filteredClients.reduce((sum, client) => sum + (client.remaining_revenue_estimate || 0), 0);
    
    return {
      totalClients,
      totalValue,
      totalMRR,
      activeClients,
      subscriptionClients,
      churnedClients,
      totalChurnAmount,
      remainingRevenue,
    };
  }, [filteredClients]);

  if (isLoading) {
    return (
      <div className={cn("bg-white dark:bg-gray-900/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200 dark:border-gray-700/50", className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("bg-white dark:bg-gray-900/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200 dark:border-gray-700/50", className)}>
        <div className="text-center py-8">
          <div className="text-red-600 dark:text-red-400 mb-2">Error loading clients</div>
          <div className="text-gray-600 dark:text-gray-400">{error}</div>
          <Button
            onClick={refreshAggregatedClients}
            className="mt-4"
            variant="outline"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
        <div className="bg-white dark:bg-gray-900/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{summaryStats.totalClients}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Clients</div>
        </div>
        <div className="bg-white dark:bg-gray-900/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(summaryStats.totalValue)}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Value</div>
        </div>
        <div className="bg-white dark:bg-gray-900/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(summaryStats.totalMRR)}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Monthly MRR</div>
        </div>
        <div className="bg-white dark:bg-gray-900/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summaryStats.activeClients}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Active</div>
        </div>
        <div className="bg-white dark:bg-gray-900/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{summaryStats.subscriptionClients}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Subscriptions</div>
        </div>
        <div className="bg-white dark:bg-gray-900/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{summaryStats.churnedClients}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Churned</div>
        </div>
        <div className="bg-white dark:bg-gray-900/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(summaryStats.totalChurnAmount)}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Churn Value</div>
        </div>
      </div>

      {/* Header and Filters */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Client Overview</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Aggregated view of all clients with totals and status
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="bg-white dark:bg-gray-800/50 border-gray-300 dark:border-gray-700/50 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {(filters.status || filters.searchQuery || filters.minValue || filters.maxValue || filters.hasSubscriptions !== undefined || selectedOwnerId !== userData?.id) && (
              <span className="ml-2 bg-emerald-500 text-white text-xs rounded-full px-2 py-0.5">
                Active
              </span>
            )}
          </Button>
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
              <div className="bg-white dark:bg-gray-900/50 backdrop-blur-sm dark:backdrop-blur-xl rounded-xl p-6 border border-gray-200 dark:border-gray-800/50 space-y-4 shadow-sm dark:shadow-none">
                {/* Search */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search client name, sales rep, or contact..."
                      value={filters.searchQuery}
                      onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                      className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg pl-10 pr-4 py-2 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Filter Grid */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {/* Status Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                    <select
                      value={filters.status || 'all'}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        status: e.target.value === 'all' ? undefined : e.target.value as ClientStatus
                      }))}
                      className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="signed">Signed</option>
                      <option value="deposit_paid">Deposit Paid</option>
                      <option value="paused">Paused</option>
                      <option value="notice_given">Notice Given</option>
                      <option value="churned">Churned</option>
                    </select>
                  </div>

                  {/* Subscription Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Subscriptions</label>
                    <select
                      value={filters.hasSubscriptions === undefined ? 'all' : filters.hasSubscriptions ? 'yes' : 'no'}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        hasSubscriptions: e.target.value === 'all' ? undefined : e.target.value === 'yes'
                      }))}
                      className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="all">All Clients</option>
                      <option value="yes">Has Subscriptions</option>
                      <option value="no">No Subscriptions</option>
                    </select>
                  </div>

                  {/* Sales Rep Filter - using OwnerFilter component */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Sales Rep</label>
                    <OwnerFilter
                      selectedOwnerId={selectedOwnerId}
                      onOwnerChange={setSelectedOwnerId}
                      className="w-full"
                    />
                  </div>

                  {/* Value Range */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Min Value (£)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={filters.minValue || ''}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        minValue: e.target.value ? safeParseFinancial(e.target.value, 0, { fieldName: 'filter_min_value', allowZero: true }) : undefined
                      }))}
                      className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg px-3 py-2 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Max Value (£)</label>
                    <input
                      type="number"
                      placeholder="100000"
                      value={filters.maxValue || ''}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        maxValue: e.target.value ? safeParseFinancial(e.target.value, 0, { fieldName: 'filter_max_value', allowZero: true }) : undefined
                      }))}
                      className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg px-3 py-2 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Clear Filters */}
                {(filters.status || filters.searchQuery || filters.minValue || filters.maxValue || filters.hasSubscriptions !== undefined || selectedOwnerId !== userData?.id) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Clear All Filters
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900/50 backdrop-blur-sm dark:backdrop-blur-xl rounded-xl border border-gray-200 dark:border-gray-800/50 overflow-hidden shadow-sm dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800/50 bg-gray-50 dark:bg-transparent">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Client</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Deals Count</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Deal Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">One-off Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Monthly MRR</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Subscriptions</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Last Payment</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Sales Rep</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client, index) => {
                const ClientStatusIcon = getClientStatusIcon(client.status);
                return (
                  <motion.tr
                    key={client.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      duration: 0.2,
                      delay: index * 0.02
                    }}
                    className="border-b border-gray-200 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20"
                  >
                    {/* Client */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800/50 flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                            {client.client_name}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigateToCompanyProfile(client.client_name);
                              }}
                              className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                              title="View company profile"
                            >
                              <Building2 className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {client.contact_identifier && (
                              <span>{client.contact_identifier}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                        getClientStatusColor(client.status)
                      )}>
                        <ClientStatusIcon className="w-3 h-3" />
                        {getClientStatusLabel(client.status)}
                      </div>
                    </td>

                    {/* Deals Count */}
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {client.total_payments_count}
                      </div>
                    </td>

                    {/* Lifetime Value */}
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatCurrency(client.total_lifetime_value)}
                      </div>
                    </td>

                    {/* One-off Total */}
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {formatCurrency(client.total_one_off)}
                      </div>
                    </td>

                    {/* Monthly MRR */}
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(client.total_monthly_mrr)}
                        {client.total_monthly_mrr > 0 && <span className="text-xs text-gray-600 dark:text-gray-400">/mo</span>}
                      </div>
                    </td>

                    {/* Active Subscriptions */}
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-purple-600 dark:text-purple-400">
                        {client.active_subscriptions}
                      </div>
                    </td>

                    {/* Last Payment Date */}
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {client.last_payment_date ? format(new Date(client.last_payment_date), 'MMM d, yyyy') : 'N/A'}
                      </div>
                    </td>

                    {/* Sales Rep */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-500">
                            {client.sales_rep?.split(' ').map(n => n[0]).join('') || '??'}
                          </span>
                        </div>
                        <span className="text-sm text-gray-900 dark:text-white">{client.sales_rep}</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {/* View Details */}
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setViewingClient(client)}
                          className="p-2 hover:bg-blue-500/20 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-500"
                          title="View client details and payment history"
                        >
                          <Eye className="w-4 h-4" />
                        </motion.button>

                        {/* Edit Client */}
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleEditClientComprehensive(client)}
                          className="p-2 hover:bg-[#37bd7e]/20 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:text-[#37bd7e]"
                          title="Edit client revenue, status, and details"
                        >
                          <Edit2 className="w-4 h-4" />
                        </motion.button>

                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
          
          {filteredClients.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-600 dark:text-gray-400">
                {aggregatedClients.length === 0 ? 'No clients found.' : 'No clients match your filters.'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Client Status Management Modal */}
      <ClientStatusModal
        isOpen={!!editingClientStatus}
        onClose={() => setEditingClientStatus(null)}
        clientName={editingClientStatus?.clientName || ''}
        currentStatus={editingClientStatus?.currentStatus || 'active'}
        onSave={handleSaveClientStatus}
      />

      {/* Client Details Modal */}
      <Dialog open={!!viewingClient} onOpenChange={() => setViewingClient(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">
              {viewingClient?.client_name} - Payment History
            </DialogTitle>
          </DialogHeader>

          {viewingClient && (
            <div className="space-y-6">
              {/* Client Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">{viewingClient.total_payments_count}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Deals</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(viewingClient.total_lifetime_value)}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Deal Value</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(viewingClient.total_monthly_mrr)}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Monthly MRR</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                  <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{viewingClient.active_subscriptions}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Subscriptions</div>
                </div>
              </div>

              {/* Deals History */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Deal History</h3>
                <div className="space-y-3">
                  {viewingClient.deals.map((deal) => (
                    <div key={deal.id} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700/50">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{deal.name}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {deal.deal_type === 'subscription' ? 'Subscription' : 'One-off'} •
                            Signed: {format(new Date(deal.signed_date), 'MMM d, yyyy')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-gray-900 dark:text-white">{formatCurrency(deal.value)}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Total Value</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/50">
                        <div>
                          <div className="text-sm text-blue-600 dark:text-blue-400">{formatCurrency(deal.one_off_revenue || 0)}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">One-off</div>
                        </div>
                        <div>
                          <div className="text-sm text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(deal.monthly_mrr || 0)}
                            {(deal.monthly_mrr || 0) > 0 && <span className="text-xs">/mo</span>}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">Monthly MRR</div>
                        </div>
                        <div>
                          <div className="text-sm text-purple-600 dark:text-purple-400">{formatCurrency(deal.annual_value || 0)}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">Annual Value</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Deal Revenue Modal */}
      <EditDealRevenueModal
        isOpen={!!editingDeal}
        onClose={() => setEditingDeal(null)}
        dealId={editingDeal?.id || null}
        dealName={editingDeal?.name || ''}
        currentMRR={editingDeal?.monthly_mrr}
        currentOneOff={editingDeal?.one_off_revenue}
        currentAnnualValue={editingDeal?.annual_value}
        onSave={async () => {
          // Refresh aggregated clients data when a deal is updated
          await refreshAggregatedClients();
          setEditingDeal(null);
          toast.success('Deal revenue updated successfully');
        }}
      />

      {/* Edit Client Modal (Unified Revenue & Status) */}
      <EditClientModal
        isOpen={!!editingClient}
        onClose={() => setEditingClient(null)}
        clientData={editingClient}
        onSave={async () => {
          // Refresh aggregated clients data when client is updated
          await refreshAggregatedClients();
          setEditingClient(null);
          toast.success('Client updated successfully');
        }}
      />

      {/* Deal Selection Modal for Multi-Deal Clients */}
      <Dialog open={!!selectingDealForClient} onOpenChange={() => setSelectingDealForClient(null)}>
        <DialogContent className="max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">
              Select Deal to Edit - {selectingDealForClient?.client_name}
            </DialogTitle>
          </DialogHeader>
          
          {selectingDealForClient && (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              <p className="text-sm text-gray-400">
                This client has multiple deals. Select which deal you'd like to edit:
              </p>
              
              <div className="space-y-3">
                {selectingDealForClient.deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors"
                    onClick={() => handleSelectDealForEditing(deal)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{deal.name}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {deal.deal_type === 'subscription' ? 'Subscription' : 'One-off'} • 
                          Signed: {format(new Date(deal.signed_date), 'MMM d, yyyy')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-gray-900 dark:text-white">{formatCurrency(deal.value)}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Total Value</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/50">
                      <div>
                        <div className="text-sm text-blue-400">{formatCurrency(deal.one_off_revenue || 0)}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">One-off</div>
                      </div>
                      <div>
                        <div className="text-sm text-emerald-400">
                          {formatCurrency(deal.monthly_mrr || 0)}
                          {(deal.monthly_mrr || 0) > 0 && <span className="text-xs">/mo</span>}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Monthly MRR</div>
                      </div>
                      <div>
                        <div className="text-sm text-purple-400">{formatCurrency(deal.annual_value || 0)}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Annual Value</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Export memoized component for performance optimization
export const AggregatedClientsTable = React.memo(AggregatedClientsTableComponent);
export default AggregatedClientsTable;