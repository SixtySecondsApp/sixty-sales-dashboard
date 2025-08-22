import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, Users, DollarSign, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useClients, ClientStatus, ConvertDealToClientParams } from '@/lib/hooks/useClients';
import { DealWithRelationships } from '@/lib/hooks/useDeals';
import { cn } from '@/lib/utils';
import logger from '@/lib/utils/logger';

interface ConvertDealModalProps {
  deal: DealWithRelationships | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ConvertDealModal({ deal, isOpen, onClose, onSuccess }: ConvertDealModalProps) {
  const { convertDealToClient } = useClients();
  const [isConverting, setIsConverting] = useState(false);
  const [step, setStep] = useState<'confirm' | 'form' | 'success'>('confirm');
  
  const [formData, setFormData] = useState({
    company_name: '',
    contact_name: '',
    contact_email: '',
    subscription_amount: 0,
    subscription_start_date: new Date().toISOString().split('T')[0],
    status: 'active' as ClientStatus,
  });

  // Reset form when deal changes
  useEffect(() => {
    if (deal) {
      setFormData({
        company_name: deal.company || '',
        contact_name: deal.contact_name || deal.contacts?.full_name || '',
        contact_email: deal.contacts?.email || '',
        subscription_amount: deal.monthly_mrr || deal.value || 0,
        subscription_start_date: new Date().toISOString().split('T')[0],
        status: 'active' as ClientStatus,
      });
      setStep('confirm');
    }
  }, [deal]);

  const handleClose = () => {
    setStep('confirm');
    setIsConverting(false);
    onClose();
  };

  const handleConfirm = () => {
    setStep('form');
  };

  const handleConvert = async () => {
    if (!deal) return;

    setIsConverting(true);
    try {
      const params: ConvertDealToClientParams = {
        company_name: formData.company_name,
        contact_name: formData.contact_name,
        contact_email: formData.contact_email,
        subscription_amount: formData.subscription_amount,
        subscription_start_date: formData.subscription_start_date,
        status: formData.status,
      };

      const result = await convertDealToClient(deal.id, params);
      
      if (result) {
        setStep('success');
        onSuccess?.();
        // Auto-close after 2 seconds
        setTimeout(() => {
          handleClose();
        }, 2000);
      }
    } catch (error) {
      logger.error('Conversion failed:', error);
    } finally {
      setIsConverting(false);
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

  if (!deal) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="bg-gray-900/95 backdrop-blur-xl border-gray-800/50 text-white rounded-xl max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-500" />
            Convert Deal to Subscription
          </DialogTitle>
        </DialogHeader>

        {step === 'confirm' && (
          <div className="space-y-6">
            {/* Deal Summary */}
            <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
              <h3 className="text-lg font-semibold text-white">Deal Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Deal Name:</span>
                  <div className="text-white font-medium">{deal.name}</div>
                </div>
                <div>
                  <span className="text-gray-400">Company:</span>
                  <div className="text-white font-medium">{deal.company || 'No company'}</div>
                </div>
                <div>
                  <span className="text-gray-400">Contact:</span>
                  <div className="text-white font-medium">{deal.contact_name || 'No contact'}</div>
                </div>
                <div>
                  <span className="text-gray-400">Deal Value:</span>
                  <div className="text-white font-medium">{formatCurrency(deal.value)}</div>
                </div>
                {deal.monthly_mrr && (
                  <div>
                    <span className="text-gray-400">Monthly MRR:</span>
                    <div className="text-emerald-400 font-medium">{formatCurrency(deal.monthly_mrr)}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Conversion Info */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="font-medium text-emerald-400">Ready to Convert</h4>
                  <p className="text-sm text-gray-300">
                    This will create a new subscription client and mark the deal as converted. 
                    You'll be able to adjust the subscription details on the next step.
                  </p>
                  {deal.monthly_mrr && (
                    <p className="text-sm text-emerald-300">
                      <strong>Suggested MRR:</strong> {formatCurrency(deal.monthly_mrr)} per month
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'form' && (
          <div className="space-y-6">
            <div className="text-sm text-gray-400">
              Review and adjust the subscription details for the new client:
            </div>

            <div className="space-y-4">
              {/* Company and Contact */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={formData.contact_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              {/* Subscription Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Monthly Amount (£) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.subscription_amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, subscription_amount: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.subscription_start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, subscription_start_date: e.target.value }))}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Initial Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as ClientStatus }))}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h4 className="font-medium text-white mb-2">Conversion Summary</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Monthly Revenue:</span>
                  <span className="text-emerald-400 font-medium">
                    {formatCurrency(formData.subscription_amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Annual Value:</span>
                  <span className="text-white font-medium">
                    {formatCurrency(formData.subscription_amount * 12)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'success' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 text-center"
          >
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Deal Converted Successfully!
              </h3>
              <p className="text-gray-400">
                <strong>{formData.company_name}</strong> has been added as a subscription client 
                with {formatCurrency(formData.subscription_amount)} monthly recurring revenue.
              </p>
            </div>
          </motion.div>
        )}

        <DialogFooter>
          {step === 'confirm' && (
            <>
              <Button
                variant="ghost"
                onClick={handleClose}
                className="bg-gray-800/50 text-gray-300 hover:bg-gray-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                Continue
              </Button>
            </>
          )}
          
          {step === 'form' && (
            <>
              <Button
                variant="ghost"
                onClick={() => setStep('confirm')}
                className="bg-gray-800/50 text-gray-300 hover:bg-gray-800"
                disabled={isConverting}
              >
                Back
              </Button>
              <Button
                onClick={handleConvert}
                disabled={isConverting || !formData.company_name || formData.subscription_amount <= 0}
                className="bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConverting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Converting...
                  </div>
                ) : (
                  'Convert to Subscription'
                )}
              </Button>
            </>
          )}
          
          {step === 'success' && (
            <Button
              onClick={handleClose}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}