import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow, isAfter, isBefore, isToday } from 'date-fns';
import {
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Calendar,
  User,
  Tag,
  MoreVertical,
  Edit2,
  Trash2,
  X,
  Save,
  ArrowUp,
  ArrowDown,
  Minus,
  Flag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTasks, CreateTaskData, UpdateTaskData } from '@/lib/hooks/useTasks';
import { useUser } from '@/lib/hooks/useUser';
import { Task } from '@/lib/database/models';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CompanyTasksProps {
  companyId: string;
  companyName: string;
  className?: string;
}

type TaskStatusFilter = 'all' | 'pending' | 'in_progress' | 'completed';
type TaskPriorityFilter = 'all' | 'low' | 'medium' | 'high' | 'urgent';
type TaskSortBy = 'due_date' | 'priority' | 'created_at' | 'status';

export function CompanyTasks({ companyId, companyName, className }: CompanyTasksProps) {
  const { userData } = useUser();
  const {
    tasks,
    isLoading,
    createCompanyTask,
    getTasksByCompany,
    getCompanyTaskStats,
    updateTask,
    deleteTask,
    completeTask,
    uncompleteTask
  } = useTasks();

  // Local state
  const [companyTasks, setCompanyTasks] = useState<Task[]>([]);
  const [taskStats, setTaskStats] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriorityFilter>('all');
  const [sortBy, setSortBy] = useState<TaskSortBy>('due_date');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Form state
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    notes: '',
    due_date: '',
    priority: 'medium' as Task['priority'],
    task_type: 'call' as Task['task_type'],
    assigned_to: userData?.id || ''
  });

  // Fetch company tasks and stats
  const fetchCompanyData = async () => {
    try {
      const [tasksData, statsData] = await Promise.all([
        getTasksByCompany(companyId),
        getCompanyTaskStats(companyId)
      ]);
      
      setCompanyTasks(tasksData);
      setTaskStats(statsData);
    } catch (error) {
      console.error('Error fetching company tasks:', error);
    }
  };

  useEffect(() => {
    if (companyId) {
      fetchCompanyData();
    }
  }, [companyId]);

  // Reset form
  const resetForm = () => {
    setTaskForm({
      title: '',
      description: '',
      notes: '',
      due_date: '',
      priority: 'medium',
      task_type: 'call',
      assigned_to: userData?.id || ''
    });
  };

  // Handle create task
  const handleCreateTask = async () => {
    if (!taskForm.title.trim()) return;

    const taskData: Omit<CreateTaskData, 'company_id' | 'company'> = {
      title: taskForm.title.trim(),
      description: taskForm.description.trim() || undefined,
      notes: taskForm.notes.trim() || undefined,
      due_date: taskForm.due_date || undefined,
      priority: taskForm.priority,
      task_type: taskForm.task_type,
      assigned_to: taskForm.assigned_to
    };

    try {
      await createCompanyTask(companyId, companyName, taskData);
      resetForm();
      setShowCreateModal(false);
      await fetchCompanyData(); // Refresh data
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  // Handle update task
  const handleUpdateTask = async () => {
    if (!editingTask || !taskForm.title.trim()) return;

    const updateData: UpdateTaskData = {
      title: taskForm.title.trim(),
      description: taskForm.description.trim() || undefined,
      notes: taskForm.notes.trim() || undefined,
      due_date: taskForm.due_date || undefined,
      priority: taskForm.priority,
      task_type: taskForm.task_type,
      assigned_to: taskForm.assigned_to
    };

    try {
      await updateTask(editingTask.id, updateData);
      setEditingTask(null);
      resetForm();
      await fetchCompanyData(); // Refresh data
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  // Handle delete task
  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      setShowDeleteConfirm(null);
      await fetchCompanyData(); // Refresh data
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  // Toggle task completion
  const handleToggleComplete = async (task: Task) => {
    try {
      if (task.completed) {
        await uncompleteTask(task.id);
      } else {
        await completeTask(task.id);
      }
      await fetchCompanyData(); // Refresh data
    } catch (error) {
      console.error('Error toggling task completion:', error);
    }
  };

  // Start editing a task
  const startEditing = (task: Task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      notes: task.notes || '',
      due_date: task.due_date ? format(new Date(task.due_date), 'yyyy-MM-dd') : '',
      priority: task.priority,
      task_type: task.task_type,
      assigned_to: task.assigned_to
    });
  };

  // Filter and sort tasks
  const filteredAndSortedTasks = React.useMemo(() => {
    let filtered = companyTasks;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query) ||
        task.notes?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(task => task.status === statusFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(task => task.priority === priorityFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'due_date':
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        case 'priority':
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        case 'created_at':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'status':
          const statusOrder = { pending: 1, in_progress: 2, completed: 3 };
          return statusOrder[a.status] - statusOrder[b.status];
        default:
          return 0;
      }
    });

    return filtered;
  }, [companyTasks, searchQuery, statusFilter, priorityFilter, sortBy]);

  // Get priority icon and color
  const getPriorityDisplay = (priority: Task['priority']) => {
    switch (priority) {
      case 'urgent':
        return { icon: Flag, color: 'text-red-400', bgColor: 'bg-red-500/10 border-red-500/30' };
      case 'high':
        return { icon: ArrowUp, color: 'text-orange-400', bgColor: 'bg-orange-500/10 border-orange-500/30' };
      case 'medium':
        return { icon: Minus, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10 border-yellow-500/30' };
      case 'low':
        return { icon: ArrowDown, color: 'text-green-400', bgColor: 'bg-green-500/10 border-green-500/30' };
      default:
        return { icon: Minus, color: 'text-gray-400', bgColor: 'bg-gray-500/10 border-gray-500/30' };
    }
  };

  // Get status display
  const getStatusDisplay = (status: Task['status']) => {
    switch (status) {
      case 'pending':
        return { text: 'Pending', color: 'text-gray-400', bgColor: 'bg-gray-500/10' };
      case 'in_progress':
        return { text: 'In Progress', color: 'text-blue-400', bgColor: 'bg-blue-500/10' };
      case 'completed':
        return { text: 'Completed', color: 'text-green-400', bgColor: 'bg-green-500/10' };
      default:
        return { text: status, color: 'text-gray-400', bgColor: 'bg-gray-500/10' };
    }
  };

  // Check if task is overdue
  const isOverdue = (task: Task) => {
    if (!task.due_date || task.completed) return false;
    return isBefore(new Date(task.due_date), new Date()) && !isToday(new Date(task.due_date));
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-gray-900/50 rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-gray-800 rounded w-1/3 mb-2"></div>
            <div className="h-3 bg-gray-800 rounded w-full mb-1"></div>
            <div className="h-3 bg-gray-800 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with stats and actions */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-white">Tasks</h3>
          {taskStats && (
            <div className="flex gap-4 text-sm text-gray-400">
              <span>{taskStats.total} total</span>
              <span>{taskStats.pending} pending</span>
              <span>{taskStats.in_progress} in progress</span>
              {taskStats.overdue > 0 && (
                <span className="text-red-400">{taskStats.overdue} overdue</span>
              )}
              {taskStats.due_today > 0 && (
                <span className="text-yellow-400">{taskStats.due_today} due today</span>
              )}
            </div>
          )}
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </Button>
      </div>

      {/* Search and filters */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "bg-gray-800/50 border-gray-700/50 text-gray-300",
              showFilters && "bg-blue-500/10 border-blue-500/50 text-blue-400"
            )}
          >
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        {/* Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-gray-900/50 rounded-lg p-4 border border-gray-800/50"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 block">Status</label>
                  <Select value={statusFilter} onValueChange={(value: TaskStatusFilter) => setStatusFilter(value)}>
                    <SelectTrigger className="bg-gray-800/50 border-gray-700/50 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 block">Priority</label>
                  <Select value={priorityFilter} onValueChange={(value: TaskPriorityFilter) => setPriorityFilter(value)}>
                    <SelectTrigger className="bg-gray-800/50 border-gray-700/50 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700">
                      <SelectItem value="all">All Priority</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 block">Sort By</label>
                  <Select value={sortBy} onValueChange={(value: TaskSortBy) => setSortBy(value)}>
                    <SelectTrigger className="bg-gray-800/50 border-gray-700/50 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700">
                      <SelectItem value="due_date">Due Date</SelectItem>
                      <SelectItem value="priority">Priority</SelectItem>
                      <SelectItem value="created_at">Created Date</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('all');
                      setPriorityFilter('all');
                      setSortBy('due_date');
                    }}
                    className="bg-gray-800/50 border-gray-700/50 text-gray-300 w-full"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tasks list */}
      <div className="space-y-3">
        {filteredAndSortedTasks.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No tasks found</h3>
            <p className="text-gray-400 mb-4">
              {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : `Start by creating the first task for ${companyName}`
              }
            </p>
            {!searchQuery && statusFilter === 'all' && priorityFilter === 'all' && (
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create First Task
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAndSortedTasks.map((task) => {
              const priorityDisplay = getPriorityDisplay(task.priority);
              const statusDisplay = getStatusDisplay(task.status);
              const taskIsOverdue = isOverdue(task);

              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "bg-gray-900/50 rounded-xl p-4 border border-gray-800/50 hover:border-gray-700/50 transition-colors",
                    task.completed && "opacity-60",
                    taskIsOverdue && "border-red-500/30 bg-red-500/5"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Completion checkbox */}
                    <button
                      onClick={() => handleToggleComplete(task)}
                      className={cn(
                        "mt-1 flex-shrink-0 transition-colors",
                        task.completed ? "text-green-400" : "text-gray-400 hover:text-white"
                      )}
                    >
                      {task.completed ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>

                    {/* Task content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className={cn(
                          "font-medium",
                          task.completed ? "text-gray-400 line-through" : "text-white"
                        )}>
                          {task.title}
                        </h4>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700">
                            <DropdownMenuItem
                              onClick={() => startEditing(task)}
                              className="text-gray-300 hover:text-white hover:bg-gray-800"
                            >
                              <Edit2 className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-gray-700" />
                            <DropdownMenuItem
                              onClick={() => setShowDeleteConfirm(task.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {task.description && (
                        <p className="text-sm text-gray-300 mb-3">{task.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        {/* Priority */}
                        <div className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded-full border",
                          priorityDisplay.bgColor
                        )}>
                          <priorityDisplay.icon className={cn("w-3 h-3", priorityDisplay.color)} />
                          <span className={priorityDisplay.color}>
                            {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                          </span>
                        </div>

                        {/* Status */}
                        <div className={cn(
                          "px-2 py-1 rounded-full",
                          statusDisplay.bgColor
                        )}>
                          <span className={statusDisplay.color}>{statusDisplay.text}</span>
                        </div>

                        {/* Due date */}
                        {task.due_date && (
                          <div className={cn(
                            "flex items-center gap-1",
                            taskIsOverdue ? "text-red-400" : "text-gray-400"
                          )}>
                            <Calendar className="w-3 h-3" />
                            <span>
                              {isToday(new Date(task.due_date))
                                ? 'Due today'
                                : format(new Date(task.due_date), 'MMM d, yyyy')
                              }
                            </span>
                            {taskIsOverdue && <AlertTriangle className="w-3 h-3" />}
                          </div>
                        )}

                        {/* Assignee */}
                        {task.assignee && (
                          <div className="flex items-center gap-1 text-gray-400">
                            <User className="w-3 h-3" />
                            <span>{task.assignee.first_name} {task.assignee.last_name}</span>
                          </div>
                        )}

                        {/* Task type */}
                        <div className="flex items-center gap-1 text-gray-400">
                          <Tag className="w-3 h-3" />
                          <span>{task.task_type}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Task Modal */}
      <Dialog open={showCreateModal || !!editingTask} onOpenChange={() => {
        setShowCreateModal(false);
        setEditingTask(null);
        resetForm();
      }}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTask ? 'Edit Task' : 'Create New Task'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                Title *
              </label>
              <input
                type="text"
                value={taskForm.title}
                onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter task title..."
                className="w-full p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                Description
              </label>
              <textarea
                value={taskForm.description}
                onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Task description..."
                rows={3}
                className="w-full p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500/50 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">
                  Priority
                </label>
                <Select value={taskForm.priority} onValueChange={(value: Task['priority']) => setTaskForm(prev => ({ ...prev, priority: value }))}>
                  <SelectTrigger className="bg-gray-800/50 border-gray-700/50 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">
                  Task Type
                </label>
                <Select value={taskForm.task_type} onValueChange={(value: Task['task_type']) => setTaskForm(prev => ({ ...prev, task_type: value }))}>
                  <SelectTrigger className="bg-gray-800/50 border-gray-700/50 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                    <SelectItem value="demo">Demo</SelectItem>
                    <SelectItem value="proposal">Proposal</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                Due Date
              </label>
              <input
                type="date"
                value={taskForm.due_date}
                onChange={(e) => setTaskForm(prev => ({ ...prev, due_date: e.target.value }))}
                className="w-full p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                Notes
              </label>
              <textarea
                value={taskForm.notes}
                onChange={(e) => setTaskForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes..."
                rows={3}
                className="w-full p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500/50 resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateModal(false);
                setEditingTask(null);
                resetForm();
              }}
              className="bg-gray-800/50 border-gray-700/50 text-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={editingTask ? handleUpdateTask : handleCreateTask}
              disabled={!taskForm.title.trim()}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              {editingTask ? 'Update' : 'Create'} Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
          </DialogHeader>
          <p className="text-gray-300">
            Are you sure you want to delete this task? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(null)}
              className="bg-gray-800/50 border-gray-700/50 text-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={() => showDeleteConfirm && handleDeleteTask(showDeleteConfirm)}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}