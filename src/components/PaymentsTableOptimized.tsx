import React, { useState, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Edit2, 
  Trash2, 
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
  PoundSterling
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useActivities } from '@/lib/hooks/useActivities';
import { useUser } from '@/lib/hooks/useUser';
import { useUsers } from '@/lib/hooks/useUsers';
import { useDeals } from '@/lib/hooks/useDeals';
import { useClients, ClientStatus, useMRR } from '@/lib/hooks/useClients';
import { EditDealRevenueModal } from './EditDealRevenueModal';
import { DealDetailsModal } from './DealDetailsModal';
import { ClientStatusModal } from './ClientStatusModal';
import { format } from 'date-fns';
import { 
  safeParseFinancial, 
  calculateLifetimeValue, 
  FinancialLogger 
} from '@/lib/utils/financialValidation';
import { navigateToCompanyProfile } from '@/lib/utils/companyNavigation';

// Virtual scrolling imports
import { FixedSizeList as List } from 'react-window';
import { areEqual } from 'react-window';
import logger from '@/lib/utils/logger';

interface PaymentsTableProps {
  className?: string;
}

interface PaymentRecord {
  id: string;
  client_name: string;
  deal_value: number;
  deal_type: 'one-off' | 'subscription';
  signed_date: string;
  sales_rep: string;
  contact_identifier?: string;
  details?: string;
  deal_id?: string;
  deal_name?: string;
}

// Extended payment record for detailed financial tracking
interface ExtendedPaymentRecord extends PaymentRecord {
  client_id?: string;
  lifetime_deal_value?: number;
  monthly_mrr?: number;
  one_off_revenue?: number;
  annual_value?: number;
  status?: string;
}

// Optimized filter state
interface FilterState {
  searchQuery: string;
  dealType?: 'one-off' | 'subscription';
  minValue?: number;
  maxValue?: number;
  salesRep?: string;
  status?: 'active' | 'signed' | 'deposit_paid' | 'paused' | 'notice_given' | 'churned';
  dateFrom?: string;
  dateTo?: string;
  owner?: string;
}

// Memoized row component for virtual scrolling
const PaymentRow = memo(({ index, style, data }: { 
  index: number; 
  style: React.CSSProperties; 
  data: {
    payments: ExtendedPaymentRecord[];
    onEditDealRevenue: (payment: ExtendedPaymentRecord) => void;
    onEditClientStatus: (payment: ExtendedPaymentRecord) => void;
    onViewDeal: (dealId: string) => void;
  };
}) => {
  const { payments, onEditDealRevenue, onEditClientStatus, onViewDeal } = data;
  const payment = payments[index];

  if (!payment) return null;

  const getDealTypeColor = (dealType: string) => {
    switch (dealType) {
      case 'subscription':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'one-off':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  const getDealTypeIcon = (dealType: string) => {
    switch (dealType) {
      case 'subscription':
        return CheckCircle;
      case 'one-off':
        return DollarSign;
      default:
        return AlertCircle;
    }
  };

  const getClientStatusColor = (status: string) => {
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
  };

  const getClientStatusIcon = (status: string) => {
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
  };

  const getClientStatusLabel = (status: string) => {
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
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', { 
      style: 'currency', 
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const DealTypeIcon = getDealTypeIcon(payment.deal_type);
  const ClientStatusIcon = getClientStatusIcon(payment.status || 'active');

  return (
    <motion.div
      style={style}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.2,
        delay: index * 0.01
      }}
      className="flex items-center border-b border-gray-800/50 hover:bg-gray-800/20 px-4 py-3"
    >
      {/* Client */}
      <div className="flex items-center gap-3 min-w-[250px] flex-1">
        <div className="w-8 h-8 rounded-lg bg-gray-800/50 flex items-center justify-center">
          <Building2 className="w-4 h-4 text-gray-400" />
        </div>
        <div>
          <div className="text-sm font-medium text-white flex items-center gap-2">
            {payment.client_name}
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigateToCompanyProfile(payment.client_name);
              }}
              className="text-blue-400 hover:text-blue-300 transition-colors"
              title="View company profile"
            >
              <Building2 className="w-3 h-3" />
            </button>
          </div>
          <div className="text-xs text-gray-400">
            {payment.deal_name && (
              <span className="text-blue-400">🔗 {payment.deal_name}</span>
            )}
            {payment.deal_name && payment.contact_identifier && <span className="mx-1">•</span>}
            {payment.contact_identifier && (
              <span>{payment.contact_identifier}</span>
            )}
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="min-w-[120px]">
        <div className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
          getClientStatusColor(payment.status || 'active')
        )}>
          <ClientStatusIcon className="w-3 h-3" />
          {getClientStatusLabel(payment.status || 'active')}
        </div>
      </div>

      {/* Deal Value */}
      <div className="text-sm font-medium text-white min-w-[100px]">
        {formatCurrency(payment.lifetime_deal_value || 0)}
      </div>

      {/* One-off Revenue */}
      <div className="text-sm font-medium text-blue-400 min-w-[100px]">
        {formatCurrency(payment.one_off_revenue || 0)}
      </div>

      {/* Subscription (Monthly MRR) */}
      <div className="text-sm font-medium text-emerald-400 min-w-[120px]">
        {formatCurrency(payment.monthly_mrr || 0)}
        {payment.monthly_mrr && payment.monthly_mrr > 0 && <span className="text-xs text-gray-400">/mo</span>}
      </div>

      {/* Type */}
      <div className="min-w-[120px]">
        <div className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
          getDealTypeColor(payment.deal_type)
        )}>
          <DealTypeIcon className="w-3 h-3" />
          {payment.deal_type}
        </div>
      </div>

      {/* Sales Rep */}
      <div className="flex items-center gap-2 min-w-[150px]">
        <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <span className="text-xs font-medium text-emerald-500">
            {payment.sales_rep?.split(' ').map(n => n[0]).join('') || '??'}
          </span>
        </div>
        <span className="text-sm text-white">{payment.sales_rep}</span>
      </div>

      {/* Signed Date */}
      <div className="text-sm text-white min-w-[100px]">
        {format(new Date(payment.signed_date), 'MMM d, yyyy')}
      </div>

      {/* Deal */}
      <div className="text-sm text-white min-w-[120px]">
        {payment.deal_id ? (
          <button
            onClick={() => {
              logger.log('🔍 Opening deal details for ID:', payment.deal_id);
              onViewDeal(payment.deal_id!);
            }}
            className="text-left hover:bg-gray-700/50 rounded-lg p-2 -m-2 transition-colors group"
          >
            <div className="text-emerald-400 font-medium group-hover:text-emerald-300">
              Linked 🔗
            </div>
            <div className="text-xs text-gray-400 group-hover:text-gray-300">
              ID: {payment.deal_id.slice(-6)} • Click to view
            </div>
          </button>
        ) : (
          <span className="text-gray-400">No deal linked</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 min-w-[100px]">
        {/* Edit Deal Revenue */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onEditDealRevenue(payment)}
          disabled={!payment.deal_id}
          className={`p-2 rounded-lg transition-colors ${
            payment.deal_id 
              ? 'hover:bg-emerald-500/20 text-gray-400 hover:text-emerald-500' 
              : 'text-gray-600 cursor-not-allowed'
          }`}
          title={payment.deal_id ? 'Edit deal revenue splits' : 'No deal linked'}
        >
          <PoundSterling className="w-4 h-4" />
        </motion.button>
        
        {/* Edit Client Status */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onEditClientStatus(payment)}
          className="p-2 hover:bg-blue-500/20 rounded-lg transition-colors text-gray-400 hover:text-blue-500"
          title="Manage client status"
        >
          <Users className="w-4 h-4" />
        </motion.button>
      </div>
    </motion.div>
  );
}, areEqual);

PaymentRow.displayName = 'PaymentRow';

// Optimized PaymentsTable with performance enhancements
export const PaymentsTableOptimized = memo(({ className }: PaymentsTableProps) => {
  const { userData } = useUser();
  const { users } = useUsers();
  const { activities } = useActivities();
  const { deals, updateDeal, refreshDeals } = useDeals(userData?.id);
  const { clients, updateClient, createClient, isLoading } = useClients(userData?.id);
  const { fetchMRRSummary } = useMRR(userData?.id);
  
  // UI State
  const [showFilters, setShowFilters] = useState(false);
  const [editingDeal, setEditingDeal] = useState<{
    id: string;
    name: string;
    monthly_mrr?: number | null;
    one_off_revenue?: number | null;
    annual_value?: number | null;
  } | null>(null);
  const [editingClientStatus, setEditingClientStatus] = useState<{
    clientName: string;
    currentStatus: ClientStatus;
    dealId?: string;
    noticeDate?: string;
    finalBillingDate?: string;
    churnReason?: string;
  } | null>(null);
  const [viewingDealId, setViewingDealId] = useState<string | null>(null);
  
  // Optimized filter state
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
  });

  // Helper function to resolve user ID to readable name
  const resolveUserName = useCallback((userId: string): string => {
    if (!userId || userId === 'Unknown') {
      return 'Unknown';
    }
    
    // Try to find user in users list
    const user = users.find(u => u.id === userId);
    if (user) {
      const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
      return fullName || user.email || `User ${userId.slice(0, 8)}`;
    }
    
    // If it's already a readable string (not a UUID), return it
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    if (!isUuid) {
      return userId;
    }
    
    // Last resort for UUIDs
    return `User ${userId.slice(0, 8)}`;
  }, [users]);

  // OPTIMIZED: Extract payment records with simplified logic and error handling
  const paymentRecords = useMemo((): ExtendedPaymentRecord[] => {
    // Don't render until data is loaded
    if (isLoading || !clients || !activities) {
      return [];
    }
    
    try {
      // Step 1: Process client payment records
      const clientPaymentRecords = clients.map(paymentRecord => {
        // Find corresponding deal if it exists
        const correspondingDeal = paymentRecord.deal_id ? deals?.find(deal => deal.id === paymentRecord.deal_id) : null;
        
        // Determine payment type
        const paymentType: 'one-off' | 'subscription' = 
          (paymentRecord.subscription_amount && paymentRecord.subscription_amount > 0) ? 'subscription' : 'one-off';

        // SECURITY: Calculate revenue values with validation
        const oneOffRevenue = safeParseFinancial(
          correspondingDeal?.one_off_revenue || 0, 
          0, 
          { fieldName: 'one_off_revenue', allowZero: true }
        );
        const monthlyMRR = safeParseFinancial(
          correspondingDeal?.monthly_mrr || paymentRecord.subscription_amount || 0, 
          0, 
          { fieldName: 'monthly_mrr', allowZero: true }
        );
        const annualValue = safeParseFinancial(
          correspondingDeal?.annual_value || 0, 
          0, 
          { fieldName: 'annual_value', allowZero: true }
        );
        
        // Calculate lifetime value
        const lifetimeCalculation = calculateLifetimeValue(monthlyMRR, oneOffRevenue);
        
        // Enhanced date and sales rep resolution
        let rawSalesRep = 'Unknown';
        let actualSignedDate = new Date().toISOString();
        
        // Find corresponding activity
        const correspondingActivity = activities.find(activity => 
          (paymentRecord.deal_id && activity.deal_id === paymentRecord.deal_id) ||
          (activity.client_name?.toLowerCase() === paymentRecord.company_name?.toLowerCase() && 
           activity.type === 'sale' && 
           activity.status === 'completed')
        );
        
        if (correspondingActivity?.sales_rep) {
          rawSalesRep = correspondingActivity.sales_rep;
          actualSignedDate = correspondingActivity.date;
        } else {
          if (correspondingDeal?.created_at) {
            actualSignedDate = correspondingDeal.created_at;
          } else if (paymentRecord.subscription_start_date) {
            actualSignedDate = paymentRecord.subscription_start_date;
          } else if (paymentRecord.created_at) {
            actualSignedDate = paymentRecord.created_at;
          }
          
          if (correspondingDeal?.assigned_to) {
            rawSalesRep = correspondingDeal.assigned_to;
          } else if (correspondingDeal?.owner_id) {
            rawSalesRep = correspondingDeal.owner_id;
          } else if (paymentRecord.contact_name) {
            rawSalesRep = paymentRecord.contact_name;
          } else if (paymentRecord.owner_id) {
            rawSalesRep = paymentRecord.owner_id;
          }
        }
        
        const salesRep = resolveUserName(rawSalesRep);

        return {
          id: paymentRecord.id,
          client_id: paymentRecord.id,
          client_name: paymentRecord.company_name,
          deal_name: correspondingDeal?.name || 'No Deal Link',
          deal_value: lifetimeCalculation.value,
          deal_type: paymentType,
          signed_date: actualSignedDate,
          sales_rep: salesRep,
          contact_identifier: paymentRecord.contact_email || paymentRecord.contact_name,
          details: `Payment: ${paymentRecord.company_name} | Type: ${paymentType} | Status: ${paymentRecord.status}`,
          deal_id: paymentRecord.deal_id,
          status: paymentRecord.status || 'signed',
          lifetime_deal_value: lifetimeCalculation.value,
          one_off_revenue: oneOffRevenue,
          monthly_mrr: monthlyMRR,
          annual_value: annualValue
        };
      });

      // Step 2: Process standalone activities that aren't in clients table
      const standaloneActivityRecords = activities
        .filter(activity => 
          activity.type === 'sale' && 
          activity.status === 'completed' &&
          activity.client_name &&
          activity.client_name.trim() !== ''
        )
        .filter(activity => {
          const hasPaymentRecord = clients.some(client => 
            (activity.deal_id && client.deal_id === activity.deal_id) ||
            (client.company_name?.toLowerCase() === activity.client_name?.toLowerCase())
          );
          return !hasPaymentRecord;
        })
        .map(activity => {
          const correspondingDeal = activity.deal_id ? deals?.find(deal => deal.id === activity.deal_id) : null;
          
          const paymentType: 'one-off' | 'subscription' = 
            (activity.details?.toLowerCase().includes('subscription') || 
             activity.details?.toLowerCase().includes('recurring') ||
             activity.details?.toLowerCase().includes('monthly')) ? 'subscription' : 'one-off';

          const oneOffRevenue = safeParseFinancial(
            correspondingDeal?.one_off_revenue || (paymentType === 'one-off' ? activity.amount || 0 : 0),
            0,
            { fieldName: 'standalone_one_off_revenue', allowZero: true }
          );
          const monthlyMRR = safeParseFinancial(
            correspondingDeal?.monthly_mrr || (paymentType === 'subscription' ? activity.amount || 0 : 0),
            0,
            { fieldName: 'standalone_monthly_mrr', allowZero: true }
          );
          const annualValue = safeParseFinancial(
            correspondingDeal?.annual_value || 0,
            0,
            { fieldName: 'standalone_annual_value', allowZero: true }
          );
          
          const lifetimeCalculation = calculateLifetimeValue(monthlyMRR, oneOffRevenue);
          
          let rawActivitySalesRep = activity.sales_rep || correspondingDeal?.assigned_to || correspondingDeal?.owner_id || 'Unknown';
          const activitySalesRep = resolveUserName(rawActivitySalesRep);

          return {
            id: `activity-${activity.id}`,
            client_id: activity.id,
            client_name: activity.client_name,
            deal_name: correspondingDeal?.name || 'Standalone Activity',
            deal_value: lifetimeCalculation.value,
            deal_type: paymentType,
            signed_date: activity.date,
            sales_rep: activitySalesRep,
            contact_identifier: activity.contact_name || activity.client_name,
            details: `Activity: ${activity.details || 'Sale'} | Type: ${paymentType} | Amount: £${activity.amount || 0}`,
            deal_id: activity.deal_id,
            status: 'signed',
            lifetime_deal_value: lifetimeCalculation.value,
            one_off_revenue: oneOffRevenue,
            monthly_mrr: monthlyMRR,
            annual_value: annualValue
          };
        });

      // Step 3: Combine and sort
      return [...clientPaymentRecords, ...standaloneActivityRecords]
        .sort((a, b) => new Date(b.signed_date).getTime() - new Date(a.signed_date).getTime());

    } catch (error) {
      logger.error('Error processing payment records:', error);
      FinancialLogger.log('high', 'Payment records processing failed', { error: error.message });
      return [];
    }
  }, [clients, deals, activities, isLoading, resolveUserName]);

  // OPTIMIZED: Filter payment records with efficient filtering
  const filteredPayments = useMemo(() => {
    if (!paymentRecords.length) return [];
    
    return paymentRecords.filter(payment => {
      if (filters.searchQuery) {
        const searchLower = filters.searchQuery.toLowerCase();
        const matchesSearch = 
          payment.client_name?.toLowerCase().includes(searchLower) ||
          payment.sales_rep?.toLowerCase().includes(searchLower) ||
          payment.deal_name?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }
      
      if (filters.dealType && payment.deal_type !== filters.dealType) return false;
      if (filters.minValue && payment.deal_value < filters.minValue) return false;
      if (filters.maxValue && payment.deal_value > filters.maxValue) return false;
      if (filters.salesRep && payment.sales_rep !== filters.salesRep) return false;
      if (filters.status && payment.status !== filters.status) return false;
      
      if (filters.dateFrom && new Date(payment.signed_date) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && new Date(payment.signed_date) > new Date(filters.dateTo)) return false;
      
      if (filters.owner && !payment.sales_rep?.toLowerCase().includes(filters.owner.toLowerCase())) return false;
      
      return true;
    });
  }, [paymentRecords, filters]);

  // OPTIMIZED: Calculate summary stats efficiently
  const summaryStats = useMemo(() => {
    const totalPayments = filteredPayments.length;
    
    let totalValue = 0;
    let subscriptionPayments = 0;
    let oneOffPayments = 0;
    let totalMRR = 0;

    // Single-pass calculation
    for (const payment of filteredPayments) {
      totalValue += safeParseFinancial(payment.lifetime_deal_value || 0, 0, { fieldName: 'summary_lifetime_value', allowZero: true });
      
      if (payment.deal_type === 'subscription') {
        subscriptionPayments++;
        totalMRR += safeParseFinancial(payment.monthly_mrr || 0, 0, { fieldName: 'summary_mrr', allowZero: true });
      } else {
        oneOffPayments++;
      }
    }
    
    return {
      totalClients: totalPayments,
      totalValue,
      subscriptionClients: subscriptionPayments,
      oneOffClients: oneOffPayments,
      totalMRR,
    };
  }, [filteredPayments]);

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
    });
  }, []);

  // Handle editing deal revenue
  const handleEditDealRevenue = useCallback((payment: ExtendedPaymentRecord) => {
    if (!payment.deal_id || !payment.deal_name) {
      toast.error('No deal linked to this payment');
      return;
    }
    
    setEditingDeal({
      id: payment.deal_id,
      name: payment.deal_name,
      monthly_mrr: payment.monthly_mrr,
      one_off_revenue: payment.one_off_revenue,
      annual_value: payment.annual_value
    });
  }, []);

  const handleEditClientStatus = useCallback((payment: ExtendedPaymentRecord) => {
    const existingClient = clients.find(c => 
      c.company_name?.toLowerCase() === payment.client_name?.toLowerCase() ||
      c.deal_id === payment.deal_id
    );
    
    setEditingClientStatus({
      clientName: payment.client_name,
      currentStatus: existingClient?.status || 'active',
      dealId: payment.deal_id
    });
  }, [clients]);

  const handleViewDeal = useCallback((dealId: string) => {
    setViewingDealId(dealId);
  }, []);

  const handleSaveClientStatus = async (newStatus: ClientStatus, additionalData?: {
    noticeDate?: string;
    finalBillingDate?: string;
    churnReason?: string;
  }) => {
    if (!editingClientStatus) return;
    
    const existingClient = clients.find(c => 
      c.company_name?.toLowerCase() === editingClientStatus.clientName?.toLowerCase() ||
      c.deal_id === editingClientStatus.dealId
    );
    
    try {
      const updateData: any = { status: newStatus };
      
      if (newStatus === 'notice_given') {
        updateData.notice_given_date = additionalData?.noticeDate || new Date().toISOString().split('T')[0];
        updateData.final_billing_date = additionalData?.finalBillingDate;
        updateData.churn_reason = additionalData?.churnReason;
      } else if (newStatus === 'churned') {
        updateData.churn_date = new Date().toISOString();
        updateData.notice_given_date = additionalData?.noticeDate;
        updateData.final_billing_date = additionalData?.finalBillingDate;
        updateData.churn_reason = additionalData?.churnReason;
      } else {
        updateData.churn_date = null;
        updateData.notice_given_date = null;
        updateData.final_billing_date = null;
        updateData.churn_reason = null;
      }
      
      if (existingClient) {
        const success = await updateClient(existingClient.id, updateData);
        if (success) {
          toast.success('Client status updated successfully');
        }
      } else {
        const success = await createClient({
          company_name: editingClientStatus.clientName,
          deal_id: editingClientStatus.dealId || null,
          owner_id: userData?.id || '',
          subscription_amount: 0,
          subscription_start_date: new Date().toISOString().split('T')[0],
          ...updateData
        });
        if (success) {
          toast.success('Client status created successfully');
        }
      }
      
      setEditingClientStatus(null);
    } catch (error: any) {
      logger.error('Error updating client status:', error);
      toast.error('Failed to update client status');
    }
  };

  if (isLoading) {
    return (
      <div className={cn("bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800/50", className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-700 rounded w-1/4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const rowData = {
    payments: filteredPayments,
    onEditDealRevenue: handleEditDealRevenue,
    onEditClientStatus: handleEditClientStatus,
    onViewDeal: handleViewDeal,
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-lg p-4 border border-gray-800/50">
          <div className="text-2xl font-bold text-white">{summaryStats.totalClients}</div>
          <div className="text-sm text-gray-400">Total Clients</div>
        </div>
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-lg p-4 border border-gray-800/50">
          <div className="text-2xl font-bold text-white">{formatCurrency(summaryStats.totalValue)}</div>
          <div className="text-sm text-gray-400">Total Value</div>
        </div>
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-lg p-4 border border-gray-800/50">
          <div className="text-2xl font-bold text-emerald-400">{summaryStats.subscriptionClients}</div>
          <div className="text-sm text-gray-400">Subscriptions</div>
        </div>
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-lg p-4 border border-gray-800/50">
          <div className="text-2xl font-bold text-blue-400">{summaryStats.oneOffClients}</div>
          <div className="text-sm text-gray-400">One-off</div>
        </div>
      </div>

      {/* Header and Filters */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Payment Tracking</h2>
            <p className="text-sm text-gray-400">
              Track both subscription payments and one-off invoices for all clients
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="bg-gray-800/50 border-gray-700/50 text-white hover:bg-gray-700/50"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {Object.values(filters).some(v => v !== '' && v !== undefined) && (
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
              <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800/50 space-y-4">
                {/* Search */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search company name, sales rep, or payment..."
                      value={filters.searchQuery}
                      onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                      className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Quick Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Deal Type</label>
                    <select
                      value={filters.dealType || 'all'}
                      onChange={(e) => setFilters(prev => ({ 
                        ...prev, 
                        dealType: e.target.value === 'all' ? undefined : e.target.value as any
                      }))}
                      className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="all">All Types</option>
                      <option value="subscription">Subscription</option>
                      <option value="one-off">One-off</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Sales Rep</label>
                    <select
                      value={filters.salesRep || 'all'}
                      onChange={(e) => setFilters(prev => ({ 
                        ...prev, 
                        salesRep: e.target.value === 'all' ? undefined : e.target.value 
                      }))}
                      className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="all">All Sales Reps</option>
                      {Array.from(new Set(paymentRecords.map(p => p.sales_rep).filter(Boolean))).sort().map((rep: string) => (
                        <option key={rep} value={rep}>{rep}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Min Value (£)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={filters.minValue || ''}
                      onChange={(e) => setFilters(prev => ({ 
                        ...prev, 
                        minValue: e.target.value ? parseFloat(e.target.value) : undefined 
                      }))}
                      className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Max Value (£)</label>
                    <input
                      type="number"
                      placeholder="100000"
                      value={filters.maxValue || ''}
                      onChange={(e) => setFilters(prev => ({ 
                        ...prev, 
                        maxValue: e.target.value ? parseFloat(e.target.value) : undefined 
                      }))}
                      className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Clear Filters */}
                {Object.values(filters).some(v => v !== '' && v !== undefined) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="text-gray-400 hover:text-white"
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

      {/* Virtualized Table */}
      <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800/50 overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center border-b border-gray-800/50 px-4 py-3 bg-gray-900/30">
          <div className="text-xs font-medium text-gray-400 min-w-[250px] flex-1">Client</div>
          <div className="text-xs font-medium text-gray-400 min-w-[120px]">Status</div>
          <div className="text-xs font-medium text-gray-400 min-w-[100px]">Deal Value</div>
          <div className="text-xs font-medium text-gray-400 min-w-[100px]">One-off</div>
          <div className="text-xs font-medium text-gray-400 min-w-[120px]">Subscription</div>
          <div className="text-xs font-medium text-gray-400 min-w-[120px]">Type</div>
          <div className="text-xs font-medium text-gray-400 min-w-[150px]">Sales Rep</div>
          <div className="text-xs font-medium text-gray-400 min-w-[100px]">Signed Date</div>
          <div className="text-xs font-medium text-gray-400 min-w-[120px]">Deal</div>
          <div className="text-xs font-medium text-gray-400 min-w-[100px]">Actions</div>
        </div>
        
        {/* Virtual Scrolling Table Body */}
        {filteredPayments.length > 0 ? (
          <List
            height={Math.min(600, filteredPayments.length * 80)} // Max height of 600px, 80px per row
            itemCount={filteredPayments.length}
            itemSize={80}
            itemData={rowData}
            width="100%"
          >
            {PaymentRow}
          </List>
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-400">
              {paymentRecords.length === 0 ? 'No payment records found.' : 'No payments match your filters.'}
            </div>
          </div>
        )}
      </div>

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
          logger.log('🔄 Deal revenue updated, refreshing data...');
          await refreshDeals();
          await fetchMRRSummary();
          logger.log('✅ Data refreshed after deal revenue update');
        }}
      />

      {/* Client Status Management Modal */}
      <ClientStatusModal
        isOpen={!!editingClientStatus}
        onClose={() => setEditingClientStatus(null)}
        clientName={editingClientStatus?.clientName || ''}
        currentStatus={editingClientStatus?.currentStatus || 'active'}
        onSave={handleSaveClientStatus}
      />

      {/* Deal Details Modal */}
      <DealDetailsModal
        isOpen={!!viewingDealId}
        onClose={() => setViewingDealId(null)}
        dealId={viewingDealId}
      />
    </div>
  );
});

PaymentsTableOptimized.displayName = 'PaymentsTableOptimized';

export { PaymentsTableOptimized as PaymentsTable };