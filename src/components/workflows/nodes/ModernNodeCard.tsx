import React from 'react';
import { Handle, Position } from 'reactflow';
import { MoreHorizontal } from 'lucide-react';
import { StatusIndicator } from '../StatusIndicator';
import { mapTestStatusToNodeStatus } from '../utils';

// Style constants with light/dark mode support
export const NODE_STYLES = "bg-white dark:bg-[#1e1e1e] border border-gray-300 dark:border-zinc-800 rounded-lg shadow-xl min-w-[200px] max-w-[300px] overflow-hidden transition-all duration-300 hover:border-gray-400 dark:hover:border-zinc-600";
export const NODE_SELECTED_STYLES = "ring-2 ring-blue-500/50 border-blue-500 shadow-blue-500/20";
export const HANDLE_STYLES = "w-3 h-3 bg-gray-400 dark:bg-zinc-500 border-2 border-white dark:border-[#1e1e1e] hover:bg-blue-500 transition-colors";

interface ModernNodeCardProps {
  selected?: boolean;
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  color?: string; // Text color for header/icon
  headerAction?: React.ReactNode;
  status?: string;
  children?: React.ReactNode;
  handleLeft?: boolean;
  handleRight?: boolean;
  handles?: React.ReactNode; // For custom handles
  className?: string;
  badge?: React.ReactNode;
}

export const ModernNodeCard: React.FC<ModernNodeCardProps> = ({
  selected,
  icon: Icon,
  title,
  subtitle,
  color = "text-gray-600 dark:text-zinc-400",
  headerAction,
  status,
  children,
  handleLeft = true,
  handleRight = true,
  handles,
  className = "",
  badge
}) => {
  const nodeStatus = status ? mapTestStatusToNodeStatus(status) : 'idle';
  const isActive = status === 'active';
  const isFailed = status === 'failed';
  const isSuccess = status === 'success';

  // Extract base color for icon background (remove text- prefix and add bg-)
  const iconBgColor = color.includes('text-') 
    ? color.replace('text-', 'bg-').replace(/\s+dark:text-\S+/g, '') + '/10 dark:' + color.replace('text-', 'bg-').replace(/\s+dark:text-\S+/g, '') + '/10'
    : 'bg-gray-100 dark:bg-zinc-800/50';

  return (
    <div className={`
      ${NODE_STYLES} 
      ${selected ? NODE_SELECTED_STYLES : ''}
      ${isActive ? 'border-yellow-400 shadow-yellow-400/20' : ''}
      ${isFailed ? 'border-red-500 shadow-red-500/20' : ''}
      ${isSuccess ? 'border-green-500 shadow-green-500/20' : ''}
      ${className}
    `}>
      {/* Handles */}
      {handleLeft && (
        <Handle 
          type="target" 
          position={Position.Left} 
          className={HANDLE_STYLES}
        />
      )}
      {handles}
      {handleRight && (
        <Handle 
          type="source" 
          position={Position.Right} 
          className={HANDLE_STYLES}
        />
      )}

      {/* Status Indicator */}
      {nodeStatus !== 'idle' && (
        <StatusIndicator 
          status={nodeStatus}
          variant="badge"
          position="top-right"
          size="sm"
          className="absolute -top-2 -right-2 z-10"
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-[#252525]">
        <div className={`flex items-center gap-2 text-xs font-semibold ${color}`}>
          <div className={`p-1 rounded ${iconBgColor}`}>
            <Icon size={14} />
          </div>
          <div className="flex flex-col">
            <span className="text-gray-900 dark:text-zinc-200 leading-tight">{title}</span>
            {subtitle && <span className="text-[10px] text-gray-500 dark:text-zinc-500 font-normal">{subtitle}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
            {badge}
            {headerAction || <MoreHorizontal size={14} className="text-gray-400 dark:text-zinc-600 cursor-pointer hover:text-gray-600 dark:hover:text-zinc-400" />}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-[#1e1e1e]">
        {children}
      </div>
    </div>
  );
};
