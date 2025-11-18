/**
 * Contact Selection Response Component
 * Shows contact search modal when contact needs to be selected for activity creation
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Search, Mail, Building2, Sparkles, ArrowRight } from 'lucide-react';
import { ContactSearchModal } from '@/components/ContactSearchModal';
import type { ContactSelectionResponse as ContactSelectionResponseType } from '../types';
import { useActivities } from '@/lib/hooks/useActivities';
import { useTasks } from '@/lib/hooks/useTasks';
import { useUser } from '@/lib/hooks/useUser';
import { toast } from 'sonner';
import logger from '@/lib/utils/logger';

interface ContactSelectionResponseProps {
  data: ContactSelectionResponseType;
  onActionClick?: (action: any) => void;
}

const getActivityTypeColor = (type: string) => {
  switch (type) {
    case 'proposal':
      return 'from-violet-500 to-purple-600';
    case 'meeting':
      return 'from-blue-500 to-cyan-600';
    case 'sale':
      return 'from-emerald-500 to-teal-600';
    case 'outbound':
      return 'from-amber-500 to-orange-600';
    case 'task':
      return 'from-blue-500 to-cyan-600';
    default:
      return 'from-violet-500 to-purple-600';
  }
};

const getActivityTypeIcon = (type: string) => {
  switch (type) {
    case 'proposal':
      return '📄';
    case 'meeting':
      return '📅';
    case 'sale':
      return '💰';
    case 'outbound':
      return '📧';
    case 'task':
      return '✓';
    default:
      return '📋';
  }
};

export const ContactSelectionResponse: React.FC<ContactSelectionResponseProps> = ({ 
  data,
  onActionClick 
}) => {
  const [showContactSearch, setShowContactSearch] = useState(false);
  const { addActivityAsync } = useActivities();
  const { createTask } = useTasks();
  const { userData } = useUser();
  const responseData = data.data;

  // Auto-open contact search modal when component mounts
  useEffect(() => {
    if (responseData.requiresContactSelection) {
      setShowContactSearch(true);
    }
  }, [responseData.requiresContactSelection]);

  const handleContactSelect = async (contact: any) => {
    try {
      logger.log('Contact selected for creation:', contact);
      
      // Handle task creation differently from activities
      if (responseData.activityType === 'task') {
        if (!userData?.id) {
          toast.error('User authentication required. Please try again.');
          return;
        }
        
        await createTask({
          title: responseData.taskTitle || `Follow up with ${contact.full_name || contact.first_name || contact.email || 'contact'}`,
          description: `Task created via Copilot: ${responseData.taskTitle || 'Follow-up task'}`,
          priority: responseData.priority || 'medium',
          task_type: responseData.taskType || 'follow_up',
          due_date: responseData.activityDate,
          contact_id: contact.id,
          company_id: contact.company_id || null,
          assigned_to: userData.id
        });

        toast.success('Task created successfully!');
        setShowContactSearch(false);
        
        if (onActionClick) {
          onActionClick({ type: 'task_created', contact, taskTitle: responseData.taskTitle });
        }
      } else {
        // Create the activity
        await addActivityAsync({
          type: responseData.activityType as 'proposal' | 'meeting' | 'sale' | 'outbound',
          client_name: contact.full_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.email || 'Unknown',
          details: `${responseData.activityType.charAt(0).toUpperCase() + responseData.activityType.slice(1)} created via Copilot`,
          date: responseData.activityDate,
          contactIdentifier: contact.email || null,
          contactIdentifierType: contact.email ? 'email' : 'unknown',
          status: 'completed'
        });

        toast.success(`${responseData.activityType.charAt(0).toUpperCase() + responseData.activityType.slice(1)} created successfully!`);
        setShowContactSearch(false);
        
        // Call action callback if provided
        if (onActionClick) {
          onActionClick({ type: 'activity_created', contact, activityType: responseData.activityType });
        }
      }
    } catch (error) {
      logger.error('Error creating item:', error);
      const itemType = responseData.activityType === 'task' ? 'task' : responseData.activityType;
      toast.error(`Failed to create ${itemType}. Please try again.`);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    if (isToday) return 'Today';
    
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric'
    });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-4"
      >
        <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6 shadow-xl shadow-black/20 overflow-hidden relative">
          {/* Animated background gradient */}
          <motion.div
            className={`absolute inset-0 bg-gradient-to-r ${getActivityTypeColor(responseData.activityType)} opacity-5`}
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
            <div className="flex items-start gap-4 mb-5">
              <motion.div
                className={`w-14 h-14 bg-gradient-to-br ${getActivityTypeColor(responseData.activityType)} rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/30 relative overflow-hidden`}
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
                <span className="text-2xl relative z-10">{getActivityTypeIcon(responseData.activityType)}</span>
              </motion.div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-semibold text-gray-100">
                    {responseData.activityType === 'task' 
                      ? 'Create Task'
                      : `Create ${responseData.activityType.charAt(0).toUpperCase() + responseData.activityType.slice(1)}`}
                  </h3>
                  <span className="px-2 py-0.5 text-xs font-medium bg-violet-500/20 text-violet-400 rounded-md">
                    {formatDate(responseData.activityDate)}
                  </span>
                </div>
                <p className="text-sm text-gray-400">{data.summary}</p>
                {responseData.activityType === 'task' && responseData.taskTitle && (
                  <p className="text-xs text-gray-500 mt-1">Task: {responseData.taskTitle}</p>
                )}
              </div>
            </div>

            {/* Suggested Contacts */}
            {responseData.suggestedContacts && responseData.suggestedContacts.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                    Suggested Contacts ({responseData.suggestedContacts.length})
                  </p>
                </div>
                <div className="space-y-2">
                  <AnimatePresence>
                    {responseData.suggestedContacts.map((contact, index) => (
                      <motion.button
                        key={contact.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        onClick={() => handleContactSelect(contact)}
                        className="w-full text-left p-4 rounded-xl bg-gray-800/60 backdrop-blur-sm border border-gray-700/50 hover:border-violet-500/50 hover:bg-gray-800/80 transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Users className="w-4 h-4 text-violet-400 flex-shrink-0" />
                              <span className="font-medium text-sm text-gray-200 group-hover:text-violet-400 transition-colors truncate">
                                {contact.name}
                              </span>
                            </div>
                            {contact.email && (
                              <div className="flex items-center gap-2 text-xs text-gray-400 ml-6">
                                <Mail className="w-3 h-3" />
                                <span className="truncate">{contact.email}</span>
                              </div>
                            )}
                            {contact.company && (
                              <div className="flex items-center gap-2 text-xs text-gray-500 ml-6 mt-1">
                                <Building2 className="w-3 h-3" />
                                <span className="truncate">{contact.company}</span>
                              </div>
                            )}
                          </div>
                          <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-violet-400 group-hover:translate-x-1 transition-all flex-shrink-0 ml-2" />
                        </div>
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Search Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowContactSearch(true)}
              className={`w-full px-4 py-3 bg-gradient-to-r ${getActivityTypeColor(responseData.activityType)} hover:opacity-90 text-white rounded-xl transition-all flex items-center justify-center gap-2 text-sm font-medium shadow-lg shadow-violet-500/20`}
            >
              <Search className="w-4 h-4" />
              {responseData.suggestedContacts && responseData.suggestedContacts.length > 0 
                ? 'Search for Different Contact' 
                : 'Search Contacts'}
            </motion.button>
          </div>
        </div>
      </motion.div>

      <ContactSearchModal
        isOpen={showContactSearch}
        onClose={() => setShowContactSearch(false)}
        onContactSelect={handleContactSelect}
        prefilledName={responseData.prefilledName}
        prefilledEmail={responseData.prefilledEmail}
      />
    </>
  );
};

