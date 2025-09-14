import React, { useState } from 'react';
import { format, isToday, isTomorrow, isPast, isValid } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  User,
  Building2,
  Phone,
  CheckCircle2,
  Circle,
  Edit3,
  Trash2,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Star,
  Zap,
  Target,
  ExternalLink,
  Users,
  Mail,
  Video,
  RefreshCw,
  FileText,
  Activity,
  X
} from 'lucide-react';

import { Task } from '@/lib/database/models';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { handleRelatedRecordClick, handleRelatedRecordKeyDown, isRelatedRecordNavigable } from '@/lib/utils/navigationUtils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import logger from '@/lib/utils/logger';

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onToggleComplete: (task: Task) => void;
}

// Task type configurations with icons and colors (matching TaskForm)
const taskTypeConfigs = {
  call: { icon: Phone, emoji: '📞', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'Phone Call' },
  email: { icon: Mail, emoji: '✉️', color: 'bg-green-500/20 text-green-400 border-green-500/30', label: 'Email' },
  meeting: { icon: Users, emoji: '🤝', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', label: 'Meeting' },
  follow_up: { icon: RefreshCw, emoji: '🔄', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', label: 'Follow Up' },
  demo: { icon: Video, emoji: '🎯', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30', label: 'Demo' },
  proposal: { icon: FileText, emoji: '📋', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: 'Proposal' },
  general: { icon: Activity, emoji: '⚡', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', label: 'General' },
};

// Priority configurations (matching TaskForm)
const priorityConfigs = {
  low: { icon: '🟢', color: 'bg-green-500/20 text-green-400 border-green-500/30', label: 'Low' },
  medium: { icon: '🟡', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: 'Medium' },
  high: { icon: '🟠', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', label: 'High' },
  urgent: { icon: '🔴', color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Urgent' },
};

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onToggleComplete
}) => {
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);

  if (!task) return null;

  const taskTypeConfig = taskTypeConfigs[task.task_type];
  const priorityConfig = priorityConfigs[task.priority];
  const TaskTypeIcon = taskTypeConfig?.icon || Activity;

  // Date parsing and formatting
  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const isOverdue = dueDate && isPast(dueDate) && !task.completed;
  const completedDate = task.completed_at ? new Date(task.completed_at) : null;

  // Format due date with smart labels
  const formatDueDate = (date: Date | null) => {
    if (!date || !isValid(date)) return null;

    let label = '';
    if (isToday(date)) label = ' (Today)';
    else if (isTomorrow(date)) label = ' (Tomorrow)';
    else if (isPast(date)) label = ' (Overdue)';

    return {
      formatted: format(date, 'MMM dd, yyyy \'at\' h:mm a'),
      label,
      isOverdue: isPast(date)
    };
  };

  const dueDateInfo = formatDueDate(dueDate);

  // Handle navigation to related records using utility functions
  const handleNavigateToCompany = (event: React.MouseEvent) => {
    handleRelatedRecordClick(event, navigate, 'company', task.company_id, task.company, onClose);
  };

  const handleNavigateToContact = (event: React.MouseEvent) => {
    handleRelatedRecordClick(event, navigate, 'contact', task.contact_id, task.contact_name, onClose);
  };

  const handleNavigateToDeal = (event: React.MouseEvent) => {
    handleRelatedRecordClick(event, navigate, 'deal', task.deal_id, undefined, onClose);
  };

  // Handle task completion toggle
  const handleToggleComplete = async () => {
    try {
      onToggleComplete(task);
      toast.success(task.completed ? 'Task marked as incomplete' : 'Task completed!');
    } catch (error) {
      logger.error('Error toggling task completion:', error);
      toast.error('Failed to update task status');
    }
  };

  // Handle task deletion
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      onDelete(task.id);
      toast.success('Task deleted successfully');
      onClose();
    } catch (error) {
      logger.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    } finally {
      setIsDeleting(false);
    }
  };

  // Generate assignee display
  const getAssigneeDisplay = () => {
    if (task.assignee) {
      return {
        name: `${task.assignee.first_name} ${task.assignee.last_name}`,
        initials: `${task.assignee.first_name?.[0] || ''}${task.assignee.last_name?.[0] || ''}`,
        avatar: task.assignee.avatar_url
      };
    }
    
    // Handle special cases
    if (task.assigned_to === 'steve') {
      return { name: 'Steve', initials: 'ST', avatar: null };
    }
    if (task.assigned_to === 'phil') {
      return { name: 'Phil', initials: 'PH', avatar: null };
    }
    
    return { name: 'Unknown User', initials: '??', avatar: null };
  };

  const assigneeInfo = getAssigneeDisplay();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl glassmorphism border-gray-700/50 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-6">
          <DialogTitle className="text-2xl font-bold text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${taskTypeConfig?.color || 'bg-gray-500/20 text-gray-400'}`}>
                <TaskTypeIcon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-white">{task.title}</span>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleToggleComplete}
                      className={`p-2 rounded-full transition-colors ${
                        task.completed 
                          ? 'text-green-400 hover:text-green-300 hover:bg-green-500/10' 
                          : 'text-gray-400 hover:text-green-400 hover:bg-green-500/10'
                      }`}
                    >
                      <AnimatePresence mode="wait">
                        {task.completed ? (
                          <motion.div
                            key="completed"
                            initial={{ scale: 0, rotate: -90 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0, rotate: 90 }}
                            transition={{ duration: 0.2 }}
                          >
                            <CheckCircle2 className="w-6 h-6" />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="incomplete"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <Circle className="w-6 h-6" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Button>
                  </motion.div>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <Badge className={taskTypeConfig?.color || 'bg-gray-500/20 text-gray-400'}>
                    <span className="mr-1">{taskTypeConfig?.emoji}</span>
                    {taskTypeConfig?.label || 'General'}
                  </Badge>
                  <Badge className={priorityConfig?.color || 'bg-gray-500/20 text-gray-400'}>
                    <span className="mr-1">{priorityConfig?.icon}</span>
                    {priorityConfig?.label || 'Medium'} Priority
                  </Badge>
                  {task.completed && (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Completed
                    </Badge>
                  )}
                  {isOverdue && !task.completed && (
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Overdue
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-full p-2"
            >
              <X className="w-5 h-5" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Task Description */}
          {task.description && (
            <div className="glassmorphism-light p-4 rounded-xl border border-gray-600/30">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                Description
              </h3>
              <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                {task.description}
              </p>
            </div>
          )}

          {/* Task Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Due Date */}
            {dueDateInfo && (
              <div className="glassmorphism-light p-4 rounded-xl border border-gray-600/30">
                <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                  <Clock className={`w-5 h-5 ${isOverdue ? 'text-red-400' : 'text-green-400'}`} />
                  Due Date
                </h3>
                <div className="space-y-2">
                  <div className={`text-lg font-medium ${isOverdue ? 'text-red-400' : 'text-green-400'}`}>
                    {dueDateInfo.formatted}
                    {dueDateInfo.label && (
                      <span className={`ml-2 text-sm ${dueDateInfo.isOverdue ? 'text-red-300' : 'text-gray-400'}`}>
                        {dueDateInfo.label}
                      </span>
                    )}
                  </div>
                  {isOverdue && !task.completed && (
                    <div className="flex items-center gap-2 text-red-400 text-sm">
                      <AlertTriangle className="w-4 h-4" />
                      This task is overdue
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Assignee */}
            <div className="glassmorphism-light p-4 rounded-xl border border-gray-600/30">
              <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                <User className="w-5 h-5 text-purple-400" />
                Assignee
              </h3>
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  {assigneeInfo.avatar && <AvatarImage src={assigneeInfo.avatar} alt={assigneeInfo.name} />}
                  <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white font-semibold">
                    {assigneeInfo.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-white font-medium">{assigneeInfo.name}</div>
                  <div className="text-sm text-gray-400">Assigned to task</div>
                </div>
              </div>
            </div>
          </div>

          {/* Related Records */}
          {(task.company || task.contact_name || task.deal_id) && (
            <div className="glassmorphism-light p-4 rounded-xl border border-gray-600/30">
              <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-400" />
                Related Records
              </h3>
              <div className="space-y-3">
                {/* Company */}
                {task.company && isRelatedRecordNavigable(task.company_id, task.company) && (
                  <div 
                    onClick={handleNavigateToCompany}
                    onKeyDown={(e) => handleRelatedRecordKeyDown(e, navigate, 'company', task.company_id, task.company, onClose)}
                    className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-700/50 cursor-pointer transition-colors group focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    tabIndex={0}
                    role="button"
                    aria-label={`Navigate to company ${task.company}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="text-white font-medium flex items-center gap-2">
                          {task.company}
                          <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-sm text-gray-400">Company</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                  </div>
                )}
                
                {/* Company - Non-clickable fallback */}
                {task.company && !isRelatedRecordNavigable(task.company_id, task.company) && (
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="text-white font-medium">{task.company}</div>
                        <div className="text-sm text-gray-400">Company</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Contact */}
                {task.contact_name && isRelatedRecordNavigable(task.contact_id, task.contact_name) && (
                  <div 
                    onClick={handleNavigateToContact}
                    onKeyDown={(e) => handleRelatedRecordKeyDown(e, navigate, 'contact', task.contact_id, task.contact_name, onClose)}
                    className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-700/50 cursor-pointer transition-colors group focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    tabIndex={0}
                    role="button"
                    aria-label={`Navigate to contact ${task.contact_name}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="text-white font-medium flex items-center gap-2">
                          {task.contact_name}
                          <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-sm text-gray-400">
                          Contact
                          {task.contact_email && (
                            <span className="ml-2 text-xs text-gray-500">• {task.contact_email}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                  </div>
                )}
                
                {/* Contact - Non-clickable fallback */}
                {task.contact_name && !isRelatedRecordNavigable(task.contact_id, task.contact_name) && (
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="text-white font-medium">{task.contact_name}</div>
                        <div className="text-sm text-gray-400">
                          Contact
                          {task.contact_email && (
                            <span className="ml-2 text-xs text-gray-500">• {task.contact_email}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Deal */}
                {task.deal_id && (
                  <div 
                    onClick={handleNavigateToDeal}
                    onKeyDown={(e) => handleRelatedRecordKeyDown(e, navigate, 'deal', task.deal_id, undefined, onClose)}
                    className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-700/50 cursor-pointer transition-colors group focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    tabIndex={0}
                    role="button"
                    aria-label="Navigate to related deal"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                        <Zap className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="text-white font-medium flex items-center gap-2">
                          Related Deal
                          <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-sm text-gray-400">View deal details</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Subtasks Section - Placeholder */}
          <div className="glassmorphism-light p-4 rounded-xl border border-gray-600/30">
            <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" />
              Subtasks
              <Badge variant="outline" className="ml-2 text-xs bg-indigo-500/20 text-indigo-400 border-indigo-500/30">
                Coming Soon
              </Badge>
            </h3>
            <div className="text-gray-400 text-sm flex items-center gap-2">
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>
              Subtask functionality will be available in a future update
            </div>
          </div>

          {/* Task Metadata */}
          <div className="glassmorphism-light p-4 rounded-xl border border-gray-600/30">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              Task Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Created:</span>
                <span className="text-white ml-2">
                  {format(new Date(task.created_at), 'MMM dd, yyyy \'at\' h:mm a')}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Last Updated:</span>
                <span className="text-white ml-2">
                  {format(new Date(task.updated_at), 'MMM dd, yyyy \'at\' h:mm a')}
                </span>
              </div>
              {task.completed && completedDate && (
                <div>
                  <span className="text-gray-400">Completed:</span>
                  <span className="text-green-400 ml-2">
                    {format(completedDate, 'MMM dd, yyyy \'at\' h:mm a')}
                  </span>
                </div>
              )}
              <div>
                <span className="text-gray-400">Status:</span>
                <span className="text-white ml-2 capitalize">{task.status}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-700/50">
            <Button
              onClick={() => onEdit(task)}
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white h-12 rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-300"
            >
              <Edit3 className="w-4 h-4 mr-2" />
              Edit Task
            </Button>
            
            <Button
              onClick={handleToggleComplete}
              variant="outline"
              className="flex-1 border-gray-600/50 text-gray-300 hover:bg-gray-700/70 hover:text-white h-12 rounded-xl"
            >
              {task.completed ? (
                <>
                  <Circle className="w-4 h-4 mr-2" />
                  Mark Incomplete
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark Complete
                </>
              )}
            </Button>
            
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              variant="outline"
              className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500/70 hover:text-red-300 h-12 px-6 rounded-xl transition-all duration-300 disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskDetailModal;