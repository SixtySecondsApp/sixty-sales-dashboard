import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Notification types
export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

// Context for notifications
interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  // Convenience methods
  success: (title: string, message?: string, options?: Partial<Notification>) => string;
  error: (title: string, message?: string, options?: Partial<Notification>) => string;
  warning: (title: string, message?: string, options?: Partial<Notification>) => string;
  info: (title: string, message?: string, options?: Partial<Notification>) => string;
  loading: (title: string, message?: string, options?: Partial<Notification>) => string;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Provider component
export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Omit<Notification, 'id'>): string => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification: Notification = {
      id,
      duration: 5000, // Default 5 seconds
      ...notification,
    };

    setNotifications(prev => [...prev, newNotification]);

    // Auto-remove after duration (unless persistent)
    if (!newNotification.persistent && newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Convenience methods
  const success = useCallback((title: string, message?: string, options?: Partial<Notification>) => {
    return addNotification({ type: 'success', title, message, ...options });
  }, [addNotification]);

  const error = useCallback((title: string, message?: string, options?: Partial<Notification>) => {
    return addNotification({ 
      type: 'error', 
      title, 
      message, 
      duration: 8000, // Errors stay longer
      ...options 
    });
  }, [addNotification]);

  const warning = useCallback((title: string, message?: string, options?: Partial<Notification>) => {
    return addNotification({ type: 'warning', title, message, ...options });
  }, [addNotification]);

  const info = useCallback((title: string, message?: string, options?: Partial<Notification>) => {
    return addNotification({ type: 'info', title, message, ...options });
  }, [addNotification]);

  const loading = useCallback((title: string, message?: string, options?: Partial<Notification>) => {
    return addNotification({ 
      type: 'loading', 
      title, 
      message, 
      persistent: true, // Loading notifications don't auto-dismiss
      ...options 
    });
  }, [addNotification]);

  const contextValue: NotificationContextType = {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    success,
    error,
    warning,
    info,
    loading,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
};

// Hook to use notifications
export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

// Single notification component
const NotificationItem: React.FC<{ notification: Notification }> = ({ notification }) => {
  const { removeNotification } = useNotifications();

  const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
    loading: Loader2,
  };

  const colorClasses = {
    success: {
      container: 'bg-green-500/10 border-green-500/30',
      icon: 'text-green-400',
      title: 'text-green-300',
      message: 'text-green-200/80',
    },
    error: {
      container: 'bg-red-500/10 border-red-500/30',
      icon: 'text-red-400',
      title: 'text-red-300',
      message: 'text-red-200/80',
    },
    warning: {
      container: 'bg-yellow-500/10 border-yellow-500/30',
      icon: 'text-yellow-400',
      title: 'text-yellow-300',
      message: 'text-yellow-200/80',
    },
    info: {
      container: 'bg-blue-500/10 border-blue-500/30',
      icon: 'text-blue-400',
      title: 'text-blue-300',
      message: 'text-blue-200/80',
    },
    loading: {
      container: 'bg-gray-500/10 border-gray-500/30',
      icon: 'text-gray-400',
      title: 'text-gray-300',
      message: 'text-gray-200/80',
    },
  };

  const Icon = icons[notification.type];
  const colors = colorClasses[notification.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: 300, scale: 0.8 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 300, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={cn(
        'relative flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl shadow-lg max-w-md',
        colors.container
      )}
    >
      <Icon 
        className={cn(
          'w-5 h-5 flex-shrink-0 mt-0.5',
          colors.icon,
          notification.type === 'loading' && 'animate-spin'
        )} 
      />
      
      <div className="flex-1 min-w-0">
        <h4 className={cn('font-medium text-sm', colors.title)}>
          {notification.title}
        </h4>
        {notification.message && (
          <p className={cn('text-sm mt-1', colors.message)}>
            {notification.message}
          </p>
        )}
        
        {notification.actions && notification.actions.length > 0 && (
          <div className="flex gap-2 mt-3">
            {notification.actions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-lg transition-colors',
                  action.variant === 'primary'
                    ? 'bg-white/10 hover:bg-white/20 text-white'
                    : 'bg-transparent hover:bg-white/5 text-white/70 border border-white/20'
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => removeNotification(notification.id)}
        className="p-1 hover:bg-white/10 rounded-md transition-colors flex-shrink-0"
      >
        <X className="w-4 h-4 text-gray-400" />
      </button>
    </motion.div>
  );
};

// Container for all notifications
const NotificationContainer: React.FC = () => {
  const { notifications } = useNotifications();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {notifications.map(notification => (
          <div key={notification.id} className="pointer-events-auto">
            <NotificationItem notification={notification} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
};

// Utility functions for common use cases
export const showSuccessNotification = (title: string, message?: string) => {
  // This would be used outside of React context
  // You might implement this with a global notification instance
};

export const showErrorNotification = (title: string, message?: string) => {
  // This would be used outside of React context
  // You might implement this with a global notification instance
};

// Example usage component (for documentation)
export const NotificationExample: React.FC = () => {
  const { success, error, warning, info, loading, removeNotification } = useNotifications();

  const handleSuccess = () => {
    success('Operation completed', 'Your data has been saved successfully.');
  };

  const handleError = () => {
    error('Something went wrong', 'Failed to save your changes. Please try again.', {
      actions: [
        {
          label: 'Retry',
          onClick: () => handleSuccess(),
          variant: 'primary'
        },
        {
          label: 'Cancel',
          onClick: () => {},
          variant: 'secondary'
        }
      ]
    });
  };

  const handleLoading = () => {
    const id = loading('Processing...', 'Please wait while we save your changes.');
    
    // Simulate async operation
    setTimeout(() => {
      removeNotification(id);
      success('Completed', 'Changes saved successfully!');
    }, 3000);
  };

  return (
    <div className="space-y-2">
      <button onClick={handleSuccess} className="px-4 py-2 bg-green-600 text-white rounded">
        Show Success
      </button>
      <button onClick={handleError} className="px-4 py-2 bg-red-600 text-white rounded">
        Show Error
      </button>
      <button onClick={handleLoading} className="px-4 py-2 bg-blue-600 text-white rounded">
        Show Loading
      </button>
    </div>
  );
};