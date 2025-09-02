import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  X,
  Sparkles,
  Calendar,
  Tag,
  History,
  Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useVersionCheck } from '@/lib/hooks/useVersionCheck';
import { toast } from 'sonner';
import logger from '@/lib/utils/logger';
import { APP_VERSION, clearCacheAndReload, getVersionInfo } from '@/lib/config/version';

/**
 * Dedicated Releases page displaying version information, update notifications, and release history
 * 
 * Features:
 * - Shows current version with detailed release information
 * - Displays update banner when newer version is available
 * - Complete release history with search and filtering
 * - Provides cache clearing and reload functionality
 * - Enhanced version management and changelog display
 */
export default function Releases() {
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
  const [dismissedUpdate, setDismissedUpdate] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyMajor, setShowOnlyMajor] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  
  // Get version info from the new version system
  const versionInfo = getVersionInfo();

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
   * Handle clearing cache using the new version system
   */
  const handleClearCache = async () => {
    try {
      setIsClearingCache(true);
      toast.loading('Clearing cache and reloading...');
      
      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 800));
      
      clearCacheAndReload();
    } catch (err) {
      logger.error('Cache clear failed:', err);
      toast.error('Cache clear failed. Please try refreshing manually.');
      setIsClearingCache(false);
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
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  /**
   * Check if a version is a major release
   */
  const isMajorRelease = (buildId: string) => {
    const versionMatch = buildId.match(/v(\d+)\.(\d+)\.(\d+)/);
    if (versionMatch) {
      const [, , minor, patch] = versionMatch;
      return minor === '0' && patch === '0'; // Major version if x.0.0
    }
    return false;
  };

  /**
   * Filter releases based on search and major version filter
   */
  const filteredReleases = releases.filter(release => {
    const matchesSearch = !searchTerm || 
      release.buildId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      release.notes.toLowerCase().includes(searchTerm.toLowerCase()) ||
      formatDate(release.date).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesMajor = !showOnlyMajor || isMajorRelease(release.buildId);
    
    return matchesSearch && matchesMajor;
  });

  /**
   * Get status badge for a release
   */
  const getReleaseBadge = (release: any) => {
    const isCurrent = release.buildId === clientBuildId;
    const isNew = release.buildId === newBuildId;
    const isMajor = isMajorRelease(release.buildId);
    
    if (isCurrent) {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Current
        </Badge>
      );
    }
    
    if (isNew) {
      return (
        <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">
          <Bell className="w-3 h-3 mr-1" />
          Available
        </Badge>
      );
    }
    
    if (isMajor) {
      return (
        <Badge variant="outline" className="text-purple-400 border-purple-500/30">
          <Sparkles className="w-3 h-3 mr-1" />
          Major
        </Badge>
      );
    }
    
    return null;
  };

  if (isLoading && releases.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-800 rounded-lg w-64" />
            <div className="h-32 bg-gray-800 rounded-xl" />
            <div className="grid gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-24 bg-gray-800 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
        <div className="max-w-6xl mx-auto flex items-center justify-center h-96">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error Loading Releases</h2>
            <p className="text-gray-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <History className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Releases & Updates</h1>
                <p className="text-gray-400">
                  Version history, release notes, and system updates
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Permanent Cache Management Section - Always Visible */}
        <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-xl p-6">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div className="flex items-start gap-4 flex-1">
              <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                <RefreshCw className="w-6 h-6 text-violet-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-white">
                  Force Update & Cache Management
                </h3>
                <p className="text-gray-300">
                  If you're experiencing issues or not seeing the latest updates, clear your cache to get the newest version.
                </p>
                <div className="flex items-center gap-6 text-sm text-gray-400">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    <span>Current Version: <strong className="text-violet-400">v{APP_VERSION}</strong></span>
                  </div>
                  {versionInfo.lastUpdated !== 'Never' && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>Last Updated: {new Date(versionInfo.lastUpdated).toLocaleDateString()}</span>
                    </div>
                  )}
                  {versionInfo.isOutdated && (
                    <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Update Available
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleClearCache}
                disabled={isClearingCache}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                {isClearingCache ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Clearing Cache...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Clear Cache & Get Latest
                  </>
                )}
              </Button>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-gray-800/30 rounded-lg border border-gray-700/30">
            <p className="text-xs text-gray-400">
              <strong>Note:</strong> This will clear all cached data, log you out, and reload the page with the latest version. 
              Use this if you're experiencing loading errors or missing new features.
            </p>
          </div>
        </div>

        {/* Update Banner */}
        <AnimatePresence>
          {updateAvailable && !dismissedUpdate && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-xl p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <Sparkles className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-xl font-semibold text-white flex items-center gap-3">
                        New Version Available
                        {newBuildId && (
                          <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
                            {formatBuildId(newBuildId)}
                          </Badge>
                        )}
                      </h3>
                      <p className="text-gray-300">
                        A new version of the application is ready to install
                      </p>
                    </div>
                    
                    {/* New release notes */}
                    {newRelease && (
                      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                        <p className="text-gray-300 font-medium mb-2">What's New:</p>
                        <p className="text-gray-400 mb-3">{newRelease.notes}</p>
                        <div className="flex items-center gap-4 text-gray-500 text-sm">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(newRelease.date)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Tag className="w-4 h-4" />
                            {formatBuildId(newRelease.buildId)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleUpdate}
                    disabled={isUpdating}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
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

        {/* Current Version Card */}
        {currentRelease && (
          <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800/50">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-semibold text-white">Current Version</h3>
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    {formatBuildId(currentRelease.buildId)}
                  </Badge>
                  {isMajorRelease(currentRelease.buildId) && (
                    <Badge variant="outline" className="text-purple-400 border-purple-500/30">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Major Release
                    </Badge>
                  )}
                </div>
                <p className="text-gray-400 mb-3">{currentRelease.notes}</p>
                <div className="flex items-center gap-4 text-gray-500 text-sm">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {formatDate(currentRelease.date)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search releases..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={showOnlyMajor}
                onChange={(e) => setShowOnlyMajor(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
              />
              Major releases only
            </label>
          </div>
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between">
          <p className="text-gray-400">
            Showing {filteredReleases.length} of {releases.length} releases
          </p>
        </div>

        {/* Release History */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <History className="w-6 h-6" />
            Release History
          </h2>
          
          <div className="space-y-3">
            {filteredReleases.map((release, index) => {
              const isCurrent = release.buildId === clientBuildId;
              const isNew = release.buildId === newBuildId;
              
              return (
                <motion.div
                  key={release.buildId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-4 rounded-lg border transition-all hover:bg-gray-800/30 ${
                    isCurrent
                      ? 'bg-emerald-500/5 border-emerald-500/30 ring-1 ring-emerald-500/20'
                      : isNew
                      ? 'bg-blue-500/5 border-blue-500/30'
                      : 'bg-gray-800/20 border-gray-700/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-white text-lg">
                          {formatBuildId(release.buildId)}
                        </h3>
                        {getReleaseBadge(release)}
                      </div>
                      <p className="text-gray-300 mb-3 leading-relaxed">{release.notes}</p>
                      <div className="flex items-center gap-4 text-gray-500 text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(release.date)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Tag className="w-4 h-4" />
                          {release.buildId}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {filteredReleases.length === 0 && searchTerm && (
            <div className="text-center py-12">
              <History className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-400 mb-2">No releases found</h3>
              <p className="text-gray-500">
                No releases match your search criteria. Try adjusting your filters.
              </p>
            </div>
          )}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 text-gray-400 py-8">
            <RefreshCw className="w-5 h-5 animate-spin" />
            Checking for updates...
          </div>
        )}
      </div>
    </div>
  );
}