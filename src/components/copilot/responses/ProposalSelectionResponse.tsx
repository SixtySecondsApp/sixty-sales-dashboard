/**
 * Proposal Selection Response Component
 * Shows proposals found for a contact and allows user to select which one to create a task for
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, CheckCircle, Calendar, DollarSign, Building2, ArrowRight, Loader2 } from 'lucide-react';
import type { ProposalSelectionResponse as ProposalSelectionResponseType } from '../types';
import { useTasks } from '@/lib/hooks/useTasks';
import { useUser } from '@/lib/hooks/useUser';
import { toast } from 'sonner';
import logger from '@/lib/utils/logger';

interface ProposalSelectionResponseProps {
  data: ProposalSelectionResponseType;
  onActionClick?: (action: any) => void;
}

const formatCurrency = (value: number | null | undefined): string => {
  if (!value) return 'N/A';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  
  if (isToday) return 'Today';
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
};

export const ProposalSelectionResponse: React.FC<ProposalSelectionResponseProps> = ({ 
  data,
  onActionClick 
}) => {
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { createTask } = useTasks();
  const { userData } = useUser();
  const responseData = data.data;

  const handleProposalSelect = (proposalId: string) => {
    setSelectedProposalId(proposalId);
  };

  const handleCreateTask = async () => {
    if (!selectedProposalId) {
      toast.error('Please select a proposal first');
      return;
    }

    if (!userData?.id) {
      toast.error('User authentication required. Please try again.');
      return;
    }

    setIsCreating(true);
    try {
      const selectedProposal = responseData.proposals.find(p => p.id === selectedProposalId);
      if (!selectedProposal) {
        throw new Error('Selected proposal not found');
      }

      logger.log('Creating task for proposal:', selectedProposal);
      
      await createTask({
        title: responseData.taskTitle || `Follow up on proposal for ${selectedProposal.clientName}`,
        description: `Follow-up task for proposal: ${selectedProposal.details || selectedProposal.clientName}${selectedProposal.amount ? ` (${formatCurrency(selectedProposal.amount)})` : ''}`,
        priority: responseData.priority,
        task_type: responseData.taskType || 'follow_up',
        due_date: responseData.dueDate || null,
        contact_id: responseData.contact.id,
        company_id: responseData.contact.companyId || null,
        deal_id: selectedProposal.dealId || null,
        assigned_to: userData.id
      });

      toast.success('Task created successfully!');
      
      // Call action callback if provided
      if (onActionClick) {
        onActionClick({ 
          type: 'task_created', 
          contact: responseData.contact, 
          proposal: selectedProposal,
          taskTitle: responseData.taskTitle 
        });
      }
    } catch (error) {
      logger.error('Error creating task:', error);
      toast.error('Failed to create task. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6 shadow-xl shadow-black/20 overflow-hidden relative">
        {/* Animated background gradient */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-violet-500 to-purple-600 opacity-5"
          animate={{
            x: ['0%', '100%'],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'linear'
          }}
        />

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start gap-4 mb-6">
            <motion.div
              className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/30 relative overflow-hidden"
              animate={{ 
                scale: [1, 1.05, 1],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              {/* Shimmer effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                animate={{
                  x: ['-100%', '200%'],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'linear',
                  repeatDelay: 1
                }}
              />
              <FileText className="w-6 h-6 text-white relative z-10" />
            </motion.div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-semibold text-gray-100">
                  Select Proposal to Follow Up
                </h3>
              </div>
              <p className="text-sm text-gray-400">{data.summary}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                <Building2 className="w-3 h-3" />
                <span>{responseData.contact.name}</span>
                {responseData.contact.company && (
                  <>
                    <span>•</span>
                    <span>{responseData.contact.company}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Proposals List */}
          <div className="space-y-3 mb-5">
            <AnimatePresence>
              {responseData.proposals.map((proposal, index) => (
                <motion.button
                  key={proposal.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => handleProposalSelect(proposal.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    selectedProposalId === proposal.id
                      ? 'bg-violet-500/20 border-violet-500/50 shadow-lg shadow-violet-500/20'
                      : 'bg-gray-800/60 backdrop-blur-sm border-gray-700/50 hover:border-violet-500/30 hover:bg-gray-800/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className={`w-4 h-4 flex-shrink-0 ${
                          selectedProposalId === proposal.id ? 'text-violet-400' : 'text-gray-400'
                        }`} />
                        <span className={`font-medium text-sm ${
                          selectedProposalId === proposal.id ? 'text-violet-300' : 'text-gray-200'
                        }`}>
                          {proposal.clientName}
                        </span>
                        {selectedProposalId === proposal.id && (
                          <CheckCircle className="w-4 h-4 text-violet-400 flex-shrink-0" />
                        )}
                      </div>
                      
                      {proposal.details && (
                        <p className="text-xs text-gray-400 mb-2 line-clamp-2">{proposal.details}</p>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(proposal.date)}</span>
                        </div>
                        {proposal.amount && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            <span>{formatCurrency(proposal.amount)}</span>
                          </div>
                        )}
                        {proposal.dealName && (
                          <div className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            <span className="truncate max-w-[120px]">{proposal.dealName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <ArrowRight className={`w-4 h-4 flex-shrink-0 transition-transform ${
                      selectedProposalId === proposal.id 
                        ? 'text-violet-400 translate-x-1' 
                        : 'text-gray-500'
                    }`} />
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>

          {/* Create Task Button */}
          <motion.button
            whileHover={{ scale: isCreating ? 1 : 1.02 }}
            whileTap={{ scale: isCreating ? 1 : 0.98 }}
            onClick={handleCreateTask}
            disabled={!selectedProposalId || isCreating}
            className="w-full px-4 py-3.5 bg-gradient-to-r from-violet-500 to-purple-600 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all flex items-center justify-center gap-2 text-sm font-medium shadow-lg shadow-violet-500/20"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating Task...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                {selectedProposalId ? 'Create Follow-up Task' : 'Select a Proposal First'}
              </>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

