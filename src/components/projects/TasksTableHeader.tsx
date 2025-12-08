import React from 'react';
import {
  User,
  Flag,
  Calendar,
  CheckCircle2,
  Plus
} from 'lucide-react';

import { CompanyTaskGroup } from './types';

interface TasksTableHeaderProps {
  isDark: boolean;
  accentColor: CompanyTaskGroup['accentColor'];
}

export function TasksTableHeader({ isDark, accentColor }: TasksTableHeaderProps) {
  const columns = [
    { id: 'task', label: 'Task', icon: null, width: 'flex-1 min-w-[280px]' },
    { id: 'assignee', label: 'Assignee', icon: User, width: 'w-32' },
    { id: 'priority', label: 'Priority', icon: Flag, width: 'w-28' },
    { id: 'due', label: 'Due Date', icon: Calendar, width: 'w-32' },
    { id: 'status', label: 'Status', icon: CheckCircle2, width: 'w-32' },
  ];

  return (
    <div className={`flex items-center border-b backdrop-blur-sm sticky top-0 z-10
                    ${isDark
                      ? 'border-gray-800/50 bg-gray-900/60'
                      : 'border-gray-200/50 bg-white/60'}`}>
      {/* Checkbox column */}
      <div className="w-12 flex-shrink-0" />
      
      {/* Expand column */}
      <div className="w-10 flex-shrink-0" />

      {/* Data columns */}
      {columns.map((col, index) => (
        <div
          key={col.id}
          className={`${col.width} flex-shrink-0 px-3 py-3
                      ${index > 0 ? (isDark ? 'border-l border-gray-800/30' : 'border-l border-gray-200/30') : ''}`}
        >
          <span className={`text-xs font-semibold uppercase tracking-wider 
                           flex items-center gap-1.5
                           ${index === 0 ? 'justify-start' : 'justify-center'}
                           ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {col.icon && <col.icon className={`w-3.5 h-3.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />}
            {col.label}
          </span>
        </div>
      ))}

      {/* Actions column */}
      <div className={`w-16 flex-shrink-0 border-l ${isDark ? 'border-gray-800/30' : 'border-gray-200/30'}`}>
        <div className="flex items-center justify-center py-3">
          <button className={`p-1 rounded transition-colors
                             ${isDark ? 'text-gray-500 hover:text-blue-400' : 'text-gray-400 hover:text-blue-500'}`}>
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

