import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, isTomorrow, isPast, isValid } from 'date-fns';
import {
  Plus,
  Edit3,
  Trash2,
  Check,
  Circle,
  CheckCircle2,
  Calendar,
  Clock,
  User,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Target,
  Zap,
  Flag,
  Save,
  X
} from 'lucide-react';

import { Task } from '@/lib/database/models';
import { useSubtasks } from '@/lib/hooks/useSubtasks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import logger from '@/lib/utils/logger';

interface SubtaskListProps {
  parentTaskId: string;
  parentTask: Task;
  onSubtaskChange?: () => void;
}

// Priority configurations matching the parent system
const priorityConfigs = {
  low: { icon: '🟢', color: 'bg-green-500/20 text-green-400 border-green-500/30', label: 'Low' },
  medium: { icon: '🟡', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: 'Medium' },
  high: { icon: '🟠', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', label: 'High' },
  urgent: { icon: '🔴', color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Urgent' },
};

// Task type configurations for subtasks (simplified)
const subtaskTypeConfigs = {
  call: { emoji: '📞', label: 'Call' },
  email: { emoji: '✉️', label: 'Email' },
  meeting: { emoji: '🤝', label: 'Meeting' },
  follow_up: { emoji: '🔄', label: 'Follow Up' },
  demo: { emoji: '🎯', label: 'Demo' },
  proposal: { emoji: '📋', label: 'Proposal' },
  general: { emoji: '⚡', label: 'General' },
};

const SubtaskList: React.FC<SubtaskListProps> = ({
  parentTaskId,
  parentTask,
  onSubtaskChange
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state for adding new subtasks
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskPriority, setNewSubtaskPriority] = useState<Task['priority']>('medium');
  const [newSubtaskType, setNewSubtaskType] = useState<Task['task_type']>('general');
  const [newSubtaskDueDate, setNewSubtaskDueDate] = useState('');

  // Editing state
  const [editTitle, setEditTitle] = useState('');
  const [editPriority, setEditPriority] = useState<Task['priority']>('medium');
  const [editDueDate, setEditDueDate] = useState('');

  const titleInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const {
    subtasks,
    subtaskStats,
    isLoading,
    error,
    createSubtask,
    updateSubtask,
    deleteSubtask,
    completeSubtask,
    uncompleteSubtask,
  } = useSubtasks({
    parentTaskId,
    enabled: true
  });

  // Focus the input when add form is shown
  useEffect(() => {
    if (showAddForm && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [showAddForm]);

  // Focus the edit input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingId]);

  // Handle creating new subtask
  const handleCreateSubtask = async () => {
    if (!newSubtaskTitle.trim()) {
      toast.error('Please enter a subtask title');
      return;
    }

    try {
      await createSubtask({
        title: newSubtaskTitle.trim(),
        priority: newSubtaskPriority,
        task_type: newSubtaskType,
        due_date: newSubtaskDueDate || undefined,
        assigned_to: parentTask.assigned_to, // Inherit assignee from parent
        status: 'pending',
        completed: false
      });

      // Reset form
      setNewSubtaskTitle('');
      setNewSubtaskPriority('medium');
      setNewSubtaskType('general');
      setNewSubtaskDueDate('');
      setShowAddForm(false);

      toast.success('Subtask created successfully');
      onSubtaskChange?.();
    } catch (err) {
      logger.error('Error creating subtask:', err);
      toast.error('Failed to create subtask');
    }
  };

  // Handle editing subtask
  const handleStartEdit = (subtask: Task) => {
    setEditingId(subtask.id);
    setEditTitle(subtask.title);
    setEditPriority(subtask.priority);
    setEditDueDate(subtask.due_date ? subtask.due_date.split('T')[0] : '');
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      toast.error('Please enter a subtask title');
      return;
    }

    try {
      await updateSubtask(editingId!, {
        title: editTitle.trim(),
        priority: editPriority,
        due_date: editDueDate || undefined,
      });

      setEditingId(null);
      setEditTitle('');
      setEditPriority('medium');
      setEditDueDate('');

      toast.success('Subtask updated successfully');
      onSubtaskChange?.();
    } catch (err) {
      logger.error('Error updating subtask:', err);
      toast.error('Failed to update subtask');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditPriority('medium');
    setEditDueDate('');
  };

  // Handle deleting subtask
  const handleDeleteSubtask = async (subtaskId: string) => {
    try {
      await deleteSubtask(subtaskId);
      setDeletingId(null);
      toast.success('Subtask deleted successfully');
      onSubtaskChange?.();
    } catch (err) {
      logger.error('Error deleting subtask:', err);
      toast.error('Failed to delete subtask');
    }
  };

  // Handle toggling completion
  const handleToggleComplete = async (subtask: Task) => {
    try {
      if (subtask.completed) {
        await uncompleteSubtask(subtask.id);
      } else {
        await completeSubtask(subtask.id);
      }
      onSubtaskChange?.();
    } catch (err) {
      logger.error('Error toggling subtask completion:', err);
      toast.error('Failed to update subtask status');
    }
  };

  // Format due date with smart labels
  const formatDueDate = (date: string | null | undefined) => {
    if (!date) return null;
    
    const dueDate = new Date(date);
    if (!isValid(dueDate)) return null;

    let label = format(dueDate, 'MMM d');
    if (isToday(dueDate)) label += ' (Today)';
    else if (isTomorrow(dueDate)) label += ' (Tomorrow)';
    else if (isPast(dueDate)) label += ' (Overdue)';

    return label;
  };

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
        <p className="text-red-400 text-sm">Failed to load subtasks</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-lg font-semibold text-gray-200 hover:text-white transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Subtasks
          {subtaskStats && (
            <Badge variant="outline" className="ml-2 text-xs">
              {subtaskStats.completed}/{subtaskStats.total}
            </Badge>
          )}
        </button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAddForm(true)}
          className="text-gray-400 hover:text-white hover:bg-gray-800/50"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Subtask
        </Button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Progress Bar */}
            {subtaskStats && subtaskStats.total > 0 && (
              <div className="bg-gray-900/50 border border-gray-800/50 rounded-lg p-4 mb-4 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">Progress</span>
                  <span className="text-sm font-medium text-gray-200">
                    {subtaskStats.completion_percentage}%
                  </span>
                </div>
                <Progress 
                  value={subtaskStats.completion_percentage} 
                  className="h-2"
                />
                <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                  <span>{subtaskStats.completed} completed</span>
                  <span>{subtaskStats.pending} pending</span>
                </div>
              </div>
            )}

            {/* Add Subtask Form */}
            <AnimatePresence>
              {showAddForm && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <Card className="mb-4 bg-gray-900/70 border-gray-700/50">
                    <CardContent className="p-4 space-y-3">
                      <Input
                        ref={titleInputRef}
                        placeholder="Enter subtask title..."
                        value={newSubtaskTitle}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleCreateSubtask()}
                        className="bg-gray-800/50 border-gray-600 focus:border-blue-500"
                      />
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        <Select value={newSubtaskPriority} onValueChange={(value: Task['priority']) => setNewSubtaskPriority(value)}>
                          <SelectTrigger className="w-32 bg-gray-800/50 border-gray-600">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(priorityConfigs).map(([key, config]) => (
                              <SelectItem key={key} value={key}>
                                <span className="flex items-center gap-2">
                                  <span>{config.icon}</span>
                                  {config.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select value={newSubtaskType} onValueChange={(value: Task['task_type']) => setNewSubtaskType(value)}>
                          <SelectTrigger className="w-32 bg-gray-800/50 border-gray-600">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(subtaskTypeConfigs).map(([key, config]) => (
                              <SelectItem key={key} value={key}>
                                <span className="flex items-center gap-2">
                                  <span>{config.emoji}</span>
                                  {config.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Input
                          type="date"
                          value={newSubtaskDueDate}
                          onChange={(e) => setNewSubtaskDueDate(e.target.value)}
                          className="w-40 bg-gray-800/50 border-gray-600 focus:border-blue-500"
                        />
                      </div>

                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowAddForm(false)}
                          className="text-gray-400 hover:text-white"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleCreateSubtask}
                          disabled={!newSubtaskTitle.trim()}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Add Subtask
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Subtasks List */}
            {isLoading && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-gray-900/50 border border-gray-800/50 rounded-lg p-3 animate-pulse"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-gray-700 rounded-full" />
                      <div className="w-48 h-4 bg-gray-700 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && subtasks.length === 0 && !showAddForm && (
              <div className="text-center py-8 text-gray-500">
                <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No subtasks yet</p>
                <p className="text-xs text-gray-600 mt-1">
                  Click "Add Subtask" to break down this task into smaller steps
                </p>
              </div>
            )}

            {!isLoading && subtasks.length > 0 && (
              <div className="space-y-2">
                <AnimatePresence>
                  {subtasks.map((subtask) => (
                    <motion.div
                      key={subtask.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card className={`
                        bg-gray-900/30 border-gray-800/30 hover:bg-gray-900/50 transition-all duration-200
                        ${subtask.completed ? 'opacity-60' : ''}
                        ${editingId === subtask.id ? 'ring-2 ring-blue-500/50' : ''}
                      `}>
                        <CardContent className="p-3">
                          {editingId === subtask.id ? (
                            // Edit mode
                            <div className="space-y-3">
                              <Input
                                ref={editInputRef}
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit()}
                                className="bg-gray-800/50 border-gray-600 focus:border-blue-500"
                              />
                              
                              <div className="flex items-center gap-2 flex-wrap">
                                <Select value={editPriority} onValueChange={(value: Task['priority']) => setEditPriority(value)}>
                                  <SelectTrigger className="w-32 bg-gray-800/50 border-gray-600">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(priorityConfigs).map(([key, config]) => (
                                      <SelectItem key={key} value={key}>
                                        <span className="flex items-center gap-2">
                                          <span>{config.icon}</span>
                                          {config.label}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                <Input
                                  type="date"
                                  value={editDueDate}
                                  onChange={(e) => setEditDueDate(e.target.value)}
                                  className="w-40 bg-gray-800/50 border-gray-600 focus:border-blue-500"
                                />
                              </div>

                              <div className="flex items-center gap-2 justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleCancelEdit}
                                  className="text-gray-400 hover:text-white"
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={handleSaveEdit}
                                  disabled={!editTitle.trim()}
                                  className="bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                  <Save className="h-4 w-4 mr-1" />
                                  Save
                                </Button>
                              </div>
                            </div>
                          ) : (
                            // View mode
                            <div className="flex items-center gap-3">
                              {/* Completion Toggle */}
                              <button
                                onClick={() => handleToggleComplete(subtask)}
                                className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
                              >
                                {subtask.completed ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Circle className="h-4 w-4" />
                                )}
                              </button>

                              {/* Subtask Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`
                                    font-medium text-sm
                                    ${subtask.completed ? 'line-through text-gray-500' : 'text-gray-200'}
                                  `}>
                                    {subtask.title}
                                  </span>
                                  
                                  {/* Task Type */}
                                  {subtask.task_type !== 'general' && (
                                    <span className="text-xs">
                                      {subtaskTypeConfigs[subtask.task_type]?.emoji}
                                    </span>
                                  )}
                                </div>

                                {/* Metadata Row */}
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                  {/* Priority */}
                                  <Badge 
                                    variant="outline" 
                                    className={`${priorityConfigs[subtask.priority]?.color} px-1.5 py-0.5`}
                                  >
                                    <span className="mr-1">{priorityConfigs[subtask.priority]?.icon}</span>
                                    {priorityConfigs[subtask.priority]?.label}
                                  </Badge>

                                  {/* Due Date */}
                                  {subtask.due_date && (
                                    <div className={`
                                      flex items-center gap-1
                                      ${isPast(new Date(subtask.due_date)) && !subtask.completed 
                                        ? 'text-red-400' 
                                        : 'text-gray-400'
                                      }
                                    `}>
                                      <Calendar className="h-3 w-3" />
                                      <span>{formatDueDate(subtask.due_date)}</span>
                                    </div>
                                  )}

                                  {/* Assignee (if different from parent) */}
                                  {subtask.assigned_to !== parentTask.assigned_to && (
                                    <div className="flex items-center gap-1 text-gray-400">
                                      <User className="h-3 w-3" />
                                      <Avatar className="h-4 w-4">
                                        <AvatarFallback className="text-xs">
                                          {subtask.assignee?.full_name?.[0] || '?'}
                                        </AvatarFallback>
                                      </Avatar>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleStartEdit(subtask)}
                                  className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-700"
                                >
                                  <Edit3 className="h-3 w-3" />
                                </Button>

                                {deletingId === subtask.id ? (
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteSubtask(subtask.id)}
                                      className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                                    >
                                      <Check className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setDeletingId(null)}
                                      className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-700"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeletingId(subtask.id)}
                                    className="h-8 w-8 p-0 text-gray-400 hover:text-red-400 hover:bg-red-500/20"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SubtaskList;