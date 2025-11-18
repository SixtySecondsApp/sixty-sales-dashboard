/**
 * Task Creation Response Component
 * Shows confirmation and creates task when contact is already selected
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Calendar, User, Building2, Mail, Sparkles, Loader2, Flag, Clock } from 'lucide-react';
import type { TaskCreationResponse as TaskCreationResponseType } from '../types';
import { useTasks } from '@/lib/hooks/useTasks';
import { useUser } from '@/lib/hooks/useUser';
import { toast } from 'sonner';
import logger from '@/lib/utils/logger';

interface TaskCreationResponseProps {
  data: TaskCreationResponseType;
  onActionClick?: (action: any) => void;
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return 'from-red-500 to-rose-600';
    case 'high':
      return 'from-amber-500 to-orange-600';
    case 'medium':
      return 'from-blue-500 to-cyan-600';
    case 'low':
      return 'from-gray-500 to-slate-600';
    default:
      return 'from-blue-500 to-cyan-600';
  }
};

const getTaskTypeIcon = (type: string) => {
  switch (type) {
    case 'call':
      return '📞';
    case 'email':
      return '📧';
    case 'meeting':
      return '📅';
    case 'follow_up':
      return '🔄';
    case 'demo':
      return '🎯';
    case 'proposal':
      return '📄';
    default:
      return '✓';
  }
};

const getTaskTypeLabel = (type: string) => {
  switch (type) {
    case 'call':
      return 'Call';
    case 'email':
      return 'Email';
    case 'meeting':
      return 'Meeting';
    case 'follow_up':
      return 'Follow-up';
    case 'demo':
      return 'Demo';
    case 'proposal':
      return 'Proposal';
    default:
      return 'General';
  }
};

export const TaskCreationResponse: React.FC<TaskCreationResponseProps> = ({ 
  data,
  onActionClick 
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const { createTask } = useTasks();
  const { userData } = useUser();
  const responseData = data.data;

  const handleCreateTask = async () => {
    setIsCreating(true);
    try {
      logger.log('Creating task:', responseData);
      
      if (!userData?.id) {
        toast.error('User authentication required. Please try again.');
        return;
      }
      
      await createTask({
        title: responseData.title,
        description: responseData.description || `Task: ${responseData.title}`,
        priority: responseData.priority,
        task_type: responseData.taskType,
        due_date: responseData.dueDate || null,
        contact_id: responseData.contact.id,
        company_id: responseData.contact.companyId || null,
        assigned_to: userData.id
      });

      toast.success('Task created successfully!');
      
      // Call action callback if provided
      if (onActionClick) {
        onActionClick({ type: 'task_created', contact: responseData.contact, taskTitle: responseData.title });
      }
    } catch (error) {
      logger.error('Error creating task:', error);
      toast.error('Failed to create task. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No due date';
    
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
          className={`absolute inset-0 bg-gradient-to-r ${getPriorityColor(responseData.priority)} opacity-5`}
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
              className={`w-14 h-14 bg-gradient-to-br ${getPriorityColor(responseData.priority)} rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 relative overflow-hidden`}
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
              <span className="text-2xl relative z-10">{getTaskTypeIcon(responseData.taskType)}</span>
            </motion.div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-semibold text-gray-100">
                  Ready to Create Task
                </h3>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-md capitalize ${
                  responseData.priority === 'urgent' 
                    ? 'bg-red-500/20 text-red-400' 
                    : responseData.priority === 'high' 
                    ? 'bg-amber-500/20 text-amber-400'
                    : responseData.priority === 'low'
                    ? 'bg-gray-500/20 text-gray-400'
                    : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {responseData.priority}
                </span>
              </div>
              <p className="text-sm text-gray-400">{data.summary}</p>
            </div>
          </div>

          {/* Task Details Card */}
          <div className="bg-gray-800/60 backdrop-blur-sm border border-gray-700/50 rounded-xl p-5 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Task Details</p>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Flag className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{responseData.title}</p>
                  <p className="text-xs text-gray-500">Task Title</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">{getTaskTypeIcon(responseData.taskType)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300">{getTaskTypeLabel(responseData.taskType)}</p>
                  <p className="text-xs text-gray-500">Task Type</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300">{formatDate(responseData.dueDate)}</p>
                  <p className="text-xs text-gray-500">Due Date</p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Details Card */}
          <div className="bg-gray-800/60 backdrop-blur-sm border border-gray-700/50 rounded-xl p-5 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Contact</p>
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
            </div>
          </div>
          
          {/* Create Button */}
          <motion.button
            whileHover={{ scale: isCreating ? 1 : 1.02 }}
            whileTap={{ scale: isCreating ? 1 : 0.98 }}
            onClick={handleCreateTask}
            disabled={isCreating}
            className={`w-full px-4 py-3.5 bg-gradient-to-r ${getPriorityColor(responseData.priority)} hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all flex items-center justify-center gap-2 text-sm font-medium shadow-lg shadow-blue-500/20`}
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating Task...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Create Task
              </>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

