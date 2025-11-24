import React, { Component, ErrorInfo, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, Home, Bug, Copy, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  errorCopied: boolean;
}

/**
 * EmailErrorBoundary - Catches and handles errors in the email feature
 *
 * Features:
 * - Graceful error recovery with retry mechanism
 * - Error details display for debugging
 * - Error reporting to console/monitoring
 * - User-friendly fallback UI
 * - Automatic recovery attempts
 */
export class EmailErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;
  private retryTimeout: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      errorCopied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('[EmailErrorBoundary] Caught error:', error);
    console.error('[EmailErrorBoundary] Error info:', errorInfo);

    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to monitoring service (if available)
    this.logErrorToService(error, errorInfo);
  }

  componentWillUnmount() {
    // Clean up retry timeout
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  logErrorToService(error: Error, errorInfo: ErrorInfo) {
    // TODO: Send to error monitoring service (e.g., Sentry, LogRocket)
    // For now, just log to console with timestamp
    const errorReport = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    console.error('[EmailErrorBoundary] Error Report:', JSON.stringify(errorReport, null, 2));
  }

  handleRetry = () => {
    const { retryCount } = this.state;

    if (retryCount >= this.maxRetries) {
      toast.error('Maximum retry attempts reached. Please refresh the page.');
      return;
    }

    // Increment retry count
    this.setState({ retryCount: retryCount + 1 });

    // Show retry toast
    toast.loading(`Retrying... (Attempt ${retryCount + 1}/${this.maxRetries})`);

    // Wait a bit before retrying (exponential backoff)
    const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);

    this.retryTimeout = setTimeout(() => {
      // Reset error state to retry rendering
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
      });

      toast.success('Retrying...');
    }, delay);
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      errorCopied: false,
    });
  };

  handleCopyError = () => {
    const { error, errorInfo } = this.state;
    if (!error) return;

    const errorText = `
Error: ${error.message}

Stack Trace:
${error.stack || 'No stack trace available'}

Component Stack:
${errorInfo?.componentStack || 'No component stack available'}

URL: ${window.location.href}
User Agent: ${navigator.userAgent}
Timestamp: ${new Date().toISOString()}
    `.trim();

    navigator.clipboard.writeText(errorText).then(() => {
      this.setState({ errorCopied: true });
      toast.success('Error details copied to clipboard');

      // Reset copied state after 2 seconds
      setTimeout(() => {
        this.setState({ errorCopied: false });
      }, 2000);
    });
  };

  render() {
    const { hasError, error, errorInfo, retryCount, errorCopied } = this.state;
    const { children, fallback, showDetails = true } = this.props;

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return <>{fallback}</>;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl w-full bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border-b border-gray-800 p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-500/20 rounded-xl">
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                </div>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-white mb-1">
                    Something went wrong
                  </h1>
                  <p className="text-gray-400">
                    The email feature encountered an unexpected error
                  </p>
                </div>
              </div>
            </div>

            {/* Error Message */}
            <div className="p-6 space-y-4">
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <p className="text-sm font-medium text-gray-300 mb-2">Error Message:</p>
                <p className="text-red-400 font-mono text-sm break-words">
                  {error.message || 'Unknown error'}
                </p>
              </div>

              {/* Error Details (collapsible) */}
              {showDetails && errorInfo && (
                <details className="bg-gray-800/50 rounded-lg border border-gray-700">
                  <summary className="p-4 cursor-pointer hover:bg-gray-800/70 transition-colors flex items-center gap-2 text-sm font-medium text-gray-300">
                    <Bug className="w-4 h-4" />
                    Technical Details
                  </summary>
                  <div className="p-4 pt-0 space-y-3">
                    {error.stack && (
                      <div>
                        <p className="text-xs font-medium text-gray-400 mb-2">Stack Trace:</p>
                        <pre className="text-xs text-gray-500 bg-gray-900 rounded p-3 overflow-x-auto font-mono">
                          {error.stack}
                        </pre>
                      </div>
                    )}
                    {errorInfo.componentStack && (
                      <div>
                        <p className="text-xs font-medium text-gray-400 mb-2">Component Stack:</p>
                        <pre className="text-xs text-gray-500 bg-gray-900 rounded p-3 overflow-x-auto font-mono">
                          {errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={this.handleRetry}
                  disabled={retryCount >= this.maxRetries}
                  className="flex-1 min-w-[140px] px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  {retryCount >= this.maxRetries ? 'Max Retries Reached' : `Retry (${retryCount}/${this.maxRetries})`}
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => window.location.href = '/'}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <Home className="w-4 h-4" />
                  Go Home
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={this.handleCopyError}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  {errorCopied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Error
                    </>
                  )}
                </motion.button>
              </div>

              {/* Help Text */}
              <div className="pt-4 border-t border-gray-800">
                <p className="text-sm text-gray-500">
                  If this problem persists, please try:
                </p>
                <ul className="mt-2 space-y-1 text-sm text-gray-400 list-disc list-inside">
                  <li>Refreshing the page</li>
                  <li>Clearing your browser cache</li>
                  <li>Checking your internet connection</li>
                  <li>Disconnecting and reconnecting your Gmail account</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      );
    }

    return children;
  }
}

/**
 * Functional wrapper for easier usage with hooks
 */
interface EmailErrorBoundaryWrapperProps {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
}

export function EmailErrorBoundaryWrapper({
  children,
  onError,
  showDetails,
}: EmailErrorBoundaryWrapperProps) {
  return (
    <EmailErrorBoundary onError={onError} showDetails={showDetails}>
      {children}
    </EmailErrorBoundary>
  );
}
