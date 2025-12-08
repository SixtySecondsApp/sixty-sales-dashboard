import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, isTomorrow, isPast, isYesterday } from 'date-fns';
import {
  Plus,
  MoreHorizontal,
  Building2,
  Video,
  CheckCircle2,
  Circle,
  Target,
  AlertTriangle,
  XCircle,
  Clock
} from 'lucide-react';

import { Task } from '@/lib/database/models';
import { CompanyTaskGroup as CompanyTaskGroupType, statusConfigs, priorityConfigs, accentColors } from './types';
import { AvatarCell } from './AvatarCell';
import { StatusBadge } from './StatusCell';

interface ProjectsKanbanViewProps {
  groups: CompanyTaskGroupType[];
  isDark: boolean;
  onEditTask: (task: Task) => void;
  onCompleteTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateStatus: (taskId: string, status: Task['status']) => void;
  onCreateTask: (companyId?: string) => void;
}

// Kanban columns configuration
const kanbanColumns: { id: Task['status']; label: string; icon: React.ReactNode }[] = [
  { id: 'pending', label: 'Pending', icon: <Circle className="w-4 h-4" /> },
  { id: 'in_progress', label: 'In Progress', icon: <Target className="w-4 h-4" /> },
  { id: 'completed', label: 'Completed', icon: <CheckCircle2 className="w-4 h-4" /> },
  { id: 'overdue', label: 'Overdue', icon: <AlertTriangle className="w-4 h-4" /> },
  { id: 'cancelled', label: 'Cancelled', icon: <XCircle className="w-4 h-4" /> },
];

// Task card component
function KanbanCard({
  task,
  group,
  isDark,
  onEdit,
  onComplete,
}: {
  task: Task;
  group: CompanyTaskGroupType;
  isDark: boolean;
  onEdit: () => void;
  onComplete: () => void;
}) {
  const hasMeetingLink = task.meeting_action_item_id || task.meeting_id;
  const accent = accentColors[group.accentColor];
  const priorityConfig = priorityConfigs[task.priority];

  const formatDueDate = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isYesterday(date)) return 'Yesterday';
    
    return format(date, 'MMM d');
  };

  const getDueDateColor = () => {
    if (!task.due_date) return isDark ? 'text-gray-500' : 'text-gray-400';
    const date = new Date(task.due_date);
    
    if (task.completed || task.status === 'completed') {
      return isDark ? 'text-gray-500' : 'text-gray-400';
    }
    if (isPast(date) && !isToday(date)) {
      return 'text-red-400';
    }
    if (isToday(date)) {
      return 'text-amber-400';
    }
    return isDark ? 'text-gray-400' : 'text-gray-600';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      onClick={onEdit}
      className={`p-4 rounded-xl backdrop-blur-sm cursor-pointer transition-all group
                  ${isDark
                    ? 'bg-gray-900/60 border border-gray-800/50 hover:border-gray-700/50 hover:bg-gray-800/40'
                    : 'bg-white/60 border border-gray-200/50 hover:border-gray-300/50 hover:bg-gray-50/40'}`}
    >
      {/* Company indicator */}
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-1 h-4 bg-gradient-to-b ${accent.gradient} rounded-full`} />
        <span className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          {group.name}
        </span>
        {hasMeetingLink && (
          <Video className="w-3 h-3 text-purple-400 ml-auto" />
        )}
      </div>

      {/* Task title */}
      <h4 className={`text-sm font-semibold mb-2 line-clamp-2
                     ${task.completed ? 'line-through opacity-60' : ''}
                     ${isDark ? 'text-white' : 'text-gray-900'}`}>
        {task.title}
      </h4>

      {/* Task description preview */}
      {task.description && (
        <p className={`text-xs mb-3 line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {task.description}
        </p>
      )}

      {/* Priority and Due Date */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${priorityConfig.bgClass} ${priorityConfig.textClass}`}>
          {priorityConfig.label}
        </span>
        {task.due_date && (
          <span className={`flex items-center gap-1 text-xs ${getDueDateColor()}`}>
            <Clock className="w-3 h-3" />
            {formatDueDate(task.due_date)}
          </span>
        )}
      </div>

      {/* Footer: Assignee and checkbox */}
      <div className="flex items-center justify-between">
        <AvatarCell person={task.assignee} size="sm" isDark={isDark} />
        
        <input
          type="checkbox"
          checked={task.completed || task.status === 'completed'}
          onChange={(e) => { e.stopPropagation(); onComplete(); }}
          onClick={(e) => e.stopPropagation()}
          className={`w-4 h-4 rounded cursor-pointer
                     ${isDark
                       ? 'border-gray-600 bg-gray-800/50'
                       : 'border-gray-300 bg-white'}
                     checked:bg-gradient-to-r checked:from-emerald-500 checked:to-green-500
                     focus:ring-2 focus:ring-emerald-500/50`}
        />
      </div>
    </motion.div>
  );
}

export function ProjectsKanbanView({
  groups,
  isDark,
  onEditTask,
  onCompleteTask,
  onDeleteTask,
  onUpdateStatus,
  onCreateTask
}: ProjectsKanbanViewProps) {
  // Flatten all tasks with their group info
  const allTasks = useMemo(() => {
    return groups.flatMap(group =>
      group.tasks.map(task => ({ task, group }))
    );
  }, [groups]);

  // Group tasks by status for columns
  const tasksByStatus = useMemo(() => {
    const grouped: Record<Task['status'], { task: Task; group: CompanyTaskGroupType }[]> = {
      pending: [],
      in_progress: [],
      completed: [],
      cancelled: [],
      overdue: []
    };

    allTasks.forEach(item => {
      grouped[item.task.status]?.push(item);
    });

    return grouped;
  }, [allTasks]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="flex gap-4 min-w-max p-2">
        {kanbanColumns.map((column) => {
          const columnTasks = tasksByStatus[column.id] || [];
          const config = statusConfigs[column.id];

          return (
            <div key={column.id} className="flex-shrink-0 w-[320px] flex flex-col">
              {/* Column Header */}
              <div className={`mb-4 px-4 py-3 rounded-xl backdrop-blur-sm
                              ${isDark
                                ? 'bg-gray-900/60 border border-gray-800/50'
                                : 'bg-white/60 border border-gray-200/50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={isDark ? config.text : config.textLight}>
                      {column.icon}
                    </span>
                    <h3 className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                      {column.label}
                    </h3>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full
                                   ${isDark ? 'bg-gray-800/50 text-gray-400' : 'bg-gray-200/50 text-gray-600'}`}>
                    {columnTasks.length}
                  </span>
                </div>
              </div>

              {/* Column Content */}
              <div className="flex-1 space-y-3 overflow-y-auto pb-4">
                <AnimatePresence>
                  {columnTasks.map(({ task, group }) => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      group={group}
                      isDark={isDark}
                      onEdit={() => onEditTask(task)}
                      onComplete={() => onCompleteTask(task)}
                    />
                  ))}
                </AnimatePresence>

                {/* Empty state */}
                {columnTasks.length === 0 && (
                  <div className={`p-4 rounded-xl border-2 border-dashed text-center
                                  ${isDark
                                    ? 'border-gray-800/50 text-gray-600'
                                    : 'border-gray-200/50 text-gray-400'}`}>
                    <p className="text-xs">No tasks</p>
                  </div>
                )}

                {/* Add task button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  onClick={() => onCreateTask()}
                  className={`w-full p-3 rounded-xl border-2 border-dashed transition-all
                              flex items-center justify-center gap-2
                              ${isDark
                                ? 'border-gray-800/50 hover:border-gray-700/50 text-gray-500 hover:text-gray-400'
                                : 'border-gray-200/50 hover:border-gray-300/50 text-gray-400 hover:text-gray-500'}`}
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">Add task</span>
                </motion.button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

