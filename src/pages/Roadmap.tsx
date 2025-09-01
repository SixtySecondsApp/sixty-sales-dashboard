import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Map,
  Plus,
  Filter,
  Search,
  Users,
  TrendingUp,
  CheckCircle2,
  Clock,
  Lightbulb,
  Bug,
  ArrowUp,
  AlertTriangle,
  BarChart3,
  RefreshCw,
  Wifi,
  WifiOff,
  Shield,
  Server
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRoadmap, RoadmapSuggestion } from '@/lib/hooks/useRoadmap';
import { useUser } from '@/lib/hooks/useUser';
import { RoadmapKanban, RoadmapKanbanHandle } from '@/components/roadmap/RoadmapKanban';
import { SearchInput } from '@/components/SearchInput';
import { useSearch } from '@/hooks/useSearch';
import logger from '@/lib/utils/logger';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
}

const colorClasses = {
  gray: {
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/20',
    text: 'text-gray-500'
  },
  yellow: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    text: 'text-yellow-500'
  },
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-500'
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    text: 'text-purple-500'
  },
  green: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    text: 'text-green-500'
  },
  red: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    text: 'text-red-500'
  }
} as const;

// TICKET #36: Memoized StatCard component for better performance
const StatCard = memo(function StatCard({ title, value, icon: Icon, color, subtitle }: StatCardProps) {
  const colorClass = useMemo(() => 
    colorClasses[color as keyof typeof colorClasses] || colorClasses.gray,
    [color]
  );
  
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800/50"
    >
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${colorClass.bg} border ${colorClass.border}`}>
          <Icon className={`w-6 h-6 ${colorClass.text}`} />
        </div>
        <div>
          <p className="text-sm text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
    </motion.div>
  );
});

// TICKET #26: Enhanced error categorization and retry logic
interface ErrorInfo {
  type: 'network' | 'auth' | 'server' | 'validation' | 'unknown';
  message: string;
  originalError: string;
  recoverable: boolean;
}

// TICKET #26: Enhanced error parsing and categorization
const parseError = (error: string): ErrorInfo => {
  const errorLower = error.toLowerCase();
  
  // Network-related errors
  if (errorLower.includes('fetch') || errorLower.includes('network') || errorLower.includes('connection')) {
    return {
      type: 'network',
      message: 'Network connection failed. Please check your internet connection and try again.',
      originalError: error,
      recoverable: true
    };
  }
  
  // Authentication errors
  if (errorLower.includes('authentication') || errorLower.includes('unauthorized') || errorLower.includes('token')) {
    return {
      type: 'auth',
      message: 'Authentication failed. Please refresh the page or log in again.',
      originalError: error,
      recoverable: true
    };
  }
  
  // Database/server errors
  if (errorLower.includes('database') || errorLower.includes('server') || errorLower.includes('internal')) {
    return {
      type: 'server',
      message: 'Server is temporarily unavailable. Our team has been notified.',
      originalError: error,
      recoverable: true
    };
  }
  
  // Validation errors
  if (errorLower.includes('validation') || errorLower.includes('required') || errorLower.includes('invalid')) {
    return {
      type: 'validation',
      message: 'Invalid data provided. Please check your input and try again.',
      originalError: error,
      recoverable: false
    };
  }
  
  // Default unknown error
  return {
    type: 'unknown',
    message: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
    originalError: error,
    recoverable: true
  };
};

export default function Roadmap() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { suggestions, loading, error, refetch } = useRoadmap();
  const { userData } = useUser();
  const { debouncedQuery, setQuery } = useSearch('', { debounceDelay: 300, minSearchLength: 0 });
  const [typeFilter, setTypeFilter] = useState<RoadmapSuggestion['type'] | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<RoadmapSuggestion['status'] | 'all'>('all');
  const roadmapKanbanRef = useRef<RoadmapKanbanHandle>(null);
  
  // TICKET #26: Enhanced error state management
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const isAdmin = userData?.is_admin || false;
  
  // TICKET #26: Enhanced error information
  const errorInfo = useMemo(() => error ? parseError(error) : null, [error]);

  // TICKET #36: Memoized event handlers for better performance
  const handleOpenSuggestionForm = useCallback(() => {
    roadmapKanbanRef.current?.openSuggestionForm();
  }, []);

  const handleTypeFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setTypeFilter(e.target.value as any);
  }, []);

  const handleStatusFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value as any);
  }, []);

  // TICKET #26: Enhanced retry mechanism with exponential backoff
  const handleRetry = useCallback(async () => {
    if (isRetrying || !errorInfo?.recoverable) return;
    
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);
    
    try {
      // Add delay for retry with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Attempt to refetch data
      if (refetch) {
        await refetch();
      }
    } catch (err) {
      logger.error('Retry failed:', err);
    } finally {
      setIsRetrying(false);
    }
  }, [isRetrying, errorInfo?.recoverable, retryCount, refetch]);

  // TICKET #26: Reset retry count when error changes or loading starts
  useEffect(() => {
    if (loading || !error) {
      setRetryCount(0);
      setIsRetrying(false);
    }
  }, [loading, error]);

  // TICKET #23 & #36: Enhanced loading skeleton with better UX and mobile responsiveness
  const loadingSkeleton = useMemo(() => (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
        {/* TICKET #23: Enhanced header skeleton with mobile optimization */}
        <div className="animate-pulse space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-800/50 w-10 h-10" />
                <div className="space-y-2">
                  <div className="h-8 bg-gray-800 rounded-lg w-48 sm:w-64" />
                  <div className="h-4 bg-gray-800/60 rounded w-32 sm:w-40" />
                </div>
              </div>
            </div>
            <div className="w-full sm:w-auto">
              <div className="h-10 bg-gray-800 rounded-lg w-full sm:w-48" />
            </div>
          </div>
        </div>

        {/* TICKET #23: Enhanced statistics cards with mobile-first design */}
        <div className="animate-pulse grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-4 sm:p-6 border border-gray-800/50 space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 sm:p-3 rounded-lg bg-gray-800/50 w-8 h-8 sm:w-12 sm:h-12" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 sm:h-4 bg-gray-800/60 rounded w-16 sm:w-20" />
                  <div className="h-6 sm:h-8 bg-gray-800 rounded w-8 sm:w-12" />
                  <div className="h-2 sm:h-3 bg-gray-800/40 rounded w-12 sm:w-16" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* TICKET #23: Enhanced type breakdown with improved mobile layout */}
        <div className="animate-pulse grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + i * 0.05 }}
              className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-3 sm:p-4 border border-gray-800/50"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-4 h-4 sm:w-5 sm:h-5 bg-gray-800/60 rounded" />
                <div className="space-y-1 flex-1">
                  <div className="h-3 bg-gray-800/60 rounded w-12 sm:w-16" />
                  <div className="h-4 sm:h-5 bg-gray-800 rounded w-6 sm:w-8" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* TICKET #23: Enhanced filters section with mobile responsiveness */}
        <div className="animate-pulse space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center">
            <div className="flex-1 max-w-full sm:max-w-md">
              <div className="h-10 bg-gray-800 rounded-lg w-full" />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="h-10 bg-gray-800 rounded-lg w-full sm:w-32" />
              <div className="h-10 bg-gray-800 rounded-lg w-full sm:w-32" />
            </div>
          </div>
          <div className="h-4 bg-gray-800/60 rounded w-40" />
        </div>

        {/* TICKET #23: Enhanced kanban skeleton with progressive loading animation */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="animate-pulse"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
            {Array.from({ length: 5 }).map((_, columnIndex) => (
              <motion.div
                key={columnIndex}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8 + columnIndex * 0.1 }}
                className="space-y-4"
              >
                {/* Column header */}
                <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-3 sm:p-4 border border-gray-800/50 space-y-2">
                  <div className="h-5 sm:h-6 bg-gray-800 rounded w-20 sm:w-24" />
                  <div className="h-3 bg-gray-800/60 rounded w-8" />
                </div>
                
                {/* Column cards */}
                {Array.from({ length: columnIndex === 2 ? 1 : columnIndex === 3 ? 3 : columnIndex === 4 ? 1 : 0 }).map((_, cardIndex) => (
                  <motion.div
                    key={cardIndex}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.0 + columnIndex * 0.1 + cardIndex * 0.1 }}
                    className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-3 sm:p-4 border border-gray-800/50 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="h-4 bg-gray-800 rounded w-12" />
                      <div className="w-6 h-6 bg-gray-800/60 rounded" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-5 bg-gray-800 rounded w-full" />
                      <div className="h-3 bg-gray-800/60 rounded w-3/4" />
                    </div>
                    <div className="flex gap-2">
                      <div className="h-4 bg-gray-800/60 rounded w-12" />
                      <div className="h-4 bg-gray-800/60 rounded w-8" />
                      <div className="h-4 bg-gray-800/60 rounded w-10" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="h-3 bg-gray-800/40 rounded w-16" />
                      <div className="h-3 bg-gray-800/40 rounded w-12" />
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  ), []);

  // Handle ticket ID routing
  useEffect(() => {
    if (ticketId && suggestions.length > 0 && roadmapKanbanRef.current) {
      const ticketNumber = parseInt(ticketId, 10);
      const targetSuggestion = suggestions.find(s => s.ticket_id === ticketNumber);
      
      if (targetSuggestion) {
        logger.log('Found ticket:', targetSuggestion);
        // Open the suggestion modal
        roadmapKanbanRef.current.openSuggestionModal?.(targetSuggestion);
        // Clear the URL to show the regular roadmap
        navigate('/roadmap', { replace: true });
      } else {
        logger.log('Ticket not found:', ticketNumber);
        // Ticket not found, redirect to main roadmap
        navigate('/roadmap', { replace: true });
      }
    }
  }, [ticketId, suggestions, navigate]);

  // Optimized filtering with useMemo to prevent unnecessary re-renders
  const filteredSuggestions = useMemo(() => {
    return suggestions.filter((suggestion: RoadmapSuggestion) => {
      const matchesSearch = !debouncedQuery || 
        suggestion.title.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        suggestion.description.toLowerCase().includes(debouncedQuery.toLowerCase());
      
      const matchesType = typeFilter === 'all' || suggestion.type === typeFilter;
      const matchesStatus = statusFilter === 'all' || suggestion.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [suggestions, debouncedQuery, typeFilter, statusFilter]);

  // TICKET #36: Memoized statistics calculation for better performance
  const stats = useMemo(() => ({
    total: suggestions.length,
    completed: suggestions.filter((s: RoadmapSuggestion) => s.status === 'completed').length,
    inProgress: suggestions.filter((s: RoadmapSuggestion) => s.status === 'in_progress').length,
    pending: suggestions.filter((s: RoadmapSuggestion) => s.status === 'submitted').length,
  }), [suggestions]);

  const typeStats = useMemo(() => ({
    features: suggestions.filter((s: RoadmapSuggestion) => s.type === 'feature').length,
    bugs: suggestions.filter((s: RoadmapSuggestion) => s.type === 'bug').length,
    improvements: suggestions.filter((s: RoadmapSuggestion) => s.type === 'improvement').length,
    other: suggestions.filter((s: RoadmapSuggestion) => s.type === 'other').length,
  }), [suggestions]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-800 rounded-lg w-64" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 bg-gray-800 rounded-xl" />
              ))}
            </div>
            <div className="h-96 bg-gray-800 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // TICKET #26: Enhanced error display with better UX and retry functionality
  if (error && errorInfo) {
    const getErrorIcon = () => {
      switch (errorInfo.type) {
        case 'network':
          return <WifiOff className="w-12 h-12 text-red-500 mx-auto mb-4" />;
        case 'auth':
          return <Shield className="w-12 h-12 text-orange-500 mx-auto mb-4" />;
        case 'server':
          return <Server className="w-12 h-12 text-red-500 mx-auto mb-4" />;
        case 'validation':
          return <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />;
        default:
          return <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />;
      }
    };

    const getErrorTitle = () => {
      switch (errorInfo.type) {
        case 'network':
          return 'Connection Problem';
        case 'auth':
          return 'Authentication Required';
        case 'server':
          return 'Server Unavailable';
        case 'validation':
          return 'Invalid Request';
        default:
          return 'Something Went Wrong';
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[60vh]">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-md mx-auto"
          >
            <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-800/50">
              {getErrorIcon()}
              <h2 className="text-2xl font-semibold mb-3">{getErrorTitle()}</h2>
              <p className="text-gray-300 mb-6 leading-relaxed">{errorInfo.message}</p>
              
              {errorInfo.recoverable && (
                <div className="space-y-4">
                  <Button
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed mx-auto"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
                    {isRetrying ? 'Retrying...' : retryCount > 0 ? `Retry (${retryCount + 1})` : 'Try Again'}
                  </Button>
                  
                  {retryCount > 2 && (
                    <p className="text-sm text-gray-500">
                      Having trouble? Try refreshing the page or contact support.
                    </p>
                  )}
                </div>
              )}

              {process.env.NODE_ENV === 'development' && (
                <details className="mt-6 text-left">
                  <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-400">
                    Debug Info
                  </summary>
                  <pre className="mt-2 text-xs text-gray-600 bg-gray-800/50 p-3 rounded overflow-auto">
                    {errorInfo.originalError}
                  </pre>
                </details>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
        {/* TICKET #23: Enhanced header with improved mobile responsiveness */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-6"
        >
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
              >
                <Map className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />
              </motion.div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">Product Roadmap</h1>
                <p className="text-sm sm:text-base text-gray-400 leading-relaxed max-w-md">
                  Share your ideas, report bugs, and track development progress
                </p>
              </div>
            </div>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-3 w-full sm:w-auto"
          >
            <Button
              onClick={handleOpenSuggestionForm}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 transition-all duration-200 hover:scale-105 w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden xs:inline">Submit Feature Request</span>
              <span className="xs:hidden">Submit</span>
            </Button>
          </motion.div>
        </motion.div>

        {/* TICKET #23: Enhanced statistics with improved mobile layout and animations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6"
        >
          {[
            { title: "Total Suggestions", value: stats.total, icon: BarChart3, color: "blue", subtitle: "All time submissions" },
            { title: "Completed", value: stats.completed, icon: CheckCircle2, color: "green", subtitle: "Successfully implemented" },
            { title: "In Progress", value: stats.inProgress, icon: Clock, color: "yellow", subtitle: "Currently being developed" },
            { title: "Pending Review", value: stats.pending, icon: Users, color: "purple", subtitle: "Awaiting evaluation" },
          ].map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + index * 0.1 }}
            >
              <StatCard
                title={stat.title}
                value={stat.value}
                icon={stat.icon}
                color={stat.color}
                subtitle={stat.subtitle}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* TICKET #23: Enhanced type breakdown with improved mobile layout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
        >
          {[
            { label: "Features", value: typeStats.features, icon: Lightbulb, color: "text-blue-400" },
            { label: "Bugs", value: typeStats.bugs, icon: Bug, color: "text-red-400" },
            { label: "Improvements", value: typeStats.improvements, icon: ArrowUp, color: "text-emerald-400" },
            { label: "Other", value: typeStats.other, icon: AlertTriangle, color: "text-yellow-400" },
          ].map((type, index) => (
            <motion.div
              key={type.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.9 + index * 0.05 }}
              whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
              className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-3 sm:p-4 border border-gray-800/50 hover:border-gray-700/50 transition-all duration-200"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <type.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${type.color}`} />
                <div>
                  <p className="text-xs sm:text-sm text-gray-400">{type.label}</p>
                  <p className="text-base sm:text-lg font-semibold text-white">{type.value}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* TICKET #23: Enhanced filters with improved mobile responsiveness */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center"
        >
          <div className="flex-1 w-full sm:max-w-md">
            <SearchInput
              onSearch={setQuery}
              placeholder="Search suggestions..."
              className="w-full transition-all duration-200 focus:scale-[1.02]"
            />
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <select
              value={typeFilter}
              onChange={handleTypeFilterChange}
              className="flex-1 sm:flex-none bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 hover:bg-gray-800/70"
            >
              <option value="all">All Types</option>
              <option value="feature">Features</option>
              <option value="bug">Bugs</option>
              <option value="improvement">Improvements</option>
              <option value="other">Other</option>
            </select>
            
            <select
              value={statusFilter}
              onChange={handleStatusFilterChange}
              className="flex-1 sm:flex-none bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 hover:bg-gray-800/70"
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="in_progress">In Progress</option>
              <option value="testing">Testing</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </motion.div>

        {/* TICKET #23: Enhanced results summary with mobile responsiveness */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <p className="text-sm sm:text-base text-gray-400">
            Showing <span className="font-medium text-emerald-400">{filteredSuggestions.length}</span> of{' '}
            <span className="font-medium text-white">{suggestions.length}</span> suggestions
          </p>
          {isAdmin && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.3 }}
              className="text-xs sm:text-sm text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 whitespace-nowrap"
            >
              <span className="hidden sm:inline">Admin Mode: You can drag & drop to manage suggestions</span>
              <span className="sm:hidden">Admin Mode</span>
            </motion.div>
          )}
        </motion.div>

        {/* Kanban Board */}
        <RoadmapKanban ref={roadmapKanbanRef} />
      </div>
    </div>
  );
}