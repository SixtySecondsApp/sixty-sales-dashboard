import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { motion } from 'framer-motion';
import logger from '@/lib/utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isRetrying: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    isRetrying: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { 
      hasError: true, 
      error,
      errorInfo: null,
      isRetrying: false,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report error to monitoring service (if available)
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      });
    }
  }

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.setState({ isRetrying: true });
      this.retryCount++;
      
      setTimeout(() => {
        this.setState({
          hasError: false,
          error: null,
          errorInfo: null,
          isRetrying: false,
        });
      }, 1000);
    }
  };

  private handleRefresh = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private copyErrorDetails = () => {
    const errorDetails = `
Error: ${this.state.error?.message || 'Unknown error'}
Stack: ${this.state.error?.stack || 'No stack trace'}
Component Stack: ${this.state.errorInfo?.componentStack || 'No component stack'}
URL: ${window.location.href}
User Agent: ${navigator.userAgent}
Timestamp: ${new Date().toISOString()}
    `.trim();
    
    navigator.clipboard.writeText(errorDetails).then(() => {
      // Could show a toast here but we want to avoid dependencies in error boundary
      // Error details copied to clipboard
    });
  };

  public render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-8 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1 }}
              className="w-16 h-16 mx-auto mb-6 bg-red-500/10 rounded-full flex items-center justify-center"
            >
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-xl font-semibold text-white mb-3">
                Something went wrong
              </h1>
              
              <p className="text-gray-400 mb-6">
                We encountered an unexpected error. This has been automatically reported.
              </p>

              {/* Error details (collapsible) */}
              {this.state.error && (
                <details className="mb-6 text-left">
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-300 transition-colors text-sm mb-2">
                    Technical details
                  </summary>
                  <div className="bg-gray-900/50 rounded-lg p-3 text-xs text-gray-400 font-mono break-all">
                    <div className="mb-2">
                      <strong className="text-red-400">Error:</strong> {this.state.error.message}
                    </div>
                    {this.state.error.stack && (
                      <div className="max-h-32 overflow-y-auto">
                        <strong className="text-gray-300">Stack:</strong>
                        <pre className="whitespace-pre-wrap">{this.state.error.stack}</pre>
                      </div>
                    )}
                  </div>
                </details>
              )}

              <div className="space-y-3">
                {/* Retry button (if retries available) */}
                {this.retryCount < this.maxRetries && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={this.handleRetry}
                    disabled={this.state.isRetrying}
                    className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    {this.state.isRetrying ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Retrying...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Try Again ({this.maxRetries - this.retryCount} left)
                      </>
                    )}
                  </motion.button>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={this.handleRefresh}
                    className="py-2.5 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh Page
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={this.handleGoHome}
                    className="py-2.5 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <Home className="w-4 h-4" />
                    Go Home
                  </motion.button>
                </div>

                {/* Copy error details */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={this.copyErrorDetails}
                  className="w-full py-2 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors text-sm flex items-center justify-center gap-2 border border-gray-600"
                >
                  <Bug className="w-3 h-3" />
                  Copy Error Details
                </motion.button>
              </div>

              <p className="text-xs text-gray-500 mt-6">
                Error ID: {this.state.error?.name}-{Date.now().toString(36)}
              </p>
            </motion.div>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC for wrapping components with error boundary
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback} onError={onError}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

// Lightweight error boundary for specific components
export const QuickErrorBoundary: React.FC<{ children: ReactNode; fallback?: ReactNode }> = ({ 
  children, 
  fallback 
}) => (
  <ErrorBoundary 
    fallback={
      fallback || (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="font-medium">Something went wrong</span>
          </div>
          <p className="text-sm text-gray-400">This component failed to load properly.</p>
        </div>
      )
    }
  >
    {children}
  </ErrorBoundary>
);

export default ErrorBoundary;