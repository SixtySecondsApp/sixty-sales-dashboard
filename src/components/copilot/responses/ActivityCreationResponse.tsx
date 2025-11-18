/**
 * Activity Creation Response Component
 * Shows confirmation and creates activity when contact is already selected
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Calendar, User, Building2, Mail, Sparkles, Loader2 } from 'lucide-react';
import type { ActivityCreationResponse as ActivityCreationResponseType } from '../types';
import { useActivities } from '@/lib/hooks/useActivities';
import { toast } from 'sonner';
import logger from '@/lib/utils/logger';

interface ActivityCreationResponseProps {
  data: ActivityCreationResponseType;
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
    default:
      return 'from-emerald-500 to-teal-600';
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
    default:
      return '📋';
  }
};

export const ActivityCreationResponse: React.FC<ActivityCreationResponseProps> = ({ 
  data,
  onActionClick 
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const { addActivityAsync } = useActivities();
  const responseData = data.data;

  const handleCreateActivity = async () => {
    setIsCreating(true);
    try {
      logger.log('Creating activity:', responseData);
      
      await addActivityAsync({
        type: responseData.activityType as 'proposal' | 'meeting' | 'sale' | 'outbound',
        client_name: responseData.contact.name,
        details: `${responseData.activityType.charAt(0).toUpperCase() + responseData.activityType.slice(1)} created via Copilot`,
        date: responseData.activityDate,
        contactIdentifier: responseData.contact.email || null,
        contactIdentifierType: responseData.contact.email ? 'email' : 'unknown',
        status: 'completed'
      });

      toast.success(`${responseData.activityType.charAt(0).toUpperCase() + responseData.activityType.slice(1)} created successfully!`);
      
      // Call action callback if provided
      if (onActionClick) {
        onActionClick({ type: 'activity_created', contact: responseData.contact, activityType: responseData.activityType });
      }
    } catch (error) {
      logger.error('Error creating activity:', error);
      toast.error(`Failed to create ${responseData.activityType}. Please try again.`);
    } finally {
      setIsCreating(false);
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
      day: 'numeric',
      year: 'numeric'
    });
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
          <div className="flex items-start gap-4 mb-6">
            <motion.div
              className={`w-14 h-14 bg-gradient-to-br ${getActivityTypeColor(responseData.activityType)} rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30 relative overflow-hidden`}
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
                  Ready to Create {responseData.activityType.charAt(0).toUpperCase() + responseData.activityType.slice(1)}
                </h3>
                <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded-md">
                  {formatDate(responseData.activityDate)}
                </span>
              </div>
              <p className="text-sm text-gray-400">{data.summary}</p>
            </div>
          </div>

          {/* Contact Details Card */}
          <div className="bg-gray-800/60 backdrop-blur-sm border border-gray-700/50 rounded-xl p-5 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Contact Details</p>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{responseData.contact.name}</p>
                  <p className="text-xs text-gray-500">Contact Name</p>
                </div>
              </div>
              
              {responseData.contact.email && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300 truncate">{responseData.contact.email}</p>
                    <p className="text-xs text-gray-500">Email Address</p>
                  </div>
                </div>
              )}
              
              {responseData.contact.company && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300 truncate">{responseData.contact.company}</p>
                    <p className="text-xs text-gray-500">Company</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300">{formatDate(responseData.activityDate)}</p>
                  <p className="text-xs text-gray-500">Activity Date</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Create Button */}
          <motion.button
            whileHover={{ scale: isCreating ? 1 : 1.02 }}
            whileTap={{ scale: isCreating ? 1 : 0.98 }}
            onClick={handleCreateActivity}
            disabled={isCreating}
            className={`w-full px-4 py-3.5 bg-gradient-to-r ${getActivityTypeColor(responseData.activityType)} hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all flex items-center justify-center gap-2 text-sm font-medium shadow-lg shadow-emerald-500/20`}
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating {responseData.activityType.charAt(0).toUpperCase() + responseData.activityType.slice(1)}...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Create {responseData.activityType.charAt(0).toUpperCase() + responseData.activityType.slice(1)}
              </>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

