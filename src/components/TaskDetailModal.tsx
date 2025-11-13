import React, { useState } from 'react';
import { format, isToday, isTomorrow, isPast, isValid } from 'date-fns';
import { useNavigate } from 'react-router-dom';
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
  Target,
  ExternalLink,
  Users,
  Mail,
  Video,
  RefreshCw,
  FileText,
  Activity,
  X,
  Loader2,
  Ban,
  Zap
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
import logger from '@/lib/utils/logger';

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => Promise<void> | void;
  onStatusChange: (task: Task, status: Task['status']) => Promise<void> | void;
}

const taskTypeConfigs = {
  call: { icon: Phone, emoji: '📞', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40', label: 'Phone Call' },
  email: { icon: Mail, emoji: '✉️', color: 'bg-green-500/20 text-green-300 border-green-500/40', label: 'Email' },
  meeting: { icon: Users, emoji: '🤝', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40', label: 'Meeting' },
  follow_up: { icon: RefreshCw, emoji: '🔄', color: 'bg-orange-500/20 text-orange-300 border-orange-500/40', label: 'Follow Up' },
  demo: { icon: Video, emoji: '🎯', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40', label: 'Demo' },
  proposal: { icon: FileText, emoji: '📋', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40', label: 'Proposal' },
  general: { icon: Activity, emoji: '⚡', color: 'bg-gray-500/20 text-gray-300 border-gray-500/40', label: 'General' },
} as const;

const priorityConfigs = {
  low: { icon: '🟢', color: 'bg-green-500/20 text-green-300 border-green-500/40', label: 'Low' },
  medium: { icon: '🟡', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40', label: 'Medium' },
  high: { icon: '🟠', color: 'bg-orange-500/20 text-orange-300 border-orange-500/40', label: 'High' },
  urgent: { icon: '🔴', color: 'bg-red-500/20 text-red-300 border-red-500/40', label: 'Urgent' },
} as const;

const statusOptions: Array<{
  value: Exclude<Task['status'], 'overdue'>;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: 'pending', label: 'Pending', description: 'Waiting to get started', icon: Circle },
  { value: 'in_progress', label: 'In Progress', description: 'Actively being worked on', icon: Target },
  { value: 'completed', label: 'Completed', description: 'All wrapped up', icon: CheckCircle2 },
  { value: 'cancelled', label: 'Cancelled', description: 'No action required anymore', icon: Ban },
];

const statusDisplay = {
  pending: { label: 'Pending', badgeClass: 'bg-gray-600/30 text-gray-200 border-gray-500/40' },
  in_progress: { label: 'In Progress', badgeClass: 'bg-blue-500/20 text-blue-100 border-blue-500/40' },
  completed: { label: 'Completed', badgeClass: 'bg-emerald-500/20 text-emerald-100 border-emerald-500/40' },
  cancelled: { label: 'Cancelled', badgeClass: 'bg-rose-500/20 text-rose-100 border-rose-500/40' },
  overdue: { label: 'Overdue', badgeClass: 'bg-red-500/20 text-red-100 border-red-500/40' },
} satisfies Record<Task['status'], { label: string; badgeClass: string }>;

const formatPlaybackTimestamp = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onStatusChange
}) => {
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<Task['status'] | null>(null);

  if (!task) return null;

  const taskTypeConfig = taskTypeConfigs[task.task_type] ?? taskTypeConfigs.general;
  const priorityConfig = priorityConfigs[task.priority] ?? priorityConfigs.medium;
  const statusConfig = statusDisplay[task.status];
  const TaskTypeIcon = taskTypeConfig.icon;

  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const isOverdue = dueDate && isPast(dueDate) && !task.completed;
  const completedDate = task.completed_at ? new Date(task.completed_at) : null;

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
  const dueDateDisplay = dueDateInfo ? `${dueDateInfo.formatted}${dueDateInfo.label || ''}` : 'No due date';

  const meetingActionItem = (task as any)?.meeting_action_item;
  const meeting = meetingActionItem?.meeting;

  const handleNavigateToCompany = (event: React.MouseEvent) => {
    handleRelatedRecordClick(event, navigate, 'company', task.company_id, task.company, onClose);
  };

  const handleNavigateToContact = (event: React.MouseEvent) => {
    handleRelatedRecordClick(event, navigate, 'contact', task.contact_id, task.contact_name, onClose);
  };

  const handleNavigateToDeal = (event: React.MouseEvent) => {
    handleRelatedRecordClick(event, navigate, 'deal', task.deal_id, undefined, onClose);
  };

  const handleNavigateToMeeting = () => {
    if (meeting?.id) {
      navigate(`/meetings/${meeting.id}`);
      onClose();
    }
  };

  const handleOpenPlayback = () => {
    if (meetingActionItem?.playback_url) {
      window.open(meetingActionItem.playback_url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleStatusChange = async (nextStatus: Task['status']) => {
    if (statusUpdating) return;

    const shouldSkip =
      nextStatus === task.status &&
      (nextStatus !== 'completed' || task.completed);

    if (shouldSkip) return;

    try {
      setStatusUpdating(nextStatus);
      await onStatusChange(task, nextStatus);
    } catch (error) {
      logger.error('Error updating task status from modal:', error);
    } finally {
      setStatusUpdating(null);
    }
  };

  const handleQuickComplete = () => {
    const targetStatus: Task['status'] = task.completed ? 'pending' : 'completed';
    void handleStatusChange(targetStatus);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(task.id);
      onClose();
    } catch (error) {
      logger.error('Error deleting task:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const getAssigneeDisplay = () => {
    if (task.assignee) {
      return {
        name: `${task.assignee.first_name ?? ''} ${task.assignee.last_name ?? ''}`.trim() || task.assignee.email || 'Assigned user',
        initials: `${task.assignee.first_name?.[0] ?? ''}${task.assignee.last_name?.[0] ?? ''}` || task.assignee.email?.slice(0, 2)?.toUpperCase() || '??',
        avatar: task.assignee.avatar_url
      };
    }

    if (task.assigned_to === 'steve') {
      return { name: 'Steve', initials: 'ST', avatar: null };
    }
    if (task.assigned_to === 'phil') {
      return { name: 'Phil', initials: 'PH', avatar: null };
    }

    return { name: 'Unassigned', initials: 'NA', avatar: null };
  };

  const assigneeInfo = getAssigneeDisplay();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl glassmorphism border-gray-700/50 max-h-[90vh] overflow-y-auto px-6 py-6">
        <DialogHeader className="pb-4 border-b border-gray-700/40 mb-6 space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-2xl border ${taskTypeConfig.color}`}>
                <TaskTypeIcon className="w-7 h-7" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-semibold text-white">
                  {task.title}
                </DialogTitle>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge className={`${taskTypeConfig.color} border`}>
                    <span className="mr-1">{taskTypeConfig.emoji}</span>
                    {taskTypeConfig.label}
                  </Badge>
                  <Badge className={`${priorityConfig.color} border`}>
                    <span className="mr-1">{priorityConfig.icon}</span>
                    {priorityConfig.label} Priority
                  </Badge>
                  <Badge className={`${statusConfig.badgeClass} border`}>
                    {statusConfig.label}
                  </Badge>
                  {task.category && (
                    <Badge className="bg-purple-500/15 text-purple-200 border-purple-500/30">
                      {task.category}
                    </Badge>
                  )}
                  {isOverdue && !task.completed && (
                    <Badge className="bg-red-500/20 text-red-200 border-red-500/40">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Overdue
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end lg:self-start">
              <Button
                onClick={handleQuickComplete}
                size="sm"
                variant={task.completed ? 'outline' : 'default'}
                disabled={Boolean(statusUpdating)}
                className={`rounded-full px-4 ${
                  task.completed
                    ? 'border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/15'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {statusUpdating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Updating...
                  </>
                ) : task.completed ? (
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
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-full p-2"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <Clock className={`w-4 h-4 ${isOverdue ? 'text-red-300' : 'text-emerald-300'}`} />
              <span>{dueDateDisplay}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-purple-300" />
              <span>{assigneeInfo.name}</span>
            </div>
            {meeting && (
              <button
                onClick={handleNavigateToMeeting}
                className="flex items-center gap-2 text-emerald-300 hover:text-emerald-200 transition-colors"
              >
                <Video className="w-4 h-4" />
                <span>{meeting.title || 'Linked meeting'}</span>
              </button>
            )}
          </div>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),320px]">
          <div className="space-y-5">
            {meeting && (
              <div className="glassmorphism-light p-5 rounded-xl border border-emerald-500/20">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Video className="w-5 h-5 text-emerald-300" />
                  Meeting Context
                </h3>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="text-white font-medium">
                    {meeting.title || 'Linked meeting'}
                  </div>
                  {meeting.share_url && (
                    <a
                      href={meeting.share_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-emerald-300 hover:text-emerald-200 transition"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open shared meeting link
                    </a>
                  )}
                  {meetingActionItem?.timestamp_seconds != null && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Clock className="w-4 h-4" />
                      Jump to {formatPlaybackTimestamp(meetingActionItem.timestamp_seconds)}
                    </div>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button size="sm" variant="outline" onClick={handleNavigateToMeeting} className="border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10">
                    View meeting
                  </Button>
                  {meetingActionItem?.playback_url && (
                    <Button size="sm" variant="ghost" onClick={handleOpenPlayback} className="text-emerald-300 hover:text-emerald-200">
                      Open call recording
                    </Button>
                  )}
                </div>
              </div>
            )}

            {task.description && (
              <div className="glassmorphism-light p-5 rounded-xl border border-gray-600/40">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-300" />
                  Summary
                </h3>
                <p className="mt-3 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {task.description}
                </p>
              </div>
            )}

            {task.notes && (
              <div className="glassmorphism-light p-5 rounded-xl border border-gray-600/40">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-300" />
                  Internal Notes
                </h3>
                <p className="mt-3 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {task.notes}
                </p>
              </div>
            )}

            {(task.company || task.contact_name || task.deal_id) && (
              <div className="glassmorphism-light p-5 rounded-xl border border-gray-600/40">
                <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-300" />
                  Related records
                </h3>
                <div className="space-y-3">
                  {task.company && isRelatedRecordNavigable(task.company_id, task.company) && (
                    <div
                      onClick={handleNavigateToCompany}
                      onKeyDown={(e) => handleRelatedRecordKeyDown(e, navigate, 'company', task.company_id, task.company, onClose)}
                      className="flex items-center justify-between p-3 bg-gray-800/40 rounded-lg hover:bg-gray-700/40 cursor-pointer transition-colors group"
                      tabIndex={0}
                      role="button"
                      aria-label={`Navigate to company ${typeof task.company === 'object' ? task.company?.name : task.company}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="text-white font-medium flex items-center gap-2">
                            {typeof task.company === 'object' ? task.company?.name : task.company}
                            <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition" />
                          </div>
                          <div className="text-xs text-gray-400">Company</div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-white transition" />
                    </div>
                  )}

                  {task.company && !isRelatedRecordNavigable(task.company_id, task.company) && (
                    <div className="flex items-center gap-3 p-3 bg-gray-800/40 rounded-lg">
                      <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="text-white font-medium">
                          {typeof task.company === 'object' ? task.company?.name : task.company}
                        </div>
                        <div className="text-xs text-gray-400">Company</div>
                      </div>
                    </div>
                  )}

                  {task.contact_name && isRelatedRecordNavigable(task.contact_id, task.contact_name) && (
                    <div
                      onClick={handleNavigateToContact}
                      onKeyDown={(e) => handleRelatedRecordKeyDown(e, navigate, 'contact', task.contact_id, task.contact_name, onClose)}
                      className="flex items-center justify-between p-3 bg-gray-800/40 rounded-lg hover:bg-gray-700/40 cursor-pointer transition-colors group"
                      tabIndex={0}
                      role="button"
                      aria-label={`Navigate to contact ${task.contact_name}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                          <User className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="text-white font-medium flex items-center gap-2">
                            {task.contact_name}
                            <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition" />
                          </div>
                          <div className="text-xs text-gray-400">
                            Contact
                            {task.contact_email && <span className="ml-2 text-[11px] text-gray-500">• {task.contact_email}</span>}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-white transition" />
                    </div>
                  )}

                  {task.contact_name && !isRelatedRecordNavigable(task.contact_id, task.contact_name) && (
                    <div className="flex items-center gap-3 p-3 bg-gray-800/40 rounded-lg">
                      <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="text-white font-medium">{task.contact_name}</div>
                        <div className="text-xs text-gray-400">
                          Contact
                          {task.contact_email && <span className="ml-2 text-[11px] text-gray-500">• {task.contact_email}</span>}
                        </div>
                      </div>
                    </div>
                  )}

                  {task.deal_id && (
                    <div
                      onClick={handleNavigateToDeal}
                      onKeyDown={(e) => handleRelatedRecordKeyDown(e, navigate, 'deal', task.deal_id, undefined, onClose)}
                      className="flex items-center justify-between p-3 bg-gray-800/40 rounded-lg hover:bg-gray-700/40 cursor-pointer transition-colors group"
                      tabIndex={0}
                      role="button"
                      aria-label="Navigate to related deal"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-green-500 rounded-lg flex items-center justify-center">
                          <Zap className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="text-white font-medium flex items-center gap-2">
                            Related deal
                            <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition" />
                          </div>
                          <div className="text-xs text-gray-400">Open deal details</div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-white transition" />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="glassmorphism-light p-5 rounded-xl border border-gray-600/40">
              <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-300" />
                Task details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
                <div>
                  <span className="text-gray-400">Created</span>
                  <div className="mt-1 text-white">
                    {format(new Date(task.created_at), 'MMM dd, yyyy • h:mm a')}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Last updated</span>
                  <div className="mt-1 text-white">
                    {format(new Date(task.updated_at), 'MMM dd, yyyy • h:mm a')}
                  </div>
                </div>
                {task.completed && completedDate && (
                  <div>
                    <span className="text-gray-400">Completed</span>
                    <div className="mt-1 text-emerald-200">
                      {format(completedDate, 'MMM dd, yyyy • h:mm a')}
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-gray-400">Current status</span>
                  <div className="mt-1 text-white capitalize">
                    {task.status.replace('_', ' ')}
                  </div>
                </div>
              </div>
            </div>
        </div>

        <div className="space-y-5">
          <div className="glassmorphism-light p-5 rounded-xl border border-gray-600/40">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-300" />
              Quick status update
            </h3>
            <p className="text-xs text-gray-400 mt-2 mb-4">
              Choose the state that best reflects this task. Need deeper changes? Use the full editor below.
            </p>
            <div className="grid gap-2">
              {statusOptions.map((option) => {
                const isActive = task.status === option.value;
                const disabled = statusUpdating !== null && statusUpdating !== option.value;
                const Icon = option.icon;
                return (
                  <Button
                    key={option.value}
                    variant="outline"
                    disabled={disabled}
                    onClick={() => handleStatusChange(option.value)}
                    className={`justify-start h-auto py-3 px-3 border-gray-700/40 bg-gray-900/40 text-left transition-all duration-150 hover:border-gray-500/60 hover:bg-gray-800/50 ${
                      isActive ? 'ring-1 ring-blue-400/40 bg-blue-500/10' : ''
                    } ${disabled ? 'opacity-60 cursor-wait' : ''}`}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className={`p-2 rounded-lg ${isActive ? 'bg-blue-500/20 text-blue-200' : 'bg-gray-800/50 text-gray-300'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">{option.label}</div>
                        <div className="text-xs text-gray-400">{option.description}</div>
                      </div>
                      {statusUpdating === option.value ? (
                        <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
                      ) : isActive ? (
                        <Badge variant="outline" className="text-[10px] px-2 py-0 bg-blue-500/20 text-blue-100 border-blue-400/30">
                          Selected
                        </Badge>
                      ) : null}
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="glassmorphism-light p-5 rounded-xl border border-gray-600/40">
            <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-300" />
              Assignee
            </h3>
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12 ring-2 ring-purple-500/20">
                {assigneeInfo.avatar && <AvatarImage src={assigneeInfo.avatar} alt={assigneeInfo.name} />}
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white font-semibold">
                  {assigneeInfo.initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="text-white font-medium">{assigneeInfo.name}</div>
                <div className="text-xs text-gray-400">Task owner</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end pt-6 mt-6 border-t border-gray-700/40">
        <Button
          onClick={() => onEdit(task)}
          className="sm:flex-1 bg-blue-600 hover:bg-blue-500 text-white h-11 rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40"
        >
          <Edit3 className="w-4 h-4 mr-2" />
          Open full editor
        </Button>
        <Button
          onClick={handleDelete}
          disabled={isDeleting}
          variant="outline"
          className="sm:flex-none sm:w-[150px] border-red-500/40 text-red-300 hover:bg-red-500/10 hover:text-red-200 h-11 rounded-xl disabled:opacity-60"
        >
          {isDeleting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
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
    </DialogContent>
  </Dialog>
  );
};

export default TaskDetailModal;
