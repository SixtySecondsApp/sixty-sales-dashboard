import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  PoundSterling,
  Calendar,
  TrendingUp,
  Save,
  X,
  Edit2,
  Users,
  CheckCircle,
  PauseCircle,
  XCircle,
  AlertCircle,
  UserCheck,
  DollarSign
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
import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';
import { cn } from '@/lib/utils';
import { 
  safeParseFinancial, 
  calculateLifetimeValue, 
  validateMRR,
  validateRevenue,
  FinancialLogger 
} from '@/lib/utils/financialValidation';
import { ClientStatus } from '@/lib/hooks/useClients';

interface EditClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientData: {
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
  } | null;
  onSave?: () => void;
}

export function EditClientModal({
  isOpen,
  onClose,
  clientData,
  onSave
}: EditClientModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDealId, setSelectedDealId] = useState<string>('');
  
  // Revenue form data
  const [revenueData, setRevenueData] = useState({
    monthly_mrr: 0,
    one_off_revenue: 0,
  });

  // Status form data
  const [statusData, setStatusData] = useState({
    status: clientData?.currentStatus || 'active' as ClientStatus,
    noticeDate: new Date().toISOString().split('T')[0],
    finalBillingDate: '',
    churnReason: '',
  });

  // Initialize form data when modal opens or client changes
  useEffect(() => {
    if (isOpen && clientData) {
      // Initialize status with actual client status (not defaulting to 'active')
      setStatusData(prev => ({
        ...prev,
        status: clientData.currentStatus,
      }));

      // If client has deals, select the first one by default
      if (clientData.deals && clientData.deals.length > 0) {
        const firstDeal = clientData.deals[0];
        setSelectedDealId(firstDeal.id);
        setRevenueData({
          monthly_mrr: safeParseFinancial(firstDeal.monthly_mrr || 0, 0, { fieldName: 'current_mrr', allowZero: true }),
          one_off_revenue: safeParseFinancial(firstDeal.one_off_revenue || 0, 0, { fieldName: 'current_one_off', allowZero: true }),
        });
      }
    }
  }, [isOpen, clientData]);

  // Update revenue data when selected deal changes
  const handleDealSelection = (dealId: string) => {
    setSelectedDealId(dealId);
    const deal = clientData?.deals?.find(d => d.id === dealId);
    if (deal) {
      setRevenueData({
        monthly_mrr: safeParseFinancial(deal.monthly_mrr || 0, 0, { fieldName: 'selected_mrr', allowZero: true }),
        one_off_revenue: safeParseFinancial(deal.one_off_revenue || 0, 0, { fieldName: 'selected_one_off', allowZero: true }),
      });
    }
  };

  const statuses: { value: ClientStatus; label: string; icon: any; color: string; description: string }[] = [
    {
      value: 'signed',
      label: 'Signed',
      icon: UserCheck,
      color: 'border-blue-500/50 bg-blue-500/10 text-blue-400',
      description: 'Contract signed, awaiting setup'
    },
    {
      value: 'deposit_paid',
      label: 'Deposit Paid',
      icon: DollarSign,
      color: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400',
      description: 'Initial payment received'
    },
    {
      value: 'active',
      label: 'Active',
      icon: CheckCircle,
      color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400',
      description: 'Subscription is active and billing'
    },
    {
      value: 'paused',
      label: 'Paused',
      icon: PauseCircle,
      color: 'border-orange-500/50 bg-orange-500/10 text-orange-400',
      description: 'Temporarily paused, not billing'
    },
    {
      value: 'notice_given',
      label: 'Notice Given',
      icon: AlertCircle,
      color: 'border-red-500/50 bg-red-500/10 text-red-400',
      description: 'Client gave notice, awaiting final billing'
    },
    {
      value: 'churned',
      label: 'Churned',
      icon: XCircle,
      color: 'border-gray-500/50 bg-gray-500/10 text-gray-400',
      description: 'Subscription ended, no longer billing'
    }
  ];

  const needsChurnDates = statusData.status === 'notice_given' || statusData.status === 'churned';

  const calculateFinalBillingDate = (noticeDateStr: string) => {
    if (!noticeDateStr) return '';
    
    const notice = new Date(noticeDateStr);
    // Add 30 days for notice period (adjust based on your contract terms)
    notice.setDate(notice.getDate() + 30);
    return notice.toISOString().split('T')[0];
  };

  const handleNoticeDateChange = (dateStr: string) => {
    setStatusData(prev => ({
      ...prev,
      noticeDate: dateStr,
      finalBillingDate: dateStr && !prev.finalBillingDate ? calculateFinalBillingDate(dateStr) : prev.finalBillingDate,
    }));
  };

  const handleSave = async () => {
    if (!selectedDealId) {
      toast.error('Please select a deal to update');
      return;
    }

    setIsLoading(true);
    
    try {
      // Validate financial inputs
      const mrrValidation = validateMRR(revenueData.monthly_mrr);
      const revenueValidation = validateRevenue(revenueData.one_off_revenue);
      
      if (!mrrValidation.isValid) {
        toast.error(`Invalid MRR: ${mrrValidation.errors.join(', ')}`);
        FinancialLogger.log('high', 'Invalid MRR in client edit modal', {
          clientId: clientData.id,
          value: revenueData.monthly_mrr,
          errors: mrrValidation.errors
        });
        return;
      }
      
      if (!revenueValidation.isValid) {
        toast.error(`Invalid revenue: ${revenueValidation.errors.join(', ')}`);
        FinancialLogger.log('high', 'Invalid revenue in client edit modal', {
          clientId: clientData.id,
          value: revenueData.one_off_revenue,
          errors: revenueValidation.errors
        });
        return;
      }
      
      // Calculate lifetime value with validated inputs
      const lifetimeCalculation = calculateLifetimeValue(mrrValidation.value, revenueValidation.value);
      
      if (!lifetimeCalculation.isValid) {
        toast.error(`Invalid calculated lifetime value: ${lifetimeCalculation.errors.join(', ')}`);
        FinancialLogger.log('high', 'Invalid lifetime value calculation in client edit modal', {
          clientId: clientData.id,
          mrr: mrrValidation.value,
          revenue: revenueValidation.value,
          errors: lifetimeCalculation.errors
        });
        return;
      }

      // Update deal revenue
      const { error: dealError } = await supabase
        .from('deals')
        .update({
          monthly_mrr: mrrValidation.value > 0 ? mrrValidation.value : null,
          one_off_revenue: revenueValidation.value > 0 ? revenueValidation.value : null,
          annual_value: lifetimeCalculation.value > 0 ? lifetimeCalculation.value : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedDealId);

      if (dealError) {
        logger.error('Error updating deal revenue:', dealError);
        throw dealError;
      }

      // Update client status if it has changed and we have the additional data needed
      if (statusData.status !== clientData.currentStatus) {
        const clientUpdates: any = {
          status: statusData.status,
          updated_at: new Date().toISOString()
        };

        // Add churn-related fields if needed
        if (needsChurnDates) {
          clientUpdates.notice_given_date = statusData.noticeDate;
          clientUpdates.final_billing_date = statusData.finalBillingDate;
          if (statusData.churnReason) {
            clientUpdates.churn_reason = statusData.churnReason;
          }
          if (statusData.status === 'churned') {
            clientUpdates.churn_date = new Date().toISOString();
          }
        }

        const { error: clientError } = await supabase
          .from('clients')
          .update(clientUpdates)
          .eq('id', clientData.id);

        if (clientError) {
          logger.error('Error updating client status:', clientError);
          // Don't throw here - deal update succeeded, just warn about status update
          toast.warning('Revenue updated successfully, but client status update failed');
        }
      }

      toast.success('Client information updated successfully');
      onSave?.();
      onClose();
    } catch (error: any) {
      logger.error('Error updating client:', error);
      toast.error(error.message || 'Failed to update client information');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate display values with validation
  const validatedMRR = safeParseFinancial(revenueData.monthly_mrr, 0, { fieldName: 'display_mrr', allowZero: true });
  const validatedRevenue = safeParseFinancial(revenueData.one_off_revenue, 0, { fieldName: 'display_revenue', allowZero: true });
  const arrValue = validatedMRR * 12; // ARR = Annual Recurring Revenue
  const lifetimeDisplayCalculation = calculateLifetimeValue(validatedMRR, validatedRevenue);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', { 
      style: 'currency', 
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Guard clause: Don't render if clientData is null
  if (!clientData) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900/95 backdrop-blur-xl border-gray-800/50 text-white p-6 rounded-xl max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="w-5 h-5 text-emerald-500" />
            Edit Client Information
          </DialogTitle>
          <p className="text-sm text-gray-400">
            Manage revenue and status for: <span className="text-white font-medium">{clientData.name}</span>
          </p>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Deal Selection (if multiple deals) */}
          {clientData.deals && clientData.deals.length > 1 && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-300">Select Deal to Edit</label>
              <div className="grid grid-cols-1 gap-2">
                {clientData.deals.map((deal) => (
                  <button
                    key={deal.id}
                    onClick={() => handleDealSelection(deal.id)}
                    className={cn(
                      "p-3 rounded-lg border-2 text-left transition-colors",
                      selectedDealId === deal.id 
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' 
                        : 'border-gray-700/50 bg-gray-800/50 text-gray-300 hover:border-gray-600/50'
                    )}
                  >
                    <div className="font-medium">{deal.name}</div>
                    <div className="text-xs text-gray-500">
                      MRR: {formatCurrency(deal.monthly_mrr || 0)} • One-off: {formatCurrency(deal.one_off_revenue || 0)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Revenue Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white border-b border-gray-700 pb-2">Revenue Information</h3>
            
            {/* Monthly MRR */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Monthly Subscription Revenue
              </label>
              <div className="relative">
                <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={revenueData.monthly_mrr}
                  onChange={(e) => {
                    const validatedValue = safeParseFinancial(
                      e.target.value, 
                      0, 
                      { fieldName: 'input_mrr', allowZero: true }
                    );
                    setRevenueData(prev => ({ 
                      ...prev, 
                      monthly_mrr: validatedValue
                    }));
                  }}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
              {validatedMRR > 0 && (
                <p className="text-xs text-gray-500">
                  ARR: {formatCurrency(arrValue)}
                </p>
              )}
            </div>

            {/* One-off Revenue */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <PoundSterling className="w-4 h-4 text-blue-500" />
                One-off Revenue
              </label>
              <div className="relative">
                <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={revenueData.one_off_revenue}
                  onChange={(e) => {
                    const validatedValue = safeParseFinancial(
                      e.target.value, 
                      0, 
                      { fieldName: 'input_revenue', allowZero: true }
                    );
                    setRevenueData(prev => ({ 
                      ...prev, 
                      one_off_revenue: validatedValue
                    }));
                  }}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Lifetime Value (calculated field) */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-500" />
                Lifetime Value (Auto-calculated)
              </label>
              <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg px-3 py-2 text-gray-400">
                {formatCurrency(lifetimeDisplayCalculation.value)}
                <div className="text-xs text-gray-500 mt-1">
                  (3 × Monthly Subscription) + One-off = ({formatCurrency(validatedMRR * 3)}) + {formatCurrency(validatedRevenue)}
                </div>
                {!lifetimeDisplayCalculation.isValid && (
                  <div className="text-xs text-red-400 mt-1">
                    ⚠️ Calculation errors: {lifetimeDisplayCalculation.errors.join(', ')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white border-b border-gray-700 pb-2">Client Status</h3>
            
            {/* Status Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-300">Current Status</label>
              <div className="grid grid-cols-2 gap-3">
                {statuses.map((status) => {
                  const isSelected = statusData.status === status.value;
                  const Icon = status.icon;
                  
                  return (
                    <button
                      key={status.value}
                      onClick={() => setStatusData(prev => ({ ...prev, status: status.value }))}
                      className={cn(
                        "p-3 rounded-lg border-2 transition-colors text-left",
                        isSelected 
                          ? status.color 
                          : 'border-gray-700/50 bg-gray-800/50 text-gray-400 hover:border-gray-600/50'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-4 h-4" />
                        <span className="font-medium">{status.label}</span>
                      </div>
                      <div className="text-xs opacity-80">
                        {status.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Churn-related fields */}
            {needsChurnDates && (
              <div className="space-y-4 bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                <h4 className="text-sm font-medium text-red-300">Churn Information</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-gray-300">Notice Date</label>
                    <input
                      type="date"
                      value={statusData.noticeDate}
                      onChange={(e) => handleNoticeDateChange(e.target.value)}
                      className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm text-gray-300">Final Billing Date</label>
                    <input
                      type="date"
                      value={statusData.finalBillingDate}
                      onChange={(e) => setStatusData(prev => ({ ...prev, finalBillingDate: e.target.value }))}
                      className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm text-gray-300">Churn Reason (Optional)</label>
                  <textarea
                    value={statusData.churnReason}
                    onChange={(e) => setStatusData(prev => ({ ...prev, churnReason: e.target.value }))}
                    placeholder="Reason for cancellation..."
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
            className="bg-gray-800/50 text-gray-300 hover:bg-gray-800"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading || !selectedDealId}
            className="bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"
              />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}