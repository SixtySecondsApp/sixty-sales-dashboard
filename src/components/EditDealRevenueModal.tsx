import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  PoundSterling,
  Calendar,
  TrendingUp,
  Save,
  X,
  Edit2
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
import { 
  safeParseFinancial, 
  calculateLifetimeValue, 
  validateMRR,
  validateRevenue,
  FinancialLogger 
} from '@/lib/utils/financialValidation';

interface EditDealRevenueModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealId: string | null;
  dealName: string;
  currentMRR?: number | null;
  currentOneOff?: number | null;
  currentAnnualValue?: number | null;
  onSave?: () => void;
}

export function EditDealRevenueModal({
  isOpen,
  onClose,
  dealId,
  dealName,
  currentMRR = null,
  currentOneOff = null,
  currentAnnualValue = null,
  onSave
}: EditDealRevenueModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    monthly_mrr: currentMRR || 0,
    one_off_revenue: currentOneOff || 0,
  });

  // Update form when props change with validation
  useEffect(() => {
    setFormData({
      monthly_mrr: safeParseFinancial(currentMRR || 0, 0, { fieldName: 'current_mrr', allowZero: true }),
      one_off_revenue: safeParseFinancial(currentOneOff || 0, 0, { fieldName: 'current_one_off', allowZero: true }),
    });
  }, [currentMRR, currentOneOff, isOpen]);

  const handleSave = async () => {
    if (!dealId) {
      toast.error('No deal ID provided');
      return;
    }

    setIsLoading(true);
    
    try {
      // SECURITY: Validate all financial inputs before saving
      const mrrValidation = validateMRR(formData.monthly_mrr);
      const revenueValidation = validateRevenue(formData.one_off_revenue);
      
      if (!mrrValidation.isValid) {
        toast.error(`Invalid MRR: ${mrrValidation.errors.join(', ')}`);
        FinancialLogger.log('high', 'Invalid MRR in deal revenue modal', {
          dealId,
          value: formData.monthly_mrr,
          errors: mrrValidation.errors
        });
        return;
      }
      
      if (!revenueValidation.isValid) {
        toast.error(`Invalid revenue: ${revenueValidation.errors.join(', ')}`);
        FinancialLogger.log('high', 'Invalid revenue in deal revenue modal', {
          dealId,
          value: formData.one_off_revenue,
          errors: revenueValidation.errors
        });
        return;
      }
      
      // SECURITY: Calculate lifetime value with validated inputs
      const lifetimeCalculation = calculateLifetimeValue(mrrValidation.value, revenueValidation.value);
      
      if (!lifetimeCalculation.isValid) {
        toast.error(`Invalid calculated lifetime value: ${lifetimeCalculation.errors.join(', ')}`);
        FinancialLogger.log('high', 'Invalid lifetime value calculation in deal revenue modal', {
          dealId,
          mrr: mrrValidation.value,
          revenue: revenueValidation.value,
          errors: lifetimeCalculation.errors
        });
        return;
      }
      
      const { data, error } = await (supabase
        .from('deals')
        .update({
          monthly_mrr: mrrValidation.value > 0 ? mrrValidation.value : null,
          one_off_revenue: revenueValidation.value > 0 ? revenueValidation.value : null,
          annual_value: lifetimeCalculation.value > 0 ? lifetimeCalculation.value : null,
          updated_at: new Date().toISOString()
        }) as any)
        .eq('id', dealId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating deal revenue:', error);
        throw error;
      }

      toast.success('Deal revenue updated successfully');
      onSave?.();
      onClose();
    } catch (error: any) {
      logger.error('Error updating deal:', error);
      toast.error(error.message || 'Failed to update deal revenue');
    } finally {
      setIsLoading(false);
    }
  };

  // SECURITY: Calculate display values with validation
  const validatedMRR = safeParseFinancial(formData.monthly_mrr, 0, { fieldName: 'display_mrr', allowZero: true });
  const validatedRevenue = safeParseFinancial(formData.one_off_revenue, 0, { fieldName: 'display_revenue', allowZero: true });
  const totalValue = (validatedMRR * 12) + validatedRevenue;
  const lifetimeDisplayCalculation = calculateLifetimeValue(validatedMRR, validatedRevenue);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', { 
      style: 'currency', 
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900/95 backdrop-blur-xl border-gray-800/50 text-white p-6 rounded-xl max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="w-5 h-5 text-emerald-500" />
            Edit Deal Revenue
          </DialogTitle>
          <p className="text-sm text-gray-400">
            Configure revenue breakdown for: <span className="text-white font-medium">{dealName}</span>
          </p>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Monthly MRR */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Monthly Recurring Revenue
            </label>
            <div className="relative">
              <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.monthly_mrr}
                onChange={(e) => {
                  const validatedValue = safeParseFinancial(
                    e.target.value, 
                    0, 
                    { fieldName: 'input_mrr', allowZero: true }
                  );
                  setFormData(prev => ({ 
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
                Annual value: {formatCurrency(validatedMRR * 12)}
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
                value={formData.one_off_revenue}
                onChange={(e) => {
                  const validatedValue = safeParseFinancial(
                    e.target.value, 
                    0, 
                    { fieldName: 'input_revenue', allowZero: true }
                  );
                  setFormData(prev => ({ 
                    ...prev, 
                    one_off_revenue: validatedValue
                  }));
                }}
                className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Lifetime Value (calculated field - informational) */}
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

          {/* Total Annual Value Display */}
          {totalValue > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
              <div className="text-sm text-gray-300 mb-1">Total Annual Value</div>
              <div className="text-2xl font-bold text-emerald-400">
                {formatCurrency(totalValue)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {validatedMRR > 0 && `ARR: ${formatCurrency(validatedMRR * 12)}`}
                {validatedRevenue > 0 && ` + One-off: ${formatCurrency(validatedRevenue)}`}
              </div>
            </div>
          )}
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
            disabled={isLoading || totalValue === 0}
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