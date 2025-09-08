import React from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  AlertCircle,
  Clock,
  Play,
  AlertTriangle,
  Loader,
  XCircle,
  Pause,
  Activity,
  Zap
} from 'lucide-react';

// Status types for workflow nodes
export type NodeStatus = 
  | 'idle'
  | 'pending'
  | 'initializing'
  | 'running'
  | 'processing'
  | 'executing'
  | 'finalizing'
  | 'completed'
  | 'success'
  | 'failed'
  | 'error'
  | 'warning'
  | 'skipped'
  | 'paused'
  | 'waiting';

// Configuration for each status
const statusConfig: Record<NodeStatus, {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  pulseColor?: string;
  animate?: boolean;
  label: string;
}> = {
  idle: {
    icon: Clock,
    color: 'text-gray-400',
    bgColor: 'bg-gray-900/50',
    borderColor: 'border-gray-600',
    label: 'Idle'
  },
  pending: {
    icon: Clock,
    color: 'text-gray-400',
    bgColor: 'bg-gray-800/50',
    borderColor: 'border-gray-500',
    label: 'Pending'
  },
  initializing: {
    icon: Loader,
    color: 'text-blue-400',
    bgColor: 'bg-blue-900/30',
    borderColor: 'border-blue-500',
    pulseColor: 'shadow-blue-500/50',
    animate: true,
    label: 'Initializing'
  },
  running: {
    icon: Play,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-900/30',
    borderColor: 'border-yellow-500',
    pulseColor: 'shadow-yellow-500/50',
    animate: true,
    label: 'Running'
  },
  processing: {
    icon: Activity,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-900/30',
    borderColor: 'border-yellow-500',
    pulseColor: 'shadow-yellow-500/50',
    animate: true,
    label: 'Processing'
  },
  executing: {
    icon: Zap,
    color: 'text-orange-400',
    bgColor: 'bg-orange-900/30',
    borderColor: 'border-orange-500',
    pulseColor: 'shadow-orange-500/50',
    animate: true,
    label: 'Executing'
  },
  finalizing: {
    icon: Activity,
    color: 'text-blue-400',
    bgColor: 'bg-blue-900/30',
    borderColor: 'border-blue-500',
    animate: true,
    label: 'Finalizing'
  },
  completed: {
    icon: CheckCircle,
    color: 'text-green-400',
    bgColor: 'bg-green-900/30',
    borderColor: 'border-green-500',
    label: 'Completed'
  },
  success: {
    icon: CheckCircle,
    color: 'text-green-500',
    bgColor: 'bg-green-900/30',
    borderColor: 'border-green-500',
    label: 'Success'
  },
  failed: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-900/30',
    borderColor: 'border-red-500',
    label: 'Failed'
  },
  error: {
    icon: AlertCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-900/30',
    borderColor: 'border-red-500',
    label: 'Error'
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-500',
    bgColor: 'bg-amber-900/30',
    borderColor: 'border-amber-500',
    label: 'Warning'
  },
  skipped: {
    icon: AlertTriangle,
    color: 'text-gray-500',
    bgColor: 'bg-gray-800/30',
    borderColor: 'border-gray-600',
    label: 'Skipped'
  },
  paused: {
    icon: Pause,
    color: 'text-blue-400',
    bgColor: 'bg-blue-900/30',
    borderColor: 'border-blue-500',
    label: 'Paused'
  },
  waiting: {
    icon: Clock,
    color: 'text-blue-400',
    bgColor: 'bg-blue-900/30',
    borderColor: 'border-blue-500',
    animate: true,
    label: 'Waiting'
  }
};

interface StatusIndicatorProps {
  status: NodeStatus;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'badge' | 'border' | 'pulse' | 'ring';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  showLabel?: boolean;
  progress?: number; // 0-100
  tooltip?: string;
  className?: string;
  onClick?: () => void;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  size = 'sm',
  variant = 'badge',
  position = 'top-right',
  showLabel = false,
  progress,
  tooltip,
  className = '',
  onClick
}) => {
  const config = statusConfig[status];
  const IconComponent = config.icon;

  // Size configurations
  const sizeClasses = {
    xs: { container: 'w-4 h-4', icon: 'w-2 h-2', text: 'text-[8px]', ring: 'w-5 h-5' },
    sm: { container: 'w-5 h-5', icon: 'w-3 h-3', text: 'text-[9px]', ring: 'w-6 h-6' },
    md: { container: 'w-6 h-6', icon: 'w-4 h-4', text: 'text-[10px]', ring: 'w-8 h-8' },
    lg: { container: 'w-8 h-8', icon: 'w-5 h-5', text: 'text-xs', ring: 'w-10 h-10' }
  };

  // Position configurations
  const positionClasses = {
    'top-left': 'absolute -top-1 -left-1',
    'top-right': 'absolute -top-1 -right-1',
    'bottom-left': 'absolute -bottom-1 -left-1',
    'bottom-right': 'absolute -bottom-1 -right-1',
    'center': 'absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2'
  };

  const sizes = sizeClasses[size];
  const positionClass = positionClasses[position];

  // Badge variant - floating indicator with icon
  if (variant === 'badge') {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className={`${positionClass} ${className}`}
        title={tooltip || config.label}
        onClick={onClick}
      >
        <div
          className={`
            ${sizes.container} 
            ${config.bgColor} 
            ${config.borderColor}
            rounded-full border flex items-center justify-center
            ${config.animate ? 'animate-pulse' : ''}
            ${onClick ? 'cursor-pointer hover:scale-110 transition-transform' : ''}
            ${config.pulseColor ? `shadow-lg ${config.pulseColor}` : ''}
          `}
        >
          <IconComponent className={`${sizes.icon} ${config.color}`} />
        </div>
        {showLabel && (
          <div className={`absolute top-full left-1/2 transform -translate-x-1/2 mt-1 ${sizes.text} ${config.color} whitespace-nowrap font-medium`}>
            {config.label}
          </div>
        )}
      </motion.div>
    );
  }

  // Border variant - changes node border color
  if (variant === 'border') {
    return (
      <div
        className={`
          absolute inset-0 rounded-lg pointer-events-none
          ${config.borderColor} border-2
          ${config.animate ? 'animate-pulse' : ''}
          ${className}
        `}
        style={{
          boxShadow: config.pulseColor ? `0 0 20px ${config.pulseColor}` : undefined
        }}
      />
    );
  }

  // Pulse variant - animated rings
  if (variant === 'pulse') {
    return (
      <div className={`${positionClass} ${className}`} title={tooltip || config.label}>
        {config.animate && (
          <>
            <motion.div
              className={`absolute ${sizes.ring} ${config.bgColor} rounded-full opacity-75`}
              animate={{
                scale: [1, 1.5, 1.5],
                opacity: [0.7, 0, 0]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeOut"
              }}
            />
            <motion.div
              className={`absolute ${sizes.ring} ${config.bgColor} rounded-full opacity-75`}
              animate={{
                scale: [1, 1.3, 1.3],
                opacity: [0.5, 0, 0]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeOut",
                delay: 0.5
              }}
            />
          </>
        )}
        <div
          className={`
            relative ${sizes.container} 
            ${config.bgColor} 
            ${config.borderColor}
            rounded-full border flex items-center justify-center
            ${onClick ? 'cursor-pointer hover:scale-110 transition-transform' : ''}
          `}
          onClick={onClick}
        >
          <IconComponent className={`${sizes.icon} ${config.color}`} />
        </div>
      </div>
    );
  }

  // Ring variant - progress ring with percentage
  if (variant === 'ring') {
    const circumference = 2 * Math.PI * 18; // radius = 18
    const strokeDashoffset = circumference - (progress || 0) / 100 * circumference;

    return (
      <div 
        className={`${positionClass} ${className}`}
        title={tooltip || `${config.label}${progress !== undefined ? ` - ${progress}%` : ''}`}
      >
        <div className="relative">
          <svg
            className={`${sizes.ring} transform -rotate-90`}
            viewBox="0 0 40 40"
          >
            {/* Background ring */}
            <circle
              cx="20"
              cy="20"
              r="18"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              className="text-gray-700"
            />
            {/* Progress ring */}
            {progress !== undefined && (
              <motion.circle
                cx="20"
                cy="20"
                r="18"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className={config.color}
                strokeLinecap="round"
              />
            )}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <IconComponent className={`${sizes.icon} ${config.color}`} />
          </div>
        </div>
        {showLabel && (
          <div className={`text-center mt-1 ${sizes.text} ${config.color} font-medium`}>
            {progress !== undefined ? `${progress}%` : config.label}
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default StatusIndicator;