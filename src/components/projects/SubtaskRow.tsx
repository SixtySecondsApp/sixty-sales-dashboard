import React from 'react';
import { motion } from 'framer-motion';
import { format, isToday, isTomorrow, isPast, isYesterday } from 'date-fns';
import { CheckCircle2, Circle } from 'lucide-react';

import { Task } from '@/lib/database/models';
import { useSubtasks } from '@/lib/hooks/useSubtasks';
import { CompanyTaskGroup, accentColors, priorityConfigs } from './types';

interface SubtaskRowProps {
  subtask: Task;
  isDark: boolean;
  accentColor: CompanyTaskGroup['accentColor'];
  isLast: boolean;
}

export function SubtaskRow({
  subtask,
  isDark,
  accentColor,
  isLast
}: SubtaskRowProps) {
  const accent = accentColors[accentColor];
  
  // We would need the parent task ID to use the hook properly for updates
  // For now, this is a display-only component
  
  const formatDueDate = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isYesterday(date)) return 'Yesterday';
    
    return format(date, 'MMM d');
  };

  const getDueDateColor = () => {
    if (!subtask.due_date) return isDark ? 'text-gray-500' : 'text-gray-400';
    const date = new Date(subtask.due_date);
    
    if (subtask.completed || subtask.status === 'completed') {
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

  const isComplete = subtask.completed || subtask.status === 'completed';
  const priorityConfig = priorityConfigs[subtask.priority];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-center backdrop-blur-sm group
                  ${isDark
                    ? 'bg-gray-900/40'
                    : 'bg-gray-50/40'}
                  ${!isLast ? (isDark ? 'border-b border-gray-800/30' : 'border-b border-gray-200/30') : ''}`}
    >
      {/* Checkbox column */}
      <div className="w-12 flex-shrink-0 flex items-center justify-center">
        <input
          type="checkbox"
          checked={isComplete}
          readOnly
          className={`w-4 h-4 rounded cursor-pointer
                     ${isDark
                       ? 'border-gray-600 bg-gray-800/50'
                       : 'border-gray-300 bg-white'}
                     checked:bg-gradient-to-r checked:from-blue-500 checked:to-purple-500
                     focus:ring-2 focus:ring-blue-500/50`}
        />
      </div>

      {/* Indent spacer */}
      <div className="w-10 flex-shrink-0" />

      {/* Subtask Name */}
      <div className="flex-1 min-w-[280px] px-3 py-2.5 flex items-center gap-3 pl-6">
        {/* Sub-accent bar (thinner) */}
        <div className={`w-0.5 h-6 bg-gradient-to-b ${accent.gradient} rounded-full opacity-50`} />
        
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {/* Subtask icon */}
          {isComplete ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-500" />
          ) : (
            <Circle className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
          )}
          
          <span className={`text-sm transition-colors
                           ${isComplete ? 'line-through opacity-60' : ''}
                           ${isDark ? 'text-gray-300 group-hover:text-white' : 'text-gray-700 group-hover:text-gray-900'}`}>
            {subtask.title}
          </span>
        </div>
      </div>

      {/* Assignee - empty for subtasks in this view */}
      <div className={`w-32 flex-shrink-0 border-l ${isDark ? 'border-gray-800/30' : 'border-gray-200/30'}`}>
        <div className="h-10" />
      </div>

      {/* Priority */}
      <div className={`w-28 flex-shrink-0 border-l ${isDark ? 'border-gray-800/30' : 'border-gray-200/30'}`}>
        <div className="h-10 flex items-center justify-center">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${priorityConfig.bgClass} ${priorityConfig.textClass}`}>
            {priorityConfig.label}
          </span>
        </div>
      </div>

      {/* Due Date */}
      <div className={`w-32 flex-shrink-0 border-l ${isDark ? 'border-gray-800/30' : 'border-gray-200/30'}`}>
        <div className={`h-10 flex items-center justify-center text-xs font-medium ${getDueDateColor()}`}>
          {formatDueDate(subtask.due_date)}
        </div>
      </div>

      {/* Status indicator (simplified for subtasks) */}
      <div className={`w-32 flex-shrink-0 border-l ${isDark ? 'border-gray-800/30' : 'border-gray-200/30'}`}>
        <div className="h-10 flex items-center justify-center">
          <span className={`text-xs font-medium ${
            isComplete 
              ? 'text-emerald-400' 
              : (isDark ? 'text-gray-500' : 'text-gray-400')
          }`}>
            {isComplete ? 'Done' : 'Pending'}
          </span>
        </div>
      </div>

      {/* Actions column - empty for subtasks */}
      <div className={`w-16 flex-shrink-0 border-l ${isDark ? 'border-gray-800/30' : 'border-gray-200/30'}`} />
    </motion.div>
  );
}

