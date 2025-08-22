import React, { useState, useEffect, useMemo } from 'react';
import {
  DndContext,
  closestCorners,
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
import { useUser } from '@/lib/hooks/useUser';
import { Task } from '@/lib/database/models';
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
import logger from '@/lib/utils/logger';

interface TaskKanbanProps {
  assigneeFilter?: string;
  dealId?: string;
  companyId?: string;
  contactId?: string;
  onEditTask?: (task: Task) => void;
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
    id: 'overdue',
    name: 'Overdue',
    color: '#EF4444',
    icon: <AlertTriangle className="w-4 h-4" />,
    description: 'Tasks that are past their due date'
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
  onEditTask
}) => {
  const { userData } = useUser();
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [initialStage, setInitialStage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [overdueConfirm, setOverdueConfirm] = useState<{
    isOpen: boolean;
    taskId: string;
    taskTitle: string;
  }>({
    isOpen: false,
    taskId: '',
    taskTitle: ''
  });

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
    
    return taskFilters;
  }, [assigneeFilter, dealId, companyId, contactId]);

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
      overdue: [],
      started: [],
      complete: []
    };

    logger.log('Re-grouping tasks, total count:', tasks.length);

    tasks.forEach(task => {
      // Ensure we're working with current date calculations
      const now = new Date();
      const dueDate = task.due_date ? new Date(task.due_date) : null;
      const isPastDue = dueDate && dueDate < now;
      
      if (task.completed || task.status === 'completed') {
        grouped.complete.push(task);
      } else if (task.status === 'in_progress') {
        grouped.started.push(task);
      } else if (isPastDue && !task.completed) {
        grouped.overdue.push(task);
      } else {
        grouped.planned.push(task);
      }
    });

    logger.log('Task grouping completed:', {
      planned: grouped.planned.length,
      overdue: grouped.overdue.length,
      started: grouped.started.length,
      complete: grouped.complete.length
    });
    
    return grouped;
  }, [tasks, refreshKey]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over || active.id === over.id) return;

    const taskId = String(active.id);
    const newStage = String(over.id);
    const task = tasks.find(t => t.id === taskId);

    if (!task) return;

    // Check if moving to 'overdue' column
    if (newStage === 'overdue') {
      const isAlreadyOverdue = task.due_date && isPast(new Date(task.due_date));
      if (!isAlreadyOverdue) {
        setOverdueConfirm({
          isOpen: true,
          taskId: task.id,
          taskTitle: task.title
        });
        // We stop here and let the dialog handle the update
        return;
      }
    }
    
    try {
      let updates: any = {};

      switch (newStage) {
        case 'planned':
          updates = { status: 'pending', completed: false, completed_at: null };
          break;
        case 'overdue':
          // Keep as pending but ensure it's not completed
          updates = { status: 'pending', completed: false, completed_at: null };
          break;
        case 'started':
          updates = { status: 'in_progress', completed: false, completed_at: null };
          break;
        case 'complete':
          updates = { status: 'completed', completed: true, completed_at: new Date().toISOString() };
          break;
      }

      await updateTask(taskId, updates);
      
      if (newStage === 'complete') {
        toast.success('Task completed!');
      } else {
        toast.success(`Task moved to ${taskStages.find(s => s.id === newStage)?.name}`);
      }
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const handleConfirmOverdue = async () => {
    if (!overdueConfirm.taskId) return;

    try {
      await updateTask(overdueConfirm.taskId, {
        due_date: new Date().toISOString(),
        status: 'pending' // Ensure it's not marked as complete
      });
      toast.success(`Task "${overdueConfirm.taskTitle}" marked as overdue.`);
      setRefreshKey(prev => prev + 1); // Refresh the board
    } catch (error) {
      toast.error('Failed to update task.');
    } finally {
      setOverdueConfirm({ isOpen: false, taskId: '', taskTitle: '' });
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="mb-6 space-y-4">
          <div className="h-8 bg-gray-800 rounded-lg w-48" />
          <div className="h-4 bg-gray-800 rounded-lg w-80" />
        </div>
        <div className="flex gap-4 overflow-x-auto pb-6">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="min-w-[320px] bg-gray-900/50 rounded-xl border border-gray-800/50 flex flex-col h-[600px]"
            >
              <div className="p-4 border-b border-gray-800/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-md bg-gray-800" />
                  <div className="h-5 bg-gray-800 rounded-lg w-20" />
                </div>
                <div className="bg-gray-800/50 rounded-full w-8 h-5" />
              </div>
              <div className="p-4 space-y-3 flex-1">
                {[1, 2, 3].map(j => (
                  <div key={j} className="bg-gray-800/50 rounded-xl p-4 h-32" />
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
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Error loading tasks</h3>
          <p className="text-gray-400">{error.message}</p>
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
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </Button>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
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

      {/* Overdue Confirmation Dialog */}
      <AlertDialog open={overdueConfirm.isOpen} onOpenChange={(isOpen) => !isOpen && setOverdueConfirm({ isOpen: false, taskId: '', taskTitle: ''})}>
        <AlertDialogContent className="glassmorphism border-gray-700/50">
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Task as Overdue?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              You're moving "{overdueConfirm.taskTitle}" to the Overdue column. Do you want to set its due date to now?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                fetchTasks(); // refetch to revert optimistic update from dnd-kit if any
                setOverdueConfirm({ isOpen: false, taskId: '', taskTitle: '' })
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmOverdue} className="bg-red-600 hover:bg-red-700">
              Yes, Mark as Overdue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
}

const TaskColumn: React.FC<TaskColumnProps> = ({
  stage,
  tasks,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onCompleteTask
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id
  });

  const taskIds = useMemo(() => tasks.map(t => t.id), [tasks]);

  return (
    <div
      className="min-w-[320px] max-w-[320px] bg-gray-900/50 backdrop-blur-xl
        rounded-xl border border-gray-800/50 flex flex-col max-h-[calc(100vh-200px)]"
      style={{
        transition: 'border-color 150ms ease',
        borderColor: isOver ? `${stage.color}80` : undefined
      }}
    >
      {/* Column Header */}
      <div
        className="p-4 border-b border-gray-800/50 flex items-center justify-between sticky top-0 z-10 bg-gray-900/80 backdrop-blur-xl"
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
          <h3 className="font-semibold text-white">{stage.name}</h3>
        </div>
        <div className="bg-gray-800/50 px-2.5 py-0.5 rounded-full text-xs text-gray-400">
          {tasks.length}
        </div>
      </div>

      {/* Task Container */}
      <div
        ref={setNodeRef}
        className={`
          flex-1 overflow-y-auto p-4 space-y-3
          ${isOver ? 'bg-gray-800/30 ring-1 ring-inset' : ''}
          scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent
          transition-all duration-150
        `}
        style={isOver ? { '--ring-color': `${stage.color}40` } as any : {}}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {/* Empty state */}
          {tasks.length === 0 && !isOver && (
            <div className="text-gray-500 text-center text-sm h-20 flex items-center justify-center border border-dashed border-gray-800/50 rounded-lg">
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
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </SortableContext>
        {/* Add Task Button */}
        <button
          onClick={onAddTask}
          className="w-full h-12 flex items-center justify-center gap-2
            bg-transparent border border-dashed border-gray-700 rounded-lg
            text-gray-400 hover:text-gray-300 hover:bg-gray-800/30
            transition-colors mt-2"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">Add task</span>
        </button>
      </div>
    </div>
  );
};

// Task Card Component
interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onComplete?: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  isDragging = false,
  onEdit,
  onDelete,
  onComplete
}) => {
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
      low: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      urgent: 'bg-red-500/10 text-red-400 border-red-500/20'
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
      <Card className={`
        bg-gray-800/50 border-gray-700/50 hover:bg-gray-800/70 
        transition-all duration-200 cursor-grab active:cursor-grabbing
        ${isDragging ? 'opacity-50 rotate-3 scale-105' : ''}
        ${isOverdue() ? 'ring-1 ring-red-500/30' : ''}
      `}>
        <CardContent className="p-4">
          {/* Task Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2 flex-1">
              <TaskIcon className="w-4 h-4 text-gray-400" />
              <h4 className="font-medium text-white text-sm leading-tight line-clamp-2">
                {task.title}
              </h4>
            </div>
            <div className="flex items-center gap-1 ml-2">
              {onEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="h-6 w-6 p-0 hover:bg-gray-700/50"
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
                  className="h-6 w-6 p-0 hover:bg-red-500/20 hover:text-red-400"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Task Description */}
          {task.description && (
            <p className="text-xs text-gray-400 mb-3 line-clamp-2">
              {task.description}
            </p>
          )}

          {/* Priority Badge */}
          <div className="flex items-center justify-between mb-3">
            <Badge className={`text-xs border ${getPriorityColor(task.priority)}`}>
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
                    ? 'text-green-400 hover:bg-green-500/20' 
                    : 'text-gray-400 hover:bg-gray-700/50'
                }`}
              >
                {task.completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
              </Button>
            )}
          </div>

          {/* Due Date */}
          {task.due_date && (
            <div className={`flex items-center gap-1 text-xs ${
              isOverdue() ? 'text-red-400' : 'text-gray-400'
            }`}>
              <Clock className="w-3 h-3" />
              <span>{formatDueDate(task.due_date)}</span>
              {isOverdue() && <AlertTriangle className="w-3 h-3 text-red-400" />}
            </div>
          )}

          {/* Contact/Company Info */}
          {(task.contact_name || task.company) && (
            <div className="mt-2 pt-2 border-t border-gray-700/50">
              {task.contact_name && (
                <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                  <User className="w-3 h-3" />
                  <span>{task.contact_name}</span>
                </div>
              )}
              {task.company && (
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Building2 className="w-3 h-3" />
                  <span>{task.company}</span>
                </div>
              )}
            </div>
          )}

          {/* Assignee */}
          {task.assignee && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-700/50">
              <Avatar className="h-5 w-5">
                <AvatarImage src={task.assignee.avatar_url} />
                <AvatarFallback className="text-xs bg-gray-700">
                  {(task.assignee.first_name?.[0] || '') + (task.assignee.last_name?.[0] || '')}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-gray-400">
                {task.assignee.first_name} {task.assignee.last_name}
              </span>
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