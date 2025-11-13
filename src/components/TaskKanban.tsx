import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  closestCorners,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow, isToday, isTomorrow, isYesterday, isPast } from 'date-fns';
import {
  Clock,
  User,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Target,
  Flag,
  Edit,
  Trash2,
  Calendar,
  Building2,
  Mail,
  Phone,
  Users,
  FileText,
  ExternalLink
} from 'lucide-react';

import { useTasks } from '@/lib/hooks/useTasks';
import { useSubtasks } from '@/lib/hooks/useSubtasks';
import { useUser } from '@/lib/hooks/useUser';
import { Task } from '@/lib/database/models';
import { handleRelatedRecordClick, handleRelatedRecordKeyDown, isRelatedRecordNavigable } from '@/lib/utils/navigationUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import TaskForm from './TaskForm';
import TaskDetailModal from './TaskDetailModal';
import logger from '@/lib/utils/logger';

interface TaskKanbanProps {
  assigneeFilter?: string;
  dealId?: string;
  companyId?: string;
  contactId?: string;
  onEditTask?: (task: Task) => void;
  meetingTasksOnly?: boolean;
}

interface TaskStage {
  id: string;
  name: string;
  color: string;
  icon: React.ReactNode;
  description: string;
}

const taskStages: TaskStage[] = [
  {
    id: 'planned',
    name: 'Planned',
    color: '#6B7280',
    icon: <Circle className="w-4 h-4" />,
    description: 'Tasks that are planned but not yet started'
  },
  {
    id: 'started',
    name: 'Started',
    color: '#3B82F6',
    icon: <Target className="w-4 h-4" />,
    description: 'Tasks that are currently in progress'
  },
  {
    id: 'complete',
    name: 'Complete',
    color: '#10B981',
    icon: <CheckCircle2 className="w-4 h-4" />,
    description: 'Tasks that have been completed'
  }
];

const TaskKanban: React.FC<TaskKanbanProps> = ({
  assigneeFilter,
  dealId,
  companyId,
  contactId,
  onEditTask,
  meetingTasksOnly = false
}) => {
  const { userData } = useUser();
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [initialStage, setInitialStage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskDetailModalOpen, setIsTaskDetailModalOpen] = useState(false);

  // Build filters for the hook
  const filters = useMemo(() => {
    const taskFilters: any = {};

    if (assigneeFilter) {
      taskFilters.assigned_to = assigneeFilter;
    }

    if (dealId) {
      taskFilters.deal_id = dealId;
    }

    if (companyId) {
      taskFilters.company_id = companyId;
    }

    if (contactId) {
      taskFilters.contact_id = contactId;
    }

    // Add meeting filter if enabled
    if (meetingTasksOnly) {
      taskFilters.hasMeeting = true;
    }

    return taskFilters;
  }, [assigneeFilter, dealId, companyId, contactId, meetingTasksOnly]);

  const { tasks, isLoading, error, updateTask, deleteTask, completeTask, uncompleteTask, fetchTasks } = useTasks(filters);

  // Effect to refetch tasks when refresh key changes
  useEffect(() => {
    if (refreshKey > 0) {
      fetchTasks();
    }
  }, [refreshKey, fetchTasks]);

  // Group tasks by stage
  const tasksByStage = useMemo(() => {
    const grouped: Record<string, Task[]> = {
      planned: [],
      started: [],
      complete: []
    };

    logger.log('Re-grouping tasks, total count:', tasks.length);

    tasks.forEach(task => {
      if (task.completed || task.status === 'completed') {
        grouped.complete.push(task);
      } else if (task.status === 'in_progress') {
        grouped.started.push(task);
      } else {
        // All pending tasks go to planned, including overdue ones
        // The overdue styling will be handled by the TaskCard component
        grouped.planned.push(task);
      }
    });

    logger.log('Task grouping completed:', {
      planned: grouped.planned.length,
      started: grouped.started.length,
      complete: grouped.complete.length
    });
    
    return grouped;
  }, [tasks, refreshKey]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // Reduced from 8 to make dragging more sensitive
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    // Enhanced debugging
    console.log('Drag end event:', { 
      activeId: active.id, 
      overId: over?.id,
      overData: over?.data
    });

    if (!over || active.id === over.id) {
      console.log('Drag cancelled - no valid drop target');
      return;
    }

    const taskId = String(active.id);
    const newStage = String(over.id);
    const task = tasks.find(t => t.id === taskId);

    if (!task) {
      console.log('Task not found:', taskId);
      return;
    }

    // Get current stage for comparison
    const currentStage = task.completed || task.status === 'completed' ? 'complete' 
      : task.status === 'in_progress' ? 'started' 
      : 'planned';

    console.log(`Moving task "${task.title}" from ${currentStage} to ${newStage}`);

    // Prepare updates
    let updates: any = {};
    switch (newStage) {
      case 'planned':
        updates = { status: 'pending', completed: false, completed_at: null };
        break;
      case 'started':
        updates = { status: 'in_progress', completed: false, completed_at: null };
        break;
      case 'complete':
        updates = { status: 'completed', completed: true, completed_at: new Date().toISOString() };
        break;
    }

    console.log('Applying updates:', updates);

    try {
      // Optimistic update - immediately update local state
      setTasks((prevTasks: Task[]) => 
        prevTasks.map((t: Task) => 
          t.id === taskId 
            ? { ...t, ...updates }
            : t
        )
      );

      // Then perform the database update
      await updateTask(taskId, updates);
      
      // Force a small delay and refresh to ensure drag state is reset
      setTimeout(() => {
        setRefreshKey(prev => prev + 1);
      }, 100);
      
      if (newStage === 'complete') {
        toast.success('Task completed!');
      } else {
        toast.success(`Task moved to ${taskStages.find(s => s.id === newStage)?.name}`);
      }
    } catch (error) {
      console.error('Failed to update task:', error);
      
      // Revert optimistic update on error
      const originalTask = tasks.find(t => t.id === taskId);
      if (originalTask) {
        setTasks((prevTasks: Task[]) => 
          prevTasks.map((t: Task) => 
            t.id === taskId ? originalTask : t
          )
        );
      }
      
      toast.error('Failed to update task');
    }
  };


  const handleCreateTask = (stageId?: string) => {
    setEditingTask(undefined);
    setInitialStage(stageId || 'planned');
    setIsTaskFormOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsTaskFormOpen(true);
    if (onEditTask) {
      onEditTask(task);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      toast.success('Task deleted');
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  const handleCompleteTask = async (task: Task) => {
    try {
      if (task.completed) {
        await uncompleteTask(task.id);
        toast.success('Task marked as incomplete');
      } else {
        await completeTask(task.id);
        toast.success('Task completed!');
      }
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsTaskDetailModalOpen(true);
  };

  const handleTaskDetailModalClose = () => {
    setIsTaskDetailModalOpen(false);
    setSelectedTask(null);
  };

  const handleTaskDetailEdit = (task: Task) => {
    handleTaskDetailModalClose();
    handleEditTask(task);
  };

  const handleTaskDetailDelete = async (taskId: string) => {
    handleTaskDetailModalClose();
    await handleDeleteTask(taskId);
  };

  const statusLabels: Record<Task['status'], string> = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    overdue: 'Overdue'
  };

  const handleTaskDetailStatusChange = async (task: Task, nextStatus: Task['status']) => {
    try {
      let updatedTask: Task;

      if (nextStatus === 'completed') {
        updatedTask = await completeTask(task.id);
      } else {
        const updates: Partial<Task> = {
          status: nextStatus,
          completed: false,
        };
        updatedTask = await updateTask(task.id, updates);
      }

      const mergedTask = { ...task, ...updatedTask };
      setSelectedTask(mergedTask as Task);
      toast.success(`Task status set to ${statusLabels[nextStatus]}`);
    } catch (error) {
      logger.error('Error updating task status from detail modal:', error);
      toast.error('Failed to update task status');
      throw error;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="mb-6 space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded-lg w-48" />
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded-lg w-80" />
        </div>
        <div className="flex gap-4 overflow-x-auto pb-6">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="min-w-[320px] bg-white/85 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800/50 flex flex-col h-[600px]"
            >
              <div className="p-4 border-b border-gray-200 dark:border-gray-800/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-md bg-gray-200 dark:bg-gray-800" />
                  <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded-lg w-20" />
                </div>
                <div className="bg-gray-100 dark:bg-gray-800/50 rounded-full w-8 h-5" />
              </div>
              <div className="p-4 space-y-3 flex-1">
                {[1, 2, 3].map(j => (
                  <div key={j} className="bg-gray-100 dark:bg-gray-800/50 rounded-xl p-4 h-32" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-700 dark:text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Error loading tasks</h3>
          <p className="text-gray-600 dark:text-gray-400">{error.message}</p>
        </div>
      </div>
    );
  }

  const activeDragTask = activeDragId ? tasks.find(t => t.id === activeDragId) : null;

  return (
    <div className="space-y-6">
      {/* Add Task Button */}
      <div className="flex justify-end">
        <Button
          onClick={() => handleCreateTask()}
          variant="default"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </Button>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter} // Changed from closestCorners for better accuracy
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 overflow-x-auto pb-6">
          {taskStages.map(stage => (
            <TaskColumn
              key={stage.id}
              stage={stage}
              tasks={tasksByStage[stage.id] || []}
              onEditTask={onEditTask}
              onDeleteTask={handleDeleteTask}
              onCompleteTask={handleCompleteTask}
              onAddTask={() => handleCreateTask(stage.id)}
              onTaskClick={handleTaskClick}
            />
          ))}
        </div>

        <DragOverlay>
          {activeDragTask ? (
            <TaskCard 
              task={activeDragTask} 
              isDragging 
            />
          ) : null}
        </DragOverlay>
      </DndContext>


      {/* Task Form */}
      <TaskForm
        task={editingTask}
        isOpen={isTaskFormOpen}
        onClose={() => {
          setIsTaskFormOpen(false);
          setEditingTask(undefined);
          setInitialStage(null);
          // Refresh tasks to ensure the kanban board updates
          setRefreshKey(prev => prev + 1);
          setTimeout(() => {
            fetchTasks();
          }, 300);
        }}
        dealId={dealId}
        companyId={companyId}
        contactId={contactId}
      />

      {/* Task Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={isTaskDetailModalOpen}
        onClose={handleTaskDetailModalClose}
        onEdit={handleTaskDetailEdit}
        onDelete={handleTaskDetailDelete}
        onStatusChange={handleTaskDetailStatusChange}
      />
    </div>
  );
};

// Task Column Component
interface TaskColumnProps {
  stage: TaskStage;
  tasks: Task[];
  onAddTask: () => void;
  onEditTask?: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onCompleteTask: (task: Task) => void;
  onTaskClick: (task: Task) => void;
}

const TaskColumn: React.FC<TaskColumnProps> = ({
  stage,
  tasks,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onCompleteTask,
  onTaskClick
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id
  });

  const taskIds = useMemo(() => {
    const ids = tasks.map(t => t.id);
    console.log('TaskColumn taskIds updated:', stage.id, ids);
    return ids;
  }, [tasks, stage.id]);

  return (
    <div
      className="min-w-[320px] max-w-[320px] bg-white dark:bg-gray-900/80 backdrop-blur-sm
        rounded-xl border border-gray-200 dark:border-gray-700/50 flex flex-col max-h-[calc(100vh-200px)]"
      style={{
        transition: 'border-color 150ms ease',
        borderColor: isOver ? `${stage.color}80` : undefined
      }}
    >
      {/* Column Header */}
      <div
        className="p-4 border-b border-gray-200 dark:border-gray-700/50 flex items-center justify-between sticky top-0 z-10 bg-white dark:bg-gray-900/80 backdrop-blur-sm"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 rounded-md flex items-center justify-center"
            style={{ backgroundColor: stage.color }}
          >
            {React.cloneElement(stage.icon as React.ReactElement, {
              className: "w-3 h-3 text-white"
            })}
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{stage.name}</h3>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 px-2.5 py-0.5 rounded-full text-xs text-gray-700 dark:text-gray-300">
          {tasks.length}
        </div>
      </div>

      {/* Task Container */}
      <div
        ref={setNodeRef}
        className={`
          flex-1 overflow-y-auto p-4 space-y-3
          ${isOver ? 'bg-gray-100 dark:bg-gray-800/30 ring-1 ring-inset' : ''}
          scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent
          transition-all duration-150
        `}
        style={isOver ? { '--ring-color': `${stage.color}40` } as any : {}}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {/* Empty state */}
          {tasks.length === 0 && !isOver && (
            <div className="text-gray-500 text-center text-sm h-20 flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-800/50 rounded-lg">
              Drop tasks here
            </div>
          )}

          <AnimatePresence>
            {tasks.map((task) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                <TaskCard
                  task={task}
                  onEdit={onEditTask ? () => onEditTask(task) : undefined}
                  onDelete={() => onDeleteTask(task.id)}
                  onComplete={() => onCompleteTask(task)}
                  onClick={() => onTaskClick(task)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </SortableContext>
        {/* Add Task Button */}
        <button
          onClick={onAddTask}
          className="w-full h-12 flex items-center justify-center gap-2
            bg-transparent border border-dashed border-gray-300 dark:border-gray-700 rounded-lg
            text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30
            transition-colors mt-2"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">Add task</span>
        </button>
      </div>
    </div>
  );
};

// Subtask Badge Component
interface SubtaskBadgeProps {
  taskId: string;
}

const SubtaskBadge: React.FC<SubtaskBadgeProps> = ({ taskId }) => {
  const { subtaskStats, isLoading } = useSubtasks({ 
    parentTaskId: taskId, 
    enabled: true 
  });

  if (isLoading || !subtaskStats || subtaskStats.total === 0) {
    return null;
  }

  return (
    <Badge variant="outline" className="text-xs bg-gray-100 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-2 py-0">
      {subtaskStats.completed}/{subtaskStats.total} subtasks
    </Badge>
  );
};

// Task Card Component
interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onComplete?: () => void;
  onClick?: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  isDragging = false,
  onEdit,
  onDelete,
  onComplete,
  onClick
}) => {
  const navigate = useNavigate();
  const getTaskIcon = (taskType: Task['task_type']) => {
    const icons = {
      call: Phone,
      email: Mail,
      meeting: Users,
      follow_up: Target,
      proposal: FileText,
      demo: Users,
      general: Circle
    };
    return icons[taskType] || Circle;
  };

  const getPriorityColor = (priority: Task['priority']) => {
    const colors = {
      low: 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20',
      medium: 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20',
      high: 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/20',
      urgent: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20'
    };
    return colors[priority] || colors.medium;
  };

  const formatDueDate = (dueDate: string) => {
    const date = new Date(dueDate);
    const now = new Date();
    
    if (isToday(date)) {
      return 'Today';
    } else if (isTomorrow(date)) {
      return 'Tomorrow';
    } else if (isYesterday(date)) {
      return 'Yesterday';
    } else if (date < now) {
      return `${formatDistanceToNow(date)} ago`;
    } else {
      return formatDistanceToNow(date, { addSuffix: true });
    }
  };

  const isOverdue = () => {
    if (!task.due_date || task.completed) return false;
    return new Date(task.due_date) < new Date();
  };

  const TaskIcon = getTaskIcon(task.task_type);

  return (
    <SortableTaskCard taskId={task.id} isDragging={isDragging}>
      <Card
        className={`
          bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50
          hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:border-gray-300 dark:hover:border-gray-600/50
          transition-all duration-200 cursor-grab active:cursor-grabbing
          ${isDragging ? 'opacity-50 rotate-3 scale-105' : ''}
          ${isOverdue() ? 'ring-1 ring-red-400 dark:ring-red-500/30' : ''}
          ${onClick ? 'hover:shadow-lg hover:shadow-blue-200 dark:hover:shadow-blue-500/10' : ''}
        `}
        onClick={onClick ? (e) => {
          e.stopPropagation();
          onClick();
        } : undefined}
      >
        <CardContent className="p-4">
          {/* Task Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <TaskIcon className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                <h4 className="font-medium text-gray-900 dark:text-white text-sm leading-tight line-clamp-2">
                  {task.title}
                </h4>
              </div>
              {/* Subtask Badge */}
              <SubtaskBadge taskId={task.id} />

              {/* Category and Fathom Badges */}
              <div className="flex flex-wrap gap-1 mt-2">
                {task.category && (
                  <Badge className="px-2 py-0.5 text-xs bg-purple-50 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-700">
                    {task.category}
                  </Badge>
                )}
                {task.meeting_id && (
                  <Badge className="px-2 py-0.5 text-xs bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700">
                    From Fathom
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
              {onEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-gray-700/50"
                >
                  <Edit className="w-3 h-3" />
                </Button>
              )}
              {onDelete && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="h-6 w-6 p-0 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Task Description */}
          {task.description && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
              {task.description}
            </p>
          )}

          {/* Priority Badge */}
          <div className="flex items-center justify-between mb-3">
            <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
              {task.priority}
            </Badge>

            {/* Complete Button */}
            {onComplete && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onComplete();
                }}
                className={`h-6 w-6 p-0 ${
                  task.completed
                    ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50'
                }`}
              >
                {task.completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
              </Button>
            )}
          </div>

          {/* Due Date */}
          {task.due_date && (
            <div className={`flex items-center gap-1 text-xs ${
              isOverdue() ? 'text-red-700 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'
            }`}>
              <Clock className="w-3 h-3" />
              <span>{formatDueDate(task.due_date)}</span>
              {isOverdue() && <AlertTriangle className="w-3 h-3 text-red-700 dark:text-red-400" />}
            </div>
          )}

          {/* Contact/Company Info */}
          {(task.contact_name || task.company) && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700/50">
              {task.contact_name && (
                <div
                  className={`flex items-center gap-1 text-xs mb-1 transition-colors ${
                    isRelatedRecordNavigable(task.contact_id, task.contact_name)
                      ? 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer group'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                  onClick={
                    isRelatedRecordNavigable(task.contact_id, task.contact_name)
                      ? (e) => handleRelatedRecordClick(e, navigate, 'contact', task.contact_id, task.contact_name)
                      : undefined
                  }
                  onKeyDown={
                    isRelatedRecordNavigable(task.contact_id, task.contact_name)
                      ? (e) => handleRelatedRecordKeyDown(e, navigate, 'contact', task.contact_id, task.contact_name)
                      : undefined
                  }
                  tabIndex={isRelatedRecordNavigable(task.contact_id, task.contact_name) ? 0 : undefined}
                  role={isRelatedRecordNavigable(task.contact_id, task.contact_name) ? "button" : undefined}
                  aria-label={isRelatedRecordNavigable(task.contact_id, task.contact_name) ? `Navigate to contact ${task.contact_name}` : undefined}
                >
                  <User className="w-3 h-3" />
                  <span className={isRelatedRecordNavigable(task.contact_id, task.contact_name) ? 'underline decoration-dotted hover:decoration-solid' : ''}>
                    {task.contact_name}
                  </span>
                  {isRelatedRecordNavigable(task.contact_id, task.contact_name) && (
                    <ExternalLink className="w-2 h-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              )}
              {task.company && (
                <div
                  className={`flex items-center gap-1 text-xs transition-colors ${
                    isRelatedRecordNavigable(task.company_id, task.company)
                      ? 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer group'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                  onClick={
                    isRelatedRecordNavigable(task.company_id, task.company)
                      ? (e) => handleRelatedRecordClick(e, navigate, 'company', task.company_id, task.company)
                      : undefined
                  }
                  onKeyDown={
                    isRelatedRecordNavigable(task.company_id, task.company)
                      ? (e) => handleRelatedRecordKeyDown(e, navigate, 'company', task.company_id, task.company)
                      : undefined
                  }
                  tabIndex={isRelatedRecordNavigable(task.company_id, task.company) ? 0 : undefined}
                  role={isRelatedRecordNavigable(task.company_id, task.company) ? "button" : undefined}
                  aria-label={isRelatedRecordNavigable(task.company_id, task.company) ? `Navigate to company ${typeof task.company === 'object' ? task.company?.name : task.company}` : undefined}
                >
                  <Building2 className="w-3 h-3" />
                  <span className={isRelatedRecordNavigable(task.company_id, task.company) ? 'underline decoration-dotted hover:decoration-solid' : ''}>
                    {typeof task.company === 'object' ? task.company?.name : task.company}
                  </span>
                  {isRelatedRecordNavigable(task.company_id, task.company) && (
                    <ExternalLink className="w-2 h-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Assignee */}
          {task.assignee && (
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/50">
              <Avatar className="h-6 w-6 ring-1 ring-gray-300 dark:ring-gray-600/50">
                <AvatarImage src={task.assignee.avatar_url} />
                <AvatarFallback className="text-xs bg-gradient-to-br from-blue-500 to-purple-500 text-white font-medium">
                  {(task.assignee.first_name?.[0] || '') + (task.assignee.last_name?.[0] || '')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                  {task.assignee.first_name} {task.assignee.last_name}
                </div>
                <div className="text-xs text-gray-500">
                  Assigned
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </SortableTaskCard>
  );
};

// Sortable Task Card Wrapper
interface SortableTaskCardProps {
  taskId: string;
  children: React.ReactNode;
  isDragging?: boolean;
}

const SortableTaskCard: React.FC<SortableTaskCardProps> = ({
  taskId,
  children,
  isDragging = false
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: taskId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={isDragging || isSortableDragging ? 'z-50' : ''}
    >
      {children}
    </div>
  );
};

export default TaskKanban; 