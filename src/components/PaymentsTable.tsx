import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  Download,
  Calendar,
  Mail,
  Phone,
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
  validateFinancialObject,
  FinancialLogger 
} from '@/lib/utils/financialValidation';
import { navigateToCompanyProfile } from '@/lib/utils/companyNavigation';

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

export function PaymentsTable({ className }: PaymentsTableProps) {
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
  
  // ENHANCED: Filter state with additional comprehensive filters
  const [filters, setFilters] = useState({
    searchQuery: '',
    dealType: undefined as ('one-off' | 'subscription') | undefined,
    minValue: undefined as number | undefined,
    maxValue: undefined as number | undefined,
    salesRep: undefined as string | undefined,
    // NEW: Additional filters for comprehensive filtering
    status: undefined as ('active' | 'signed' | 'deposit_paid' | 'paused' | 'notice_given' | 'churned') | undefined,
    dateFrom: undefined as string | undefined,
    dateTo: undefined as string | undefined,
    owner: undefined as string | undefined,
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

  // Extract payment records by combining clients table records AND standalone sale activities
  const paymentRecords = useMemo((): ExtendedPaymentRecord[] => {
    console.log('💰 Processing payment records from clients table AND activities:', { 
      clientsCount: clients.length, 
      dealsCount: deals?.length || 0,
      activitiesCount: activities?.length || 0,
      isLoading 
    });
    
    // Don't render until data is loaded
    if (isLoading || !clients || !activities) {
      return [];
    }
    
    // Step 1: Get all payment records from clients table
    const clientPaymentRecords = clients.map(paymentRecord => {
        console.log('💳 Processing payment record:', { 
          company: paymentRecord.company_name, 
          deal_id: paymentRecord.deal_id,
          subscription_amount: paymentRecord.subscription_amount,
          status: paymentRecord.status
        });
        
        // Find corresponding deal if it exists
        const correspondingDeal = paymentRecord.deal_id ? deals?.find(deal => deal.id === paymentRecord.deal_id) : null;
        
        console.log('🔗 Found deal for payment record:', { 
          payment: paymentRecord.company_name,
          dealFound: !!correspondingDeal,
          dealName: correspondingDeal?.name 
        });
        
        // Determine payment type: Subscription if there's subscription amount, otherwise One-off invoice
        let paymentType: 'one-off' | 'subscription' = 'one-off';
        // If there's subscription amount, it's a recurring subscription payment
        if (paymentRecord.subscription_amount && paymentRecord.subscription_amount > 0) {
          paymentType = 'subscription';
        }
        // Otherwise it's a one-off invoice payment
        else {
          paymentType = 'one-off';
        }

        // SECURITY: Calculate separate revenue values with robust validation
        // Use validated financial parsing to prevent corruption and malicious data
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
        
        // SECURITY: Calculate lifetime value with validated inputs and business rule validation
        // Implements business rule: (3x monthly subscription) + (1x one-time payment)
        const lifetimeCalculation = calculateLifetimeValue(monthlyMRR, oneOffRevenue);
        const lifetimeDealValue = lifetimeCalculation.value;
        
        // Log any calculation errors for monitoring
        if (!lifetimeCalculation.isValid) {
          FinancialLogger.log('medium', 'Lifetime value calculation issues for payment record', {
            paymentRecord: paymentRecord.company_name,
            errors: lifetimeCalculation.errors,
            monthlyMRR,
            oneOffRevenue,
            dealId: correspondingDeal?.id
          });
        }

        // IMPROVED: Enhanced sales rep fallback logic with user lookup
        let rawSalesRep = 'Unknown';
        
        // IMPROVED: Enhanced date resolution with more accurate payment dates
        let actualSignedDate = new Date().toISOString(); // Default fallback
        
        // Priority order for payment dates:
        // 1. Activity date (most accurate for when sale happened)
        // 2. Deal created_at (when deal was first created)  
        // 3. Subscription start date (when subscription began)
        // 4. Payment record created_at (when record was created)
        // 5. Current date (fallback)
        
        // Priority order for sales rep identification:
        // 1. Activity sales_rep (most accurate)
        // 2. Deal assigned_to/owner (if available)
        // 3. Deal owner_id (resolve via user lookup)
        // 4. Payment record contact_name (fallback)
        // 5. Payment record owner_id (resolve via user lookup)
        
        // Find the activity that corresponds to this payment (by deal_id or company name)
        const correspondingActivity = activities.find(activity => 
          (paymentRecord.deal_id && activity.deal_id === paymentRecord.deal_id) ||
          (activity.client_name?.toLowerCase() === paymentRecord.company_name?.toLowerCase() && 
           activity.type === 'sale' && 
           activity.status === 'completed')
        );
        
        if (correspondingActivity?.sales_rep) {
          // Priority 1: Use activity sales rep (most reliable)
          rawSalesRep = correspondingActivity.sales_rep;
          actualSignedDate = correspondingActivity.date; // Use activity date (most accurate)
        } else {
          // Set date based on available data (priority order)
          if (correspondingDeal?.created_at) {
            actualSignedDate = correspondingDeal.created_at; // Use deal creation date
          } else if (paymentRecord.subscription_start_date) {
            actualSignedDate = paymentRecord.subscription_start_date; // Use subscription start
          } else if (paymentRecord.created_at) {
            actualSignedDate = paymentRecord.created_at; // Use payment record creation
          }
          
          // Set sales rep based on priority
          if (correspondingDeal?.assigned_to) {
            // Priority 2: Use deal assigned user
            rawSalesRep = correspondingDeal.assigned_to;
          } else if (correspondingDeal?.owner_id) {
            // Priority 3: Use deal owner ID and resolve to name
            rawSalesRep = correspondingDeal.owner_id;
          } else if (paymentRecord.contact_name) {
            // Priority 4: Use payment record contact
            rawSalesRep = paymentRecord.contact_name;
          } else if (paymentRecord.owner_id) {
            // Priority 5: Use payment record owner ID and resolve to name
            rawSalesRep = paymentRecord.owner_id;
          }
        }
        
        // Resolve the sales rep (convert UUID to readable name if needed)
        const salesRep = resolveUserName(rawSalesRep);
        
        console.log('🎯 Sales rep resolution for payment:', {
          payment: paymentRecord.company_name,
          raw_sales_rep: rawSalesRep,
          final_sales_rep: salesRep,
          signed_date: actualSignedDate,
          activity_found: !!correspondingActivity,
          deal_found: !!correspondingDeal,
          deal_id: paymentRecord.deal_id
        });

        const result: ExtendedPaymentRecord = {
          id: paymentRecord.id, // Use payment record ID
          client_id: paymentRecord.id, // Payment record ID
          client_name: paymentRecord.company_name, // Use payment record company name
          deal_name: correspondingDeal?.name || 'No Deal Link', // Add deal name if available
          deal_value: lifetimeDealValue, // Keep for backward compatibility
          deal_type: paymentType,
          signed_date: actualSignedDate,
          sales_rep: salesRep,
          contact_identifier: paymentRecord.contact_email || paymentRecord.contact_name,
          details: `Payment: ${paymentRecord.company_name} | Type: ${paymentType} | Status: ${paymentRecord.status}`,
          deal_id: paymentRecord.deal_id,
          status: paymentRecord.status || 'signed',
          // Separate revenue values
          lifetime_deal_value: lifetimeDealValue,
          one_off_revenue: oneOffRevenue,
          monthly_mrr: monthlyMRR,
          annual_value: annualValue
        };
        
        console.log('✅ Processed payment record:', result);
        return result;
    });

    // Step 2: Get all standalone sale activities that aren't already in clients table
    const standaloneActivityRecords = activities
      .filter(activity => 
        activity.type === 'sale' && 
        activity.status === 'completed' &&
        activity.client_name &&
        activity.client_name.trim() !== ''
      )
      .filter(activity => {
        // Only include activities that don't already have a payment record in clients table
        // Check by both deal_id and company name matching
        const hasPaymentRecord = clients.some(client => 
          (activity.deal_id && client.deal_id === activity.deal_id) ||
          (client.company_name?.toLowerCase() === activity.client_name?.toLowerCase())
        );
        return !hasPaymentRecord;
      })
      .map(activity => {
        console.log('🔥 Processing standalone activity as payment:', { 
          company: activity.client_name, 
          deal_id: activity.deal_id,
          amount: activity.amount,
          sales_rep: activity.sales_rep
        });

        // Find corresponding deal if it exists
        const correspondingDeal = activity.deal_id ? deals?.find(deal => deal.id === activity.deal_id) : null;
        
        // Determine payment type based on activity details
        let paymentType: 'one-off' | 'subscription' = 'one-off';
        if (activity.details?.toLowerCase().includes('subscription') || 
            activity.details?.toLowerCase().includes('recurring') ||
            activity.details?.toLowerCase().includes('monthly')) {
          paymentType = 'subscription';
        }

        // SECURITY: Calculate revenue values with robust validation
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
        
        // SECURITY: Calculate lifetime value with validated inputs
        const lifetimeCalculation = calculateLifetimeValue(monthlyMRR, oneOffRevenue);
        const lifetimeDealValue = lifetimeCalculation.value;
        
        // Log calculation issues for standalone activities
        if (!lifetimeCalculation.isValid) {
          FinancialLogger.log('medium', 'Lifetime value calculation issues for standalone activity', {
            activityId: activity.id,
            clientName: activity.client_name,
            errors: lifetimeCalculation.errors,
            monthlyMRR,
            oneOffRevenue,
            activityAmount: activity.amount
          });
        }

        // Resolve sales rep for standalone activities too
        let rawActivitySalesRep = activity.sales_rep || correspondingDeal?.assigned_to || correspondingDeal?.owner_id || 'Unknown';
        const activitySalesRep = resolveUserName(rawActivitySalesRep);
        
        console.log('🔥 Standalone activity sales rep resolution:', {
          activity: activity.client_name,
          raw_sales_rep: rawActivitySalesRep,
          final_sales_rep: activitySalesRep,
          activity_date: activity.date,
          deal_found: !!correspondingDeal
        });

        const result: ExtendedPaymentRecord = {
          id: `activity-${activity.id}`, // Unique ID for standalone activities
          client_id: activity.id,
          client_name: activity.client_name,
          deal_name: correspondingDeal?.name || 'Standalone Activity',
          deal_value: lifetimeDealValue,
          deal_type: paymentType,
          signed_date: activity.date,
          sales_rep: activitySalesRep,
          contact_identifier: activity.contact_name || activity.client_name,
          details: `Activity: ${activity.details || 'Sale'} | Type: ${paymentType} | Amount: £${activity.amount || 0}`,
          deal_id: activity.deal_id,
          status: 'signed', // Default status for standalone activities
          // Separate revenue values
          lifetime_deal_value: lifetimeDealValue,
          one_off_revenue: oneOffRevenue,
          monthly_mrr: monthlyMRR,
          annual_value: annualValue
        };

        console.log('✅ Processed standalone activity as payment:', result);
        return result;
      });

    // Step 3: Combine both sources and sort by date
    const allPaymentRecords = [...clientPaymentRecords, ...standaloneActivityRecords]
      .sort((a, b) => new Date(b.signed_date).getTime() - new Date(a.signed_date).getTime());

    console.log('📊 Final payment records summary:', {
      clientPaymentRecords: clientPaymentRecords.length,
      standaloneActivityRecords: standaloneActivityRecords.length,
      totalPaymentRecords: allPaymentRecords.length
    });

    return allPaymentRecords;
  }, [clients, deals, activities, isLoading, resolveUserName]);

  // ENHANCED: Filter payment records with comprehensive filtering
  const filteredPayments = useMemo(() => {
    return paymentRecords.filter(payment => {
      const matchesSearch = !filters.searchQuery || 
        payment.client_name?.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
        payment.sales_rep?.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
        payment.deal_name?.toLowerCase().includes(filters.searchQuery.toLowerCase());
      
      const matchesDealType = !filters.dealType || payment.deal_type === filters.dealType;
      
      const matchesMinValue = !filters.minValue || payment.deal_value >= filters.minValue;
      const matchesMaxValue = !filters.maxValue || payment.deal_value <= filters.maxValue;
      
      const matchesSalesRep = !filters.salesRep || payment.sales_rep === filters.salesRep;
      
      // NEW: Additional filter conditions
      const matchesStatus = !filters.status || payment.status === filters.status;
      
      const matchesDateFrom = !filters.dateFrom || 
        new Date(payment.signed_date) >= new Date(filters.dateFrom);
      
      const matchesDateTo = !filters.dateTo || 
        new Date(payment.signed_date) <= new Date(filters.dateTo);
      
      const matchesOwner = !filters.owner || 
        payment.sales_rep?.toLowerCase().includes(filters.owner.toLowerCase());
      
      return matchesSearch && matchesDealType && matchesMinValue && matchesMaxValue && 
             matchesSalesRep && matchesStatus && matchesDateFrom && matchesDateTo && matchesOwner;
    });
  }, [paymentRecords, filters]);

  // Deal type styling
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

  // Client status styling and icons
  const getClientStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
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

  const resetFilters = () => {
    setFilters({
      searchQuery: '',
      dealType: undefined,
      minValue: undefined,
      maxValue: undefined,
      salesRep: undefined,
      // Reset new filters
      status: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      owner: undefined,
    });
  };

  // Handle editing deal revenue
  const handleEditDealRevenue = (payment: any) => {
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
  };

  const handleEditClientStatus = (payment: any) => {
    // Find existing client status or default to active
    const existingClient = clients.find(c => 
      c.company_name?.toLowerCase() === payment.client_name?.toLowerCase() ||
      c.deal_id === payment.deal_id
    );
    
    setEditingClientStatus({
      clientName: payment.client_name,
      currentStatus: existingClient?.status || 'active',
      dealId: payment.deal_id
    });
  };

  const handleSaveClientStatus = async (newStatus: ClientStatus, additionalData?: {
    noticeDate?: string;
    finalBillingDate?: string;
    churnReason?: string;
  }) => {
    if (!editingClientStatus) return;
    
    // Find existing client
    const existingClient = clients.find(c => 
      c.company_name?.toLowerCase() === editingClientStatus.clientName?.toLowerCase() ||
      c.deal_id === editingClientStatus.dealId
    );
    
    try {
      // Prepare update data based on status
      const updateData: any = {
        status: newStatus,
      };
      
      // Add status-specific fields
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
        // Clear churn-related fields for other statuses
        updateData.churn_date = null;
        updateData.notice_given_date = null;
        updateData.final_billing_date = null;
        updateData.churn_reason = null;
      }
      
      if (existingClient) {
        // Update existing client
        const success = await updateClient(existingClient.id, updateData);
        
        if (success) {
          toast.success('Client status updated successfully');
        }
      } else {
        // Create new client record
        const success = await createClient({
          company_name: editingClientStatus.clientName,
          deal_id: editingClientStatus.dealId || null,
          owner_id: userData?.id || '',
          subscription_amount: 0, // Will be calculated from deal MRR
          subscription_start_date: new Date().toISOString().split('T')[0],
          ...updateData
        });
        
        if (success) {
          toast.success('Client status created successfully');
        }
      }
      
      setEditingClientStatus(null);
    } catch (error: any) {
      console.error('Error updating client status:', error);
      toast.error('Failed to update client status');
    }
  };

  // SECURITY: Calculate summary stats with validated financial data
  const summaryStats = useMemo(() => {
    const totalPayments = filteredPayments.length;
    
    // Safely calculate total value with validation
    const totalValue = filteredPayments.reduce((sum, payment) => {
      const validatedValue = safeParseFinancial(
        payment.lifetime_deal_value || 0, 
        0, 
        { fieldName: 'summary_lifetime_value', allowZero: true }
      );
      return sum + validatedValue;
    }, 0);
    
    const subscriptionPayments = filteredPayments.filter(p => p.deal_type === 'subscription').length;
    const oneOffPayments = filteredPayments.filter(p => p.deal_type === 'one-off').length;
    
    // SECURITY: Calculate total MRR only from subscription payments with validation
    const totalMRR = filteredPayments
      .filter(p => p.deal_type === 'subscription')
      .reduce((sum, payment) => {
        const validatedMRR = safeParseFinancial(
          payment.monthly_mrr || 0, 
          0, 
          { fieldName: 'summary_mrr', allowZero: true }
        );
        return sum + validatedMRR;
      }, 0);
    
    return {
      totalClients: totalPayments, // Match UI expectations
      totalValue,
      subscriptionClients: subscriptionPayments, // Match UI expectations  
      oneOffClients: oneOffPayments, // Match UI expectations
      totalMRR, // New: MRR only from subscriptions
    };
  }, [filteredPayments]);

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
            {(filters.dealType || filters.searchQuery || filters.minValue || filters.maxValue || filters.salesRep) && (
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

                {/* Filter Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Deal Type Filter */}
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

                  {/* Sales Rep Filter */}
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

                  {/* Value Range */}
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

                {/* NEW: Additional Filter Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Status Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Client Status</label>
                    <select
                      value={filters.status || 'all'}
                      onChange={(e) => setFilters(prev => ({ 
                        ...prev, 
                        status: e.target.value === 'all' ? undefined : e.target.value as any
                      }))}
                      className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="all">All Statuses</option>
                      <option value="active">Active</option>
                      <option value="signed">Signed</option>
                      <option value="deposit_paid">Deposit Paid</option>
                      <option value="paused">Paused</option>
                      <option value="notice_given">Notice Given</option>
                      <option value="churned">Churned</option>
                    </select>
                  </div>

                  {/* Date From Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Date From</label>
                    <input
                      type="date"
                      value={filters.dateFrom || ''}
                      onChange={(e) => setFilters(prev => ({ 
                        ...prev, 
                        dateFrom: e.target.value || undefined 
                      }))}
                      className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  {/* Date To Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Date To</label>
                    <input
                      type="date"
                      value={filters.dateTo || ''}
                      onChange={(e) => setFilters(prev => ({ 
                        ...prev, 
                        dateTo: e.target.value || undefined 
                      }))}
                      className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  {/* Owner Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Owner Filter</label>
                    <input
                      type="text"
                      placeholder="Filter by owner/rep..."
                      value={filters.owner || ''}
                      onChange={(e) => setFilters(prev => ({ 
                        ...prev, 
                        owner: e.target.value || undefined 
                      }))}
                      className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Clear Filters */}
                {(filters.dealType || filters.searchQuery || filters.minValue || filters.maxValue || filters.salesRep || 
                  filters.status || filters.dateFrom || filters.dateTo || filters.owner) && (
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

      {/* Table */}
      <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Client</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Deal Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">One-off</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Subscription</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Sales Rep</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Signed Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Deal</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment, index) => {
                const DealTypeIcon = getDealTypeIcon(payment.deal_type);
                const ClientStatusIcon = getClientStatusIcon(payment.status || 'active');
                return (
                  <motion.tr
                    key={payment.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      duration: 0.2,
                      delay: index * 0.02
                    }}
                    className="border-b border-gray-800/50 hover:bg-gray-800/20"
                  >
                    {/* Client */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
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
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                        getClientStatusColor(payment.status || 'active')
                      )}>
                        <ClientStatusIcon className="w-3 h-3" />
                        {getClientStatusLabel(payment.status || 'active')}
                      </div>
                    </td>

                    {/* Deal Value */}
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-white">
                        {formatCurrency(payment.lifetime_deal_value || 0)}
                      </div>
                    </td>

                    {/* One-off Revenue */}
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-blue-400">
                        {formatCurrency(payment.one_off_revenue || 0)}
                      </div>
                    </td>

                    {/* Subscription (Monthly MRR) */}
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-emerald-400">
                        {formatCurrency(payment.monthly_mrr || 0)}
                        {payment.monthly_mrr > 0 && <span className="text-xs text-gray-400">/mo</span>}
                      </div>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                        getDealTypeColor(payment.deal_type)
                      )}>
                        <DealTypeIcon className="w-3 h-3" />
                        {payment.deal_type}
                      </div>
                    </td>

                    {/* Sales Rep */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                          <span className="text-xs font-medium text-emerald-500">
                            {payment.sales_rep?.split(' ').map(n => n[0]).join('') || '??'}
                          </span>
                        </div>
                        <span className="text-sm text-white">{payment.sales_rep}</span>
                      </div>
                    </td>

                    {/* Signed Date */}
                    <td className="px-4 py-3">
                      <div className="text-sm text-white">
                        {format(new Date(payment.signed_date), 'MMM d, yyyy')}
                      </div>
                    </td>

                    {/* Deal */}
                    <td className="px-4 py-3">
                      <div className="text-sm text-white">
                        {payment.deal_id ? (
                          <button
                            onClick={() => {
                              console.log('🔍 Opening deal details for ID:', payment.deal_id);
                              console.log('🔍 Client details:', { 
                                client_name: payment.client_name,
                                deal_name: payment.deal_name,
                                deal_id: payment.deal_id,
                                activity_id: payment.activity_id 
                              });
                              setViewingDealId(payment.deal_id);
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
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {/* Edit Deal Revenue */}
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleEditDealRevenue(payment)}
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
                          onClick={() => handleEditClientStatus(payment)}
                          className="p-2 hover:bg-blue-500/20 rounded-lg transition-colors text-gray-400 hover:text-blue-500"
                          title="Manage client status"
                        >
                          <Users className="w-4 h-4" />
                        </motion.button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
          
          {filteredPayments.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400">
                {paymentRecords.length === 0 ? 'No payment records found.' : 'No payments match your filters.'}
              </div>
            </div>
          )}
        </div>
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
          // Refresh both deals data and MRR calculations when a deal is updated
          console.log('🔄 Deal revenue updated, refreshing data...');
          await refreshDeals();
          await fetchMRRSummary();
          console.log('✅ Data refreshed after deal revenue update');
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
}