import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Plus, 
  Building2, 
  PoundSterling, 
  ChevronDown,
  Check,
  AlertCircle,
  Users
} from 'lucide-react';
import { useDeals } from '@/lib/hooks/useDeals';
import { useDealStages } from '@/lib/hooks/useDealStages';
import { useUser } from '@/lib/hooks/useUser';
import { cn } from '@/lib/utils';
import logger from '@/lib/utils/logger';

export interface DealSelectorProps {
  selectedDealId?: string | null;
  onDealSelect: (dealId: string | null, dealInfo?: any) => void;
  clientName?: string;
  required?: boolean;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  stageFilter?: string | null; // Add stage filter prop
}

interface QuickDealForm {
  name: string;
  company: string;
  value: number;
  stage_id: string;
  contact_name?: string;
  contact_email?: string;
}

export function DealSelector({
  selectedDealId,
  onDealSelect,
  clientName = '',
  required = false,
  className = '',
  placeholder = 'Select or create a deal...',
  disabled = false,
  stageFilter = null
}: DealSelectorProps) {
  const { userData } = useUser();
  const { deals, isLoading: dealsLoading, createDeal } = useDeals(userData?.id);
  const { stages } = useDealStages();
  
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedStageFilter, setSelectedStageFilter] = useState<string | null>(stageFilter);
  
  // Quick deal creation form
  const [quickDealForm, setQuickDealForm] = useState<QuickDealForm>({
    name: '',
    company: clientName || '',
    value: 0,
    stage_id: '',
    contact_name: '',
    contact_email: ''
  });

  // Update company name when clientName prop changes
  useEffect(() => {
    if (clientName && !quickDealForm.company) {
      setQuickDealForm(prev => ({
        ...prev,
        company: clientName,
        name: `${clientName} Opportunity`
      }));
    }
  }, [clientName, quickDealForm.company]);

  // Update selected stage filter when prop changes
  useEffect(() => {
    setSelectedStageFilter(stageFilter);
  }, [stageFilter]);

  // Filter deals based on search query, client name, and stage
  const filteredDeals = useMemo(() => {
    if (!deals) return [];
    
    return deals.filter(deal => {
      const matchesSearch = !searchQuery || 
        deal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.contact_name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesClient = !clientName || 
        deal.company.toLowerCase().includes(clientName.toLowerCase()) ||
        deal.contact_name?.toLowerCase().includes(clientName.toLowerCase());
      
      const matchesStage = !selectedStageFilter || deal.stage_id === selectedStageFilter;
      
      return matchesSearch && matchesClient && matchesStage;
    });
  }, [deals, searchQuery, clientName, selectedStageFilter]);

  // Get the selected deal info
  const selectedDeal = deals?.find(deal => deal.id === selectedDealId);
  
  // Calculate deal counts per stage for display
  const dealCountsByStage = useMemo(() => {
    if (!deals || !stages) return {};
    const counts: Record<string, number> = {};
    stages.forEach(stage => {
      counts[stage.id] = deals.filter(deal => deal.stage_id === stage.id).length;
    });
    return counts;
  }, [deals, stages]);

  // Get default stage for new deals (first stage or "Opportunity")
  const defaultStage = stages?.find(stage => 
    stage.name.toLowerCase().includes('opportunity') || 
    stage.name.toLowerCase().includes('lead')
  ) || stages?.[0];

  useEffect(() => {
    if (defaultStage && !quickDealForm.stage_id) {
      setQuickDealForm(prev => ({ ...prev, stage_id: defaultStage.id }));
    }
  }, [defaultStage, quickDealForm.stage_id]);

  const handleCreateDeal = async () => {
    if (!quickDealForm.name || !quickDealForm.company || !quickDealForm.stage_id) {
      return;
    }

    setIsCreating(true);
    try {
      const dealData = {
        name: quickDealForm.name,
        company: quickDealForm.company,
        contact_name: quickDealForm.contact_name || null,
        contact_email: quickDealForm.contact_email || null,
        value: quickDealForm.value,
        stage_id: quickDealForm.stage_id,
        owner_id: userData?.id || '',
        probability: defaultStage?.default_probability || 10,
        status: 'active'
      };

      const newDeal = await createDeal(dealData);
      if (newDeal) {
        onDealSelect(newDeal.id, newDeal);
        setIsOpen(false);
        setShowCreateForm(false);
        // Reset form
        setQuickDealForm({
          name: '',
          company: clientName || '',
          value: 0,
          stage_id: defaultStage?.id || '',
          contact_name: '',
          contact_email: ''
        });
      }
    } catch (error) {
      logger.error('Failed to create deal:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDealSelect = (deal: any) => {
    onDealSelect(deal.id, deal);
    setIsOpen(false);
  };

  const getStageColor = (stageId: string) => {
    const stage = stages?.find(s => s.id === stageId);
    return stage?.color || 'gray';
  };

  return (
    <div className={cn("relative", className)}>
      {/* Selected Deal Display / Dropdown Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "w-full flex items-center justify-between gap-3 px-4 py-3",
          "bg-white dark:bg-gray-800/50 backdrop-blur-sm",
          "border border-gray-300 dark:border-gray-700",
          "rounded-xl text-left transition-all duration-200",
          "hover:bg-gray-50 dark:hover:bg-gray-800/70",
          "hover:border-gray-400 dark:hover:border-gray-600",
          "focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500",
          disabled && "opacity-50 cursor-not-allowed",
          required && !selectedDealId && "border-red-500/50",
          selectedDealId && "border-emerald-500/50"
        )}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {selectedDeal ? (
            <>
              <div className={cn(
                "w-3 h-3 rounded-full flex-shrink-0",
                `bg-${getStageColor(selectedDeal.stage_id)}-500`
              )} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-white truncate">
                  {selectedDeal.name}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                  {selectedDeal.company} • £{selectedDeal.value?.toLocaleString()}
                </div>
              </div>
            </>
          ) : (
            <>
              <Building2 className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
              <span className="text-gray-500 dark:text-gray-400">{placeholder}</span>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          {required && !selectedDealId && (
            <AlertCircle className="w-4 h-4 text-red-400" />
          )}
          <ChevronDown className={cn(
            "w-4 h-4 text-gray-400 transition-transform duration-200",
            isOpen && "rotate-180"
          )} />
        </div>
      </button>

      {/* Dropdown Content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200 dark:border-gray-800/50 rounded-xl shadow-2xl z-50 max-h-80 overflow-hidden"
          >
            {/* Search Input and Filters */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-800/50 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search deals..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
                />
              </div>
              
              {/* Stage Filter Pills */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStageFilter(null)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5",
                    !selectedStageFilter
                      ? "bg-violet-500 text-white"
                      : "bg-gray-200 dark:bg-gray-800/50 text-gray-700 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-300 border border-gray-300 dark:border-gray-700/50"
                  )}
                >
                  All Stages
                  <span className="bg-black/20 px-1.5 py-0.5 rounded-full text-xs">
                    {deals?.length || 0}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const sqlStage = stages?.find(s => s.name === 'SQL');
                    setSelectedStageFilter(sqlStage?.id || null);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5",
                    selectedStageFilter === stages?.find(s => s.name === 'SQL')?.id
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 dark:bg-gray-800/50 text-gray-700 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-300 border border-gray-300 dark:border-gray-700/50"
                  )}
                >
                  SQL
                  <span className="bg-black/20 px-1.5 py-0.5 rounded-full text-xs">
                    {dealCountsByStage[stages?.find(s => s.name === 'SQL')?.id || ''] || 0}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const oppStage = stages?.find(s => s.name === 'Opportunity');
                    setSelectedStageFilter(oppStage?.id || null);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5",
                    selectedStageFilter === stages?.find(s => s.name === 'Opportunity')?.id
                      ? "bg-purple-500 text-white"
                      : "bg-gray-200 dark:bg-gray-800/50 text-gray-700 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-300 border border-gray-300 dark:border-gray-700/50"
                  )}
                >
                  Opportunity
                  <span className="bg-black/20 px-1.5 py-0.5 rounded-full text-xs">
                    {dealCountsByStage[stages?.find(s => s.name === 'Opportunity')?.id || ''] || 0}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const verbalStage = stages?.find(s => s.name === 'Verbal');
                    setSelectedStageFilter(verbalStage?.id || null);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5",
                    selectedStageFilter === stages?.find(s => s.name === 'Verbal')?.id
                      ? "bg-orange-500 text-white"
                      : "bg-gray-200 dark:bg-gray-800/50 text-gray-700 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-300 border border-gray-300 dark:border-gray-700/50"
                  )}
                >
                  Verbal
                  <span className="bg-black/20 px-1.5 py-0.5 rounded-full text-xs">
                    {dealCountsByStage[stages?.find(s => s.name === 'Verbal')?.id || ''] || 0}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const signedStage = stages?.find(s => s.name === 'Signed');
                    setSelectedStageFilter(signedStage?.id || null);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5",
                    selectedStageFilter === stages?.find(s => s.name === 'Signed')?.id
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 dark:bg-gray-800/50 text-gray-700 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-300 border border-gray-300 dark:border-gray-700/50"
                  )}
                >
                  Signed
                  <span className="bg-black/20 px-1.5 py-0.5 rounded-full text-xs">
                    {dealCountsByStage[stages?.find(s => s.name === 'Signed')?.id || ''] || 0}
                  </span>
                </button>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto">
              {/* Create New Deal Button */}
              <button
                type="button"
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors border-b border-gray-200 dark:border-gray-800/30"
              >
                <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="font-medium text-emerald-600 dark:text-emerald-400">Create New Deal</span>
              </button>

              {/* Quick Create Form */}
              <AnimatePresence>
                {showCreateForm && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-b border-gray-200 dark:border-gray-800/30 overflow-hidden"
                  >
                    <div className="p-4 space-y-3 bg-gray-50 dark:bg-gray-800/20">
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={quickDealForm.name}
                          onChange={(e) => setQuickDealForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Deal name"
                          className="px-3 py-2 bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        />
                        <input
                          type="text"
                          value={quickDealForm.company}
                          onChange={(e) => setQuickDealForm(prev => ({ ...prev, company: e.target.value }))}
                          placeholder="Company"
                          className="px-3 py-2 bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="number"
                          value={quickDealForm.value || ''}
                          onChange={(e) => setQuickDealForm(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                          placeholder="Deal value (£)"
                          className="px-3 py-2 bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        />
                        <select
                          value={quickDealForm.stage_id}
                          onChange={(e) => setQuickDealForm(prev => ({ ...prev, stage_id: e.target.value }))}
                          className="px-3 py-2 bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        >
                          {stages?.map(stage => (
                            <option key={stage.id} value={stage.id}>
                              {stage.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={handleCreateDeal}
                          disabled={isCreating || !quickDealForm.name || !quickDealForm.company}
                          className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          {isCreating ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                          Create Deal
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCreateForm(false)}
                          className="px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Existing Deals List */}
              {dealsLoading ? (
                <div className="p-4 text-center text-gray-600 dark:text-gray-400">
                  <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-violet-500 rounded-full animate-spin mx-auto mb-2" />
                  Loading deals...
                </div>
              ) : filteredDeals.length > 0 ? (
                <div className="py-2">
                  {filteredDeals.map((deal) => (
                    <button
                      key={deal.id}
                      type="button"
                      onClick={() => handleDealSelect(deal)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <div className={cn(
                        "w-3 h-3 rounded-full flex-shrink-0",
                        `bg-${getStageColor(deal.stage_id)}-500`
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate">
                          {deal.name}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                          {deal.company} • £{deal.value?.toLocaleString()} • {stages?.find(s => s.id === deal.stage_id)?.name || 'Unknown'}
                        </div>
                      </div>
                      {selectedDealId === deal.id && (
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-600 dark:text-gray-400">
                  {searchQuery ? (
                    <>
                      <Building2 className="w-8 h-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                      No deals found matching "{searchQuery}"
                    </>
                  ) : (
                    <>
                      <Building2 className="w-8 h-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                      No deals found
                      {clientName && (
                        <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          for {clientName}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Clear Selection Option */}
            {selectedDealId && !required && (
              <div className="border-t border-gray-200 dark:border-gray-800/30 p-2">
                <button
                  type="button"
                  onClick={() => {
                    onDealSelect(null);
                    setIsOpen(false);
                  }}
                  className="w-full px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg transition-colors text-sm"
                >
                  Clear selection
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}