import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  Plus,
  MoreHorizontal,
  Building2
} from 'lucide-react';

import { Task } from '@/lib/database/models';
import { CompanyTaskGroup as CompanyTaskGroupType, accentColors } from './types';
import { TasksTableHeader } from './TasksTableHeader';
import { ProjectTaskRow } from './ProjectTaskRow';
import { AddTaskRow } from './AddTaskRow';
import { ProgressCell } from './ProgressCell';

interface CompanyTaskGroupProps {
  group: CompanyTaskGroupType;
  isDark: boolean;
  onToggle: () => void;
  onEditTask: (task: Task) => void;
  onCompleteTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onCreateTask: () => void;
}

export function CompanyTaskGroup({
  group,
  isDark,
  onToggle,
  onEditTask,
  onCompleteTask,
  onDeleteTask,
  onCreateTask
}: CompanyTaskGroupProps) {
  const accent = accentColors[group.accentColor];

  // Calculate group stats
  const stats = useMemo(() => {
    const total = group.tasks.length;
    const completed = group.tasks.filter(t => t.completed || t.status === 'completed').length;
    const overdue = group.tasks.filter(t => {
      if (t.completed || t.status === 'completed' || t.status === 'cancelled') return false;
      if (!t.due_date) return false;
      return new Date(t.due_date) < new Date();
    }).length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, overdue, progress };
  }, [group.tasks]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mb-6"
    >
      {/* Group Header */}
      <motion.div
        whileHover={{ x: 4 }}
        className="flex items-center gap-3 mb-3 cursor-pointer group"
        onClick={onToggle}
      >
        {/* Expand/Collapse Icon */}
        <motion.div
          animate={{ rotate: group.collapsed ? 0 : 90 }}
          transition={{ duration: 0.2 }}
          className={`p-1.5 rounded-lg bg-gradient-to-r ${accent.gradient} shadow-lg ${accent.glow}`}
        >
          <ChevronRight className="w-4 h-4 text-white" />
        </motion.div>

        {/* Company Icon */}
        {group.company && (
          <div className={`p-1.5 rounded-lg ${isDark ? 'bg-gray-800/50' : 'bg-gray-100'}`}>
            <Building2 className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          </div>
        )}

        {/* Company Name */}
        <h3 className={`text-lg font-bold bg-gradient-to-r ${accent.gradient} bg-clip-text text-transparent`}>
          {group.name}
        </h3>

        {/* Task Count Badge */}
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium 
                         ${isDark ? 'bg-gray-800/50 text-gray-400' : 'bg-gray-200/50 text-gray-600'}`}>
          {stats.total} {stats.total === 1 ? 'task' : 'tasks'}
        </span>

        {/* Overdue Badge */}
        {stats.overdue > 0 && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
            {stats.overdue} overdue
          </span>
        )}

        {/* Progress Mini Bar */}
        <div className="flex-1 max-w-[120px] mx-2">
          <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-gray-800/50' : 'bg-gray-200/50'}`}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${stats.progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className={`h-full rounded-full bg-gradient-to-r ${accent.gradient}`}
            />
          </div>
        </div>
        <span className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          {stats.progress}%
        </span>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onCreateTask(); }}
            className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-200/50'}`}
          >
            <Plus className={`w-4 h-4 hover:text-blue-400 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          </button>
          <button
            onClick={(e) => e.stopPropagation()}
            className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-200/50'}`}
          >
            <MoreHorizontal className={`w-4 h-4 ${isDark ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`} />
          </button>
        </div>
      </motion.div>

      {/* Group Content */}
      <AnimatePresence>
        {!group.collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className={`relative rounded-2xl overflow-hidden 
                            backdrop-blur-xl shadow-2xl
                            ${isDark
                              ? 'border border-gray-800/50 bg-gradient-to-br from-gray-900/80 via-gray-900/60 to-gray-900/40 shadow-black/20'
                              : 'border border-gray-200/50 bg-gradient-to-br from-white/80 via-gray-50/60 to-white/40 shadow-gray-200/20'}`}>
              {/* Subtle glow effect */}
              <div className={`absolute inset-0 bg-gradient-to-br ${accent.gradient} opacity-[0.02] pointer-events-none`} />

              {/* Table Header */}
              <TasksTableHeader isDark={isDark} accentColor={group.accentColor} />

              {/* Task Rows */}
              {group.tasks.map((task, index) => (
                <ProjectTaskRow
                  key={task.id}
                  task={task}
                  isDark={isDark}
                  accentColor={group.accentColor}
                  isLast={index === group.tasks.length - 1}
                  onEdit={() => onEditTask(task)}
                  onComplete={() => onCompleteTask(task)}
                  onDelete={() => onDeleteTask(task.id)}
                />
              ))}

              {/* Add Task Row */}
              <AddTaskRow isDark={isDark} onClick={onCreateTask} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

