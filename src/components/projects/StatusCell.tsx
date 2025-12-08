import React from 'react';
import { motion } from 'framer-motion';
import { Task } from '@/lib/database/models';
import { statusConfigs, StatusConfig } from './types';

interface StatusCellProps {
  status: Task['status'];
  isDark?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function StatusCell({ 
  status, 
  isDark = true, 
  size = 'md',
  showLabel = true 
}: StatusCellProps) {
  const config = statusConfigs[status];
  
  if (!config) return <div className="h-10 w-full" />;

  const sizeClasses = {
    sm: 'h-7 text-[10px] px-2',
    md: 'h-10 text-xs px-3',
    lg: 'h-12 text-sm px-4'
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`w-full flex items-center justify-center font-semibold 
                  cursor-pointer transition-all duration-300 rounded-md
                  ${sizeClasses[size]}
                  ${isDark 
                    ? `${config.bg} ${config.text} ${config.glow ? `shadow-lg ${config.glow}` : ''}` 
                    : `${config.bgLight} ${config.textLight}`}`}
    >
      {showLabel && config.label}
    </motion.div>
  );
}

// Compact status indicator (just a dot)
export function StatusDot({ status, isDark = true }: { status: Task['status']; isDark?: boolean }) {
  const config = statusConfigs[status];
  
  if (!config) return null;

  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-2 h-2 rounded-full ${
          isDark ? config.bg : config.bgLight.replace('border', '').replace('bg-', 'bg-')
        }`}
      />
      <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        {config.label}
      </span>
    </div>
  );
}

// Inline status badge
export function StatusBadge({ status, isDark = true }: { status: Task['status']; isDark?: boolean }) {
  const config = statusConfigs[status];
  
  if (!config) return null;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold
                  ${isDark 
                    ? `${config.bg} ${config.text}` 
                    : `${config.bgLight} ${config.textLight}`}`}
    >
      {config.label}
    </span>
  );
}

