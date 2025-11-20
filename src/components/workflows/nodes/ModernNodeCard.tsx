import React from 'react';
import { Handle, Position } from 'reactflow';
import { MoreHorizontal, LucideIcon } from 'lucide-react';
import { StatusIndicator } from '../StatusIndicator';
import { mapTestStatusToNodeStatus } from '../utils';

// Style constants with light/dark mode support
export const NODE_STYLES = "bg-white dark:bg-[#1e1e1e] border border-gray-300 dark:border-zinc-800 rounded-lg shadow-xl min-w-[200px] max-w-[300px] overflow-hidden transition-all duration-300 hover:border-gray-400 dark:hover:border-zinc-600";
export const NODE_SELECTED_STYLES = "ring-2 ring-blue-500/50 border-blue-500 shadow-blue-500/20";
export const HANDLE_STYLES = "w-3 h-3 bg-gray-400 dark:bg-zinc-500 border-2 border-white dark:border-[#1e1e1e] hover:bg-blue-500 transition-colors z-50";

// Detached Handle Component
interface DetachedHandleProps {
  type: 'source' | 'target';
  position: Position;
  id: string;
  icon: LucideIcon;
  label?: string;
  tooltip?: string; // Detailed tooltip explanation
  top?: string | number;
  bottom?: string | number;
  left?: string | number;
  right?: string | number;
  color?: string;
}

export const DetachedHandle: React.FC<DetachedHandleProps> = ({
  type,
  position,
  id,
  icon: Icon,
  label,
  tooltip,
  top,
  bottom,
  left,
  right,
  color = 'text-gray-400 dark:text-zinc-500'
}) => {
  const isLeft = position === Position.Left;
  const isRight = position === Position.Right;
  const isTop = position === Position.Top;
  const isBottom = position === Position.Bottom;

  // Calculate position
  const positionStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 50,
  };

  // Build transform string
  let transformParts: string[] = [];

  // Set explicit positions if provided
  if (top !== undefined) {
    positionStyle.top = typeof top === 'string' ? top : `${top}px`;
    transformParts.push('translateY(-50%)');
  }
  if (bottom !== undefined) {
    positionStyle.bottom = typeof bottom === 'string' ? bottom : `${bottom}px`;
    transformParts.push('translateY(50%)');
  }
  if (left !== undefined) {
    positionStyle.left = typeof left === 'string' ? left : `${left}px`;
    if (top === undefined && bottom === undefined) {
      transformParts.push('translateX(-50%)');
    }
  }
  if (right !== undefined) {
    positionStyle.right = typeof right === 'string' ? right : `${right}px`;
    if (top === undefined && bottom === undefined) {
      transformParts.push('translateX(50%)');
    }
  }

  // Default positioning based on position prop - position further out to avoid clipping
  if (isLeft && left === undefined) {
    positionStyle.left = '-20px';
    if (top === undefined && bottom === undefined) {
      positionStyle.top = '50%';
      transformParts.push('translateY(-50%)');
    } else if (top !== undefined) {
      transformParts.push('translateY(-50%)');
    } else if (bottom !== undefined) {
      transformParts.push('translateY(50%)');
    }
  }
  if (isRight && right === undefined) {
    positionStyle.right = '-20px';
    if (top === undefined && bottom === undefined) {
      positionStyle.top = '50%';
      transformParts.push('translateY(-50%)');
    } else if (top !== undefined) {
      transformParts.push('translateY(-50%)');
    } else if (bottom !== undefined) {
      transformParts.push('translateY(50%)');
    }
  }
  if (isTop && top === undefined) {
    positionStyle.top = '-20px';
    if (left === undefined && right === undefined) {
      positionStyle.left = '50%';
      transformParts.push('translateX(-50%)');
    }
  }
  if (isBottom && bottom === undefined) {
    positionStyle.bottom = '-20px';
    if (left === undefined && right === undefined) {
      positionStyle.left = '50%';
      transformParts.push('translateX(-50%)');
    }
  }

  // Apply transform
  if (transformParts.length > 0) {
    positionStyle.transform = transformParts.join(' ');
  }

  return (
    <div style={positionStyle} className="group pointer-events-none" title={tooltip || label}>
      <Handle
        type={type}
        position={position}
        id={id}
        className="!w-8 !h-8 !bg-transparent !border-0 !rounded-full !p-0 pointer-events-auto"
        style={{ 
          left: '50%', 
          top: '50%', 
          transform: 'translate(-50%, -50%)',
          width: '32px',
          height: '32px'
        }}
      />
      <div className={`
        w-7 h-7 rounded-full 
        bg-white dark:bg-[#1e1e1e] 
        border border-gray-300 dark:border-zinc-700 
        shadow-sm
        flex items-center justify-center
        transition-all duration-200
        group-hover:border-gray-400 dark:group-hover:border-zinc-500
        group-hover:shadow-md
        group-hover:scale-110
        pointer-events-none
        ${color}
      `}>
        <Icon size={12} className="transition-transform" />
      </div>
      {(label || tooltip) && (
        <div className={`
          absolute whitespace-normal max-w-[200px] text-[9px] font-medium
          bg-white dark:bg-[#1e1e1e] border border-gray-300 dark:border-zinc-700
          rounded-md px-2 py-1.5 shadow-lg
          ${isLeft ? 'right-full mr-2' : ''}
          ${isRight ? 'left-full ml-2' : ''}
          ${isTop ? 'bottom-full mb-2' : ''}
          ${isBottom ? 'top-full mt-2' : ''}
          ${isLeft || isRight ? 'top-1/2 -translate-y-1/2' : 'left-1/2 -translate-x-1/2'}
          text-gray-700 dark:text-zinc-300
          opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50
        `}>
          {label && <div className="font-semibold mb-0.5">{label}</div>}
          {tooltip && <div className="text-[8px] text-gray-500 dark:text-zinc-500 leading-relaxed">{tooltip}</div>}
        </div>
      )}
    </div>
  );
};

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
    <div 
      className={`
        ${NODE_STYLES} 
        ${selected ? NODE_SELECTED_STYLES : ''}
        ${isActive ? 'border-yellow-400 shadow-yellow-400/20' : ''}
        ${isFailed ? 'border-red-500 shadow-red-500/20' : ''}
        ${isSuccess ? 'border-green-500 shadow-green-500/20' : ''}
        cursor-pointer
        ${className}
      `}
      title="Click to edit"
      style={{ overflow: 'visible' }}
    >
      {/* Handles */}
      {handleLeft && (
        <Handle 
          type="target" 
          position={Position.Left} 
          className={HANDLE_STYLES}
          style={{ left: -6 }}
        />
      )}
      {handles}
      {handleRight && (
        <Handle 
          type="source" 
          position={Position.Right} 
          className={HANDLE_STYLES}
          style={{ right: -6 }}
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
