import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, isTomorrow, isPast, isYesterday } from 'date-fns';
import {
  ChevronRight,
  Star,
  MessageSquare,
  Edit,
  Trash2,
  Video,
  ExternalLink
} from 'lucide-react';

import { Task } from '@/lib/database/models';
import { useSubtasks } from '@/lib/hooks/useSubtasks';
import { CompanyTaskGroup, accentColors, priorityConfigs } from './types';
import { StatusCell } from './StatusCell';
import { AvatarCell } from './AvatarCell';
import { SubtaskRow } from './SubtaskRow';

interface ProjectTaskRowProps {
  task: Task;
  isDark: boolean;
  accentColor: CompanyTaskGroup['accentColor'];
  isLast: boolean;
  onEdit: () => void;
  onComplete: () => void;
  onDelete: () => void;
}

export function ProjectTaskRow({
  task,
  isDark,
  accentColor,
  isLast,
  onEdit,
  onComplete,
  onDelete
}: ProjectTaskRowProps) {
  const [expanded, setExpanded] = useState(false);
  const accent = accentColors[accentColor];

  // Fetch subtasks when expanded
  const { subtasks, isLoading: subtasksLoading } = useSubtasks({
    parentTaskId: task.id,
    enabled: expanded
  });

  const hasSubtasks = subtasks && subtasks.length > 0;
  const hasMeetingLink = task.meeting_action_item_id || task.meeting_id;

  // Format due date
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

  const priorityConfig = priorityConfigs[task.priority];

  return (
    <>
      <motion.div
        layout
        className={`flex items-center backdrop-blur-sm group transition-colors
                   ${isDark
                     ? 'bg-gray-900/60 hover:bg-gray-800/40'
                     : 'bg-white/60 hover:bg-gray-50/40'}
                   ${!isLast ? (isDark ? 'border-b border-gray-800/50' : 'border-b border-gray-200/50') : ''}`}
      >
        {/* Checkbox */}
        <div className="w-12 flex-shrink-0 flex items-center justify-center">
          <input
            type="checkbox"
            checked={task.completed || task.status === 'completed'}
            onChange={onComplete}
            className={`w-4 h-4 rounded cursor-pointer transition-colors
                       ${isDark
                         ? 'border-gray-600 bg-gray-800/50'
                         : 'border-gray-300 bg-white'}
                       checked:bg-gradient-to-r checked:from-blue-500 checked:to-purple-500
                       focus:ring-2 focus:ring-blue-500/50`}
          />
        </div>

        {/* Expand Toggle */}
        <div className="w-10 flex-shrink-0 flex items-center justify-center">
          <motion.button
            onClick={() => setExpanded(!expanded)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-200/50'}`}
          >
            <motion.div
              animate={{ rotate: expanded ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
            </motion.div>
          </motion.button>
        </div>

        {/* Task Name */}
        <div className="flex-1 min-w-[280px] px-3 py-3 flex items-center gap-3">
          {/* Accent bar */}
          <div className={`w-1 h-8 bg-gradient-to-b ${accent.gradient} rounded-full shadow-lg shadow-current/30`} />
          
          <div className="flex-1 min-w-0">
            <motion.span
              whileHover={{ color: '#60a5fa' }}
              onClick={onEdit}
              className={`text-sm font-medium cursor-pointer truncate block
                         ${task.completed ? 'line-through opacity-60' : ''}
                         ${isDark ? 'text-gray-200' : 'text-gray-800'}`}
            >
              {task.title}
            </motion.span>
            {task.description && (
              <p className={`text-xs truncate mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {task.description}
              </p>
            )}
          </div>

          {/* Meeting indicator */}
          {hasMeetingLink && (
            <div className="flex-shrink-0">
              <Video className="w-4 h-4 text-purple-400" />
            </div>
          )}

          {/* Hover actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={(e) => { e.stopPropagation(); }}
              className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-200/50'}`}
            >
              <Star className={`w-3.5 h-3.5 hover:text-amber-400 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-200/50'}`}
            >
              <Edit className={`w-3.5 h-3.5 hover:text-blue-400 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
            </button>
          </div>
        </div>

        {/* Assignee */}
        <div className={`w-32 flex-shrink-0 px-2 border-l ${isDark ? 'border-gray-800/30' : 'border-gray-200/30'}`}>
          <div className="h-12 flex items-center justify-center">
            <AvatarCell person={task.assignee} size="sm" isDark={isDark} />
          </div>
        </div>

        {/* Priority */}
        <div className={`w-28 flex-shrink-0 px-2 border-l ${isDark ? 'border-gray-800/30' : 'border-gray-200/30'}`}>
          <div className="h-12 flex items-center justify-center">
            <span className={`px-2 py-1 rounded-md text-xs font-medium ${priorityConfig.bgClass} ${priorityConfig.textClass}`}>
              {priorityConfig.label}
            </span>
          </div>
        </div>

        {/* Due Date */}
        <div className={`w-32 flex-shrink-0 px-2 border-l ${isDark ? 'border-gray-800/30' : 'border-gray-200/30'}`}>
          <div className={`h-12 flex items-center justify-center text-xs font-medium ${getDueDateColor()}`}>
            {formatDueDate(task.due_date)}
          </div>
        </div>

        {/* Status */}
        <div className={`w-32 flex-shrink-0 px-2 border-l ${isDark ? 'border-gray-800/30' : 'border-gray-200/30'}`}>
          <div className="h-12 flex items-center justify-center">
            <StatusCell status={task.status} isDark={isDark} size="sm" />
          </div>
        </div>

        {/* Actions */}
        <div className={`w-16 flex-shrink-0 border-l ${isDark ? 'border-gray-800/30' : 'border-gray-200/30'}`}>
          <div className="h-12 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-red-500/20' : 'hover:bg-red-100'}`}
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Subtasks */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {subtasksLoading ? (
              <div className={`px-8 py-4 ${isDark ? 'bg-gray-900/40' : 'bg-gray-50/40'}`}>
                <div className="animate-pulse flex items-center gap-3">
                  <div className={`w-4 h-4 rounded ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
                  <div className={`h-4 flex-1 rounded ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
                </div>
              </div>
            ) : hasSubtasks ? (
              subtasks.map((subtask, index) => (
                <SubtaskRow
                  key={subtask.id}
                  subtask={subtask}
                  isDark={isDark}
                  accentColor={accentColor}
                  isLast={index === subtasks.length - 1}
                />
              ))
            ) : (
              <div className={`px-16 py-3 text-xs ${isDark ? 'text-gray-500 bg-gray-900/40' : 'text-gray-400 bg-gray-50/40'}`}>
                No subtasks
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

