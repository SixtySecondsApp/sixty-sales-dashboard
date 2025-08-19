import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  X, 
  DollarSign,
  Calendar,
  Eye,
  ExternalLink,
  Building2,
  TrendingUp,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase/clientV2';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface CompanyDealsModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string | null;
  companyName: string;
}

interface Deal {
  id: string;
  name: string;
  value: number;
  monthly_mrr: number | null;
  one_off_revenue: number | null;
  annual_value: number | null;
  status: string | null;
  expected_close_date: string | null;
  created_at: string;
  updated_at: string;
  deal_stages?: {
    name: string;
    color: string;
  };
}

export function CompanyDealsModal({ isOpen, onClose, companyId, companyName }: CompanyDealsModalProps) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && companyId) {
      fetchCompanyDeals();
    }
  }, [isOpen, companyId]);

  const fetchCompanyDeals = async () => {
    if (!companyId) return;
    
    setIsLoading(true);
    try {
      console.log('🔍 Fetching deals for company ID:', companyId);
      
      // Try with relationship first
      let { data, error } = await supabase
        .from('deals')
        .select(`
          *,
          deal_stages!inner (
            name,
            color
          )
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      // If relationship fails, try without it and manually fetch stage data
      if (error) {
        console.warn('Relationship query failed, trying basic query:', error);
        
        const { data: basicData, error: basicError } = await supabase
          .from('deals')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false });

        if (basicError) {
          console.error('Error fetching company deals:', basicError);
          toast.error('Failed to load company deals');
          return;
        }

        // Manually fetch stage data for each deal
        const dealsWithStages = await Promise.all(
          (basicData || []).map(async (deal: any) => {
            if (deal.stage_id) {
              try {
                const { data: stageData } = await supabase
                  .from('deal_stages')
                  .select('name, color')
                  .eq('id', deal.stage_id)
                  .single();
                
                if (stageData) {
                  deal.deal_stages = stageData;
                }
              } catch (stageError) {
                console.warn(`Could not fetch stage data for deal ${deal.id}:`, stageError);
              }
            }
            return deal;
          })
        );
        
        data = dealsWithStages;
      }

      console.log(`✅ Found ${data?.length || 0} deals for company`);
      setDeals(data || []);
    } catch (error: any) {
      console.error('Error fetching deals:', error);
      toast.error('Failed to load company deals');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return '£0';
    return new Intl.NumberFormat('en-GB', { 
      style: 'currency', 
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'won':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'lost':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'active':
      case 'in_progress':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  const getDealTypeInfo = (deal: Deal) => {
    if (deal.monthly_mrr && deal.monthly_mrr > 0) {
      return {
        type: 'Subscription',
        icon: TrendingUp,
        color: 'text-blue-400',
        value: formatCurrency(deal.monthly_mrr) + '/mo'
      };
    } else if (deal.one_off_revenue && deal.one_off_revenue > 0) {
      return {
        type: 'One-off',
        icon: Zap,
        color: 'text-orange-400',
        value: formatCurrency(deal.one_off_revenue)
      };
    } else {
      return {
        type: 'Standard',
        icon: DollarSign,
        color: 'text-gray-400',
        value: formatCurrency(deal.value)
      };
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900/95 backdrop-blur-xl border-gray-800/50 text-white p-0 rounded-xl max-w-5xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-gray-800/50">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                <Building2 className="w-6 h-6 text-blue-400" />
                {companyName} - Deals
              </DialogTitle>
              <div className="text-sm text-gray-400">
                {deals.length} {deals.length === 1 ? 'deal' : 'deals'} total
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-gray-700 rounded-lg"></div>
              ))}
            </div>
          ) : deals.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-400 mb-2">No deals found</h3>
              <p className="text-gray-500 text-sm">
                This company doesn't have any deals yet.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {deals.map((deal) => {
                const dealInfo = getDealTypeInfo(deal);
                const DealIcon = dealInfo.icon;
                
                return (
                  <motion.div
                    key={deal.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50 hover:border-gray-600/50 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`p-2 rounded-lg bg-gray-700/50 ${dealInfo.color}`}>
                            <DealIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="font-medium text-white">{deal.name}</h3>
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                              <span className={dealInfo.color}>{dealInfo.type}</span>
                              <span>•</span>
                              <span>{dealInfo.value}</span>
                              {deal.expected_close_date && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {format(new Date(deal.expected_close_date), 'MMM d, yyyy')}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 mb-3">
                          {deal.status && (
                            <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(deal.status)}`}>
                              {deal.status.replace('_', ' ').toUpperCase()}
                            </div>
                          )}
                          {deal.deal_stages && (
                            <div className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 border border-blue-500/20 text-blue-400">
                              {deal.deal_stages.name}
                            </div>
                          )}
                        </div>

                        {/* Revenue breakdown */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="text-sm">
                            <div className="text-gray-400">Total Value</div>
                            <div className="font-medium text-white">{formatCurrency(deal.value)}</div>
                          </div>
                          {deal.monthly_mrr && deal.monthly_mrr > 0 && (
                            <div className="text-sm">
                              <div className="text-gray-400">Monthly MRR</div>
                              <div className="font-medium text-blue-400">{formatCurrency(deal.monthly_mrr)}</div>
                            </div>
                          )}
                          {deal.one_off_revenue && deal.one_off_revenue > 0 && (
                            <div className="text-sm">
                              <div className="text-gray-400">One-off Revenue</div>
                              <div className="font-medium text-orange-400">{formatCurrency(deal.one_off_revenue)}</div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // Open deal details modal
                            // You could integrate with the DealDetailsModal here
                            window.open(`/pipeline?deal=${deal.id}`, '_blank');
                          }}
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <div className="text-xs text-gray-500 text-right">
                          Created {format(new Date(deal.created_at), 'MMM d')}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-6 pt-4 border-t border-gray-800/50">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-gray-400">
              Total Value: {formatCurrency(deals.reduce((sum, deal) => sum + (deal.value || 0), 0))}
            </div>
            <Button
              variant="ghost"
              onClick={onClose}
              className="bg-gray-800/50 text-gray-300 hover:bg-gray-800"
            >
              <X className="w-4 h-4 mr-2" />
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}