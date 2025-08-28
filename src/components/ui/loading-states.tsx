import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Loading Spinner Component
export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  color?: 'blue' | 'green' | 'red' | 'gray' | 'white';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className = '',
  color = 'blue'
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6', 
    lg: 'w-8 h-8'
  };

  const colorClasses = {
    blue: 'text-blue-500',
    green: 'text-green-500',
    red: 'text-red-500',
    gray: 'text-gray-500',
    white: 'text-white'
  };

  return (
    <Loader2 
      className={cn(
        'animate-spin', 
        sizeClasses[size], 
        colorClasses[color],
        className
      )} 
    />
  );
};

// Button Loading State
export interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  loading = false,
  loadingText = 'Loading...',
  variant = 'primary',
  size = 'md',
  disabled,
  className = '',
  children,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed';
  
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
    secondary: 'bg-gray-700 hover:bg-gray-600 text-white focus:ring-gray-500',
    outline: 'border border-gray-600 bg-transparent hover:bg-gray-800 text-gray-200 focus:ring-gray-500',
    ghost: 'bg-transparent hover:bg-gray-800 text-gray-200 focus:ring-gray-500'
  };

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  return (
    <button
      disabled={loading || disabled}
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        (loading || disabled) && 'opacity-60',
        className
      )}
      {...props}
    >
      {loading ? (
        <>
          <LoadingSpinner size="sm" color="white" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  );
};

// Skeleton Loading Component
export interface SkeletonProps {
  className?: string;
  height?: string | number;
  width?: string | number;
  rounded?: boolean;
  animation?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  className = '',
  height,
  width, 
  rounded = false,
  animation = true
}) => {
  const style = {
    height: typeof height === 'number' ? `${height}px` : height,
    width: typeof width === 'number' ? `${width}px` : width,
  };

  return (
    <div
      style={style}
      className={cn(
        'bg-gray-700/50',
        rounded ? 'rounded-full' : 'rounded-lg',
        animation && 'animate-pulse',
        className
      )}
    />
  );
};

// Card Loading State
export const LoadingCard: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('p-6 bg-gray-800/50 rounded-xl border border-gray-700/50', className)}>
    <div className="flex items-center gap-3 mb-4">
      <Skeleton width={40} height={40} rounded />
      <div className="flex-1 space-y-2">
        <Skeleton height={16} width="60%" />
        <Skeleton height={12} width="40%" />
      </div>
    </div>
    <div className="space-y-3">
      <Skeleton height={12} width="100%" />
      <Skeleton height={12} width="80%" />
      <Skeleton height={12} width="70%" />
    </div>
    <div className="flex gap-2 mt-4">
      <Skeleton height={32} width={80} />
      <Skeleton height={32} width={100} />
    </div>
  </div>
);

// Table Loading State
export const LoadingTable: React.FC<{ rows?: number; cols?: number; className?: string }> = ({ 
  rows = 5, 
  cols = 4,
  className 
}) => (
  <div className={cn('space-y-4', className)}>
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {/* Headers */}
      {Array(cols).fill(0).map((_, i) => (
        <Skeleton key={`header-${i}`} height={16} width="80%" />
      ))}
    </div>
    {/* Rows */}
    {Array(rows).fill(0).map((_, rowIndex) => (
      <div key={`row-${rowIndex}`} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array(cols).fill(0).map((_, colIndex) => (
          <Skeleton key={`cell-${rowIndex}-${colIndex}`} height={14} width="60%" />
        ))}
      </div>
    ))}
  </div>
);

// Global Loading Overlay
export interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  className?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  isVisible, 
  message = 'Loading...', 
  className 
}) => (
  <AnimatePresence>
    {isVisible && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={cn(
          'fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center',
          className
        )}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-8 text-center"
        >
          <LoadingSpinner size="lg" color="blue" className="mx-auto mb-4" />
          <p className="text-white font-medium">{message}</p>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// Progress Bar Component
export interface ProgressBarProps {
  value: number;
  max?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'blue' | 'green' | 'red' | 'yellow';
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  showLabel = false,
  size = 'md',
  variant = 'blue',
  className
}) => {
  const percentage = Math.min((value / max) * 100, 100);
  
  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  const variantClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500', 
    red: 'bg-red-500',
    yellow: 'bg-yellow-500'
  };

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex justify-between text-sm text-gray-400 mb-1">
          <span>Progress</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      <div className={cn('w-full bg-gray-700 rounded-full overflow-hidden', sizeClasses[size])}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className={cn('h-full rounded-full', variantClasses[variant])}
        />
      </div>
    </div>
  );
};

// Status Message Component
export interface StatusMessageProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  isVisible: boolean;
  onClose?: () => void;
  autoClose?: boolean;
  autoCloseDelay?: number;
  className?: string;
}

export const StatusMessage: React.FC<StatusMessageProps> = ({
  type,
  message,
  isVisible,
  onClose,
  autoClose = false,
  autoCloseDelay = 3000,
  className
}) => {
  const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    warning: AlertCircle,
    info: Info
  };

  const colorClasses = {
    success: 'bg-green-500/10 border-green-500/30 text-green-400',
    error: 'bg-red-500/10 border-red-500/30 text-red-400',
    warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-400'
  };

  const Icon = icons[type];

  React.useEffect(() => {
    if (autoClose && isVisible && onClose) {
      const timer = setTimeout(onClose, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [autoClose, isVisible, onClose, autoCloseDelay]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={cn(
            'flex items-center gap-3 p-4 rounded-lg border backdrop-blur-sm',
            colorClasses[type],
            className
          )}
        >
          <Icon className="w-5 h-5 flex-shrink-0" />
          <span className="flex-1 text-sm font-medium">{message}</span>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Lazy Loading Container
export interface LazyContainerProps {
  children: React.ReactNode;
  loading: boolean;
  error?: string | null;
  retry?: () => void;
  skeleton?: React.ReactNode;
  className?: string;
}

export const LazyContainer: React.FC<LazyContainerProps> = ({
  children,
  loading,
  error,
  retry,
  skeleton,
  className
}) => {
  if (loading) {
    return (
      <div className={cn('animate-pulse', className)}>
        {skeleton || <LoadingCard />}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('text-center p-8', className)}>
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">Failed to load</h3>
        <p className="text-gray-400 mb-4">{error}</p>
        {retry && (
          <LoadingButton variant="outline" onClick={retry}>
            Try Again
          </LoadingButton>
        )}
      </div>
    );
  }

  return <div className={className}>{children}</div>;
};