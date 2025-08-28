import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useVersionCheck } from '@/lib/hooks/useVersionCheck';
import { toast } from 'sonner';
import logger from '@/lib/utils/logger';

interface RoadmapVersionProps {
  className?: string;
}

/**
 * RoadmapVersion component displays version information and update notifications
 * 
 * Features:
 * - Shows current version and release notes
 * - Displays update banner when newer version is available
 * - Shows new release notes in update state
 * - Provides cache clearing and reload functionality
 * - Expandable release notes history
 */
export function RoadmapVersion({ className = '' }: RoadmapVersionProps) {
  const {
    clientBuildId,
    updateAvailable,
    newBuildId,
    releases,
    clearCachesAndReload,
    isLoading,
    error
  } = useVersionCheck();
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [dismissedUpdate, setDismissedUpdate] = useState(false);

  // Find current and new release data
  const currentRelease = releases.find(r => r.buildId === clientBuildId);
  const newRelease = releases.find(r => r.buildId === newBuildId);

  /**
   * Handle update process with loading states and error handling
   */
  const handleUpdate = async () => {
    try {
      setIsUpdating(true);
      toast.loading('Updating application...');
      
      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await clearCachesAndReload();
    } catch (err) {
      logger.error('Update failed:', err);
      toast.error('Update failed. Please try refreshing manually.');
      setIsUpdating(false);
    }
  };

  /**
   * Format build ID for display (remove technical parts)
   */
  const formatBuildId = (buildId: string) => {
    // Extract version from build ID (e.g., "build-2025-08-28T19-32-36-v1.0.2" -> "v1.0.2")
    const versionMatch = buildId.match(/v\d+\.\d+\.\d+/);
    if (versionMatch) {
      return versionMatch[0];
    }
    
    // Fallback to date format
    const dateMatch = buildId.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      return `Build ${dateMatch[1]}`;
    }
    
    return buildId;
  };

  /**
   * Format release date for display
   */
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  /**
   * Get status badge for current version
   */
  const getStatusBadge = () => {
    if (updateAvailable && !dismissedUpdate) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Update Available
        </Badge>
      );
    }
    
    return (
      <Badge variant="default" className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
        <CheckCircle2 className="w-3 h-3" />
        Current
      </Badge>
    );
  };

  // Don't render anything if there's an error or no data
  if (error || !clientBuildId) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`} data-testid="roadmap-version">
      {/* Update Banner */}
      <AnimatePresence>
        {updateAvailable && !dismissedUpdate && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-xl p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="space-y-2">
                  <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      New Version Available
                      {newBuildId && (
                        <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
                          {formatBuildId(newBuildId)}
                        </Badge>
                      )}
                    </h3>
                    <p className="text-gray-300 text-sm">
                      A new version of the application is ready to install
                    </p>
                  </div>
                  
                  {/* New release notes */}
                  {newRelease && (
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                      <p className="text-gray-300 text-sm font-medium mb-1">What's New:</p>
                      <p className="text-gray-400 text-sm">{newRelease.notes}</p>
                      <p className="text-gray-500 text-xs mt-2">
                        Released {formatDate(newRelease.date)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleUpdate}
                  disabled={isUpdating}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  size="sm"
                >
                  {isUpdating ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Update Now
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => setDismissedUpdate(true)}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current Version Info */}
      <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-4 border border-gray-800/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                Current Version
                {getStatusBadge()}
              </h3>
              <p className="text-gray-400 text-sm">
                {clientBuildId && formatBuildId(clientBuildId)}
              </p>
            </div>
          </div>
          
          <Button
            onClick={() => setIsExpanded(!isExpanded)}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Current release notes */}
        {currentRelease && (
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50 mb-3">
            <p className="text-gray-300 text-sm font-medium mb-1">Release Notes:</p>
            <p className="text-gray-400 text-sm">{currentRelease.notes}</p>
            <p className="text-gray-500 text-xs mt-2">
              Released {formatDate(currentRelease.date)}
            </p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin" data-testid="loading-spinner" />
            Checking for updates...
          </div>
        )}
      </div>

      {/* Release History (Expandable) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800/50 overflow-hidden"
          >
            <div className="p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Release History</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {releases.map((release, index) => {
                  const isCurrent = release.buildId === clientBuildId;
                  const isNew = release.buildId === newBuildId;
                  
                  return (
                    <div
                      key={release.buildId}
                      className={`p-3 rounded-lg border transition-colors ${
                        isCurrent
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : isNew
                          ? 'bg-blue-500/10 border-blue-500/30'
                          : 'bg-gray-800/30 border-gray-700/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-white text-sm">
                              {formatBuildId(release.buildId)}
                            </p>
                            {isCurrent && (
                              <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-xs">
                                Current
                              </Badge>
                            )}
                            {isNew && (
                              <Badge variant="outline" className="text-blue-400 border-blue-500/30 text-xs">
                                Available
                              </Badge>
                            )}
                          </div>
                          <p className="text-gray-400 text-sm mb-2">{release.notes}</p>
                          <p className="text-gray-500 text-xs">
                            {formatDate(release.date)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}